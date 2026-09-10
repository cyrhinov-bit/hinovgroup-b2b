import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  AlertCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Edit3,
  Eye,
  Save,
  Check,
  Settings,
  Plus,
  Trash2,
  Search,
  Table as TableIcon,
  Code
} from 'lucide-react';
import { useAppContext, type CrmDocument } from '../context/AppContext';
import { DocumentEditorModal } from './DocumentEditorModal';
import './DocumentPreviewModal.css';

interface DocumentPreviewModalProps {
  document: CrmDocument;
  onClose: () => void;
  onDocumentUpdated?: (updatedDoc: CrmDocument) => void;
}

// Simple CSV Parser & Stringifier
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect separator: ';' or ','
  const firstLine = lines[0];
  const separator = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';

  return lines.map(line => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === separator && !insideQuote) {
        row.push(entry.trim().replace(/^"|"$/g, ''));
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim().replace(/^"|"$/g, ''));
    return row;
  });
}

function stringifyCsv(grid: string[][], separator: string = ';'): string {
  return grid
    .map(row =>
      row
        .map(cell => {
          const val = String(cell || '');
          if (val.includes(separator) || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(separator)
    )
    .join('\n');
}

// Simple Markdown to HTML Formatter (Lightweight & Safe)
function renderSimpleMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Code blocks & inline code
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/gim, '<code style="background:#f1f5f9;padding:2px 5px;border-radius:4px;color:#0d9488;">$1</code>');

  // Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');

  // Paragraphs / Line breaks
  html = html.replace(/\n\n/gim, '</p><p>');
  html = html.replace(/\n/gim, '<br />');

  return `<p>${html}</p>`;
}

export function DocumentPreviewModal({ document: initialDoc, onClose, onDocumentUpdated }: DocumentPreviewModalProps) {
  const { getCrmDocumentBlob, downloadCrmDocument, updateCrmDocument } = useAppContext();
  const [doc, setDoc] = useState<CrmDocument>(initialDoc);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [activeMode, setActiveMode] = useState<'VIEW' | 'EDIT'>('VIEW');

  // Image Controls
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  // Text / Code / Markdown Content
  const [textContent, setTextContent] = useState<string>('');
  const [initialTextContent, setInitialTextContent] = useState<string>('');
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // CSV Tabular Data
  const [csvGrid, setCsvGrid] = useState<string[][]>([]);
  const [csvSearch, setCsvSearch] = useState('');

  // File Type Classifications
  const fileName = doc.name.toLowerCase();
  const fileType = doc.type.toLowerCase();

  const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(fileName);
  const isCsv = fileType.includes('csv') || /\.(csv|tsv)$/i.test(fileName);
  const isMarkdown = fileName.endsWith('.md') || fileName.endsWith('.markdown');
  const isTextOrCode =
    isMarkdown ||
    isCsv ||
    fileType.startsWith('text/') ||
    fileType.includes('json') ||
    fileType.includes('xml') ||
    fileType.includes('javascript') ||
    fileType.includes('typescript') ||
    /\.(txt|json|xml|html|htm|css|js|jsx|ts|tsx|log|env|sql|yml|yaml|ini|config|sh|bat)$/i.test(fileName);

  const isEditable = isTextOrCode || isCsv;

  // Load Document Data & Blob
  useEffect(() => {
    let url: string | null = null;
    let isCancelled = false;

    async function loadBlob() {
      setLoading(true);
      setError(null);
      setSaveSuccess(false);

      try {
        const blob = await getCrmDocumentBlob(doc);
        if (isCancelled) return;

        if (!blob) {
          setError("Le fichier n'a pas pu être chargé depuis le stockage.");
          return;
        }

        url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // If file is text, code or CSV, read its text content
        if (isTextOrCode) {
          const text = await blob.text();
          if (!isCancelled) {
            setTextContent(text);
            setInitialTextContent(text);
            if (isCsv) {
              setCsvGrid(parseCsv(text));
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Erreur lors du chargement du fichier.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadBlob();

    return () => {
      isCancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, getCrmDocumentBlob, isTextOrCode, isCsv]);

  // Dirty check for text/code/csv
  const isDirty = useMemo(() => {
    if (isCsv) {
      return stringifyCsv(csvGrid) !== initialTextContent;
    }
    return textContent !== initialTextContent;
  }, [isCsv, csvGrid, textContent, initialTextContent]);

  // Save Text / Code / CSV Modifications
  const handleSaveContent = async () => {
    if (!isEditable) return;
    setIsSavingContent(true);
    setSaveSuccess(false);

    try {
      let finalContent = textContent;
      if (isCsv) {
        finalContent = stringifyCsv(csvGrid);
      }

      const mimeType = isCsv ? 'text/csv' : isMarkdown ? 'text/markdown' : doc.type || 'text/plain';
      const updatedBlob = new Blob([finalContent], { type: mimeType });

      await updateCrmDocument(
        doc.id,
        {
          sizeBytes: updatedBlob.size,
          type: mimeType
        },
        updatedBlob
      );

      setInitialTextContent(finalContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      const updatedDoc: CrmDocument = {
        ...doc,
        sizeBytes: updatedBlob.size,
        type: mimeType,
        updatedAt: new Date().toISOString()
      };
      setDoc(updatedDoc);
      if (onDocumentUpdated) onDocumentUpdated(updatedDoc);
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde du contenu:', err);
      alert(err.message || 'Erreur lors de la sauvegarde des modifications.');
    } finally {
      setIsSavingContent(false);
    }
  };

  // CSV Cell editing
  const handleCsvCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newGrid = csvGrid.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        const newRow = [...row];
        newRow[colIndex] = value;
        return newRow;
      }
      return row;
    });
    setCsvGrid(newGrid);
  };

  const handleAddCsvRow = () => {
    const colsCount = csvGrid.length > 0 ? csvGrid[0].length : 3;
    const newRow = new Array(colsCount).fill('');
    setCsvGrid([...csvGrid, newRow]);
  };

  const handleDeleteCsvRow = (rowIndex: number) => {
    if (csvGrid.length <= 1) {
      alert('Impossible de supprimer la seule ligne restante.');
      return;
    }
    setCsvGrid(csvGrid.filter((_, idx) => idx !== rowIndex));
  };

  const filteredCsvRows = useMemo(() => {
    if (!csvSearch.trim()) return csvGrid;
    const q = csvSearch.toLowerCase();
    return csvGrid.filter((row, idx) => idx === 0 || row.some(cell => cell.toLowerCase().includes(q)));
  }, [csvGrid, csvSearch]);

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div className="doc-preview-backdrop" onClick={onClose}>
      <div className={`doc-preview-container ${isFullscreen ? 'fullscreen' : ''}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-preview-header">
          <div className="doc-preview-title">
            {isPdf && <FileText size={18} color="#0D9488" />}
            {isImage && <ImageIcon size={18} color="#3B82F6" />}
            {isCsv && <TableIcon size={18} color="#10B981" />}
            {isTextOrCode && !isCsv && <Code size={18} color="#6366F1" />}
            {!isPdf && !isImage && !isTextOrCode && <File size={18} color="#64748B" />}
            <span title={doc.name}>{doc.name}</span>
          </div>

          <div className="doc-preview-header-actions">
            {/* View / Edit Mode Toggles for editable documents */}
            {isEditable && (
              <div style={{ display: 'inline-flex', marginRight: '6px' }}>
                <button
                  type="button"
                  className={`btn-tab-toggle ${activeMode === 'VIEW' ? 'active' : ''}`}
                  onClick={() => setActiveMode('VIEW')}
                >
                  <Eye size={14} style={{ marginRight: '4px' }} />
                  {isMarkdown ? 'Rendu' : isCsv ? 'Tableau' : 'Lecture'}
                </button>
                <button
                  type="button"
                  className={`btn-tab-toggle ${activeMode === 'EDIT' ? 'active' : ''}`}
                  onClick={() => setActiveMode('EDIT')}
                >
                  <Edit3 size={14} style={{ marginRight: '4px' }} />
                  {isCsv ? 'Éditer cellules' : 'Code / Source'}
                </button>
              </div>
            )}

            {/* Save Button (when content has changed or in edit mode) */}
            {isEditable && (isDirty || activeMode === 'EDIT') && (
              <button
                className={`btn ${isDirty ? 'btn-primary' : 'btn-secondary'}`}
                onClick={handleSaveContent}
                disabled={isSavingContent || !isDirty}
                style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Enregistrer les modifications apportées au fichier"
              >
                {saveSuccess ? <Check size={14} color="#10B981" /> : <Save size={14} />}
                {isSavingContent ? 'Enregistrement...' : saveSuccess ? 'Enregistré !' : 'Enregistrer'}
              </button>
            )}

            {/* Properties / Metadata Modal Button */}
            <button
              className="btn btn-secondary"
              onClick={() => setShowMetadataEditor(true)}
              style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Modifier les métadonnées ou remplacer le fichier"
            >
              <Settings size={14} />
              Propriétés
            </button>

            {/* Fullscreen Toggle */}
            <button
              className="btn-icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            {/* Close */}
            <button
              className="btn-icon"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`doc-preview-body ${isTextOrCode || isMarkdown ? 'light-mode' : ''}`}>
          {loading && (
            <div style={{ color: isTextOrCode ? '#0F172A' : '#FFFFFF', fontSize: '0.95rem' }}>
              Chargement du document en cours...
            </div>
          )}

          {error && (
            <div className="doc-preview-fallback">
              <AlertCircle size={40} color="#EF4444" />
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={() => downloadCrmDocument(doc)}>
                <Download size={16} style={{ marginRight: '6px' }} />
                Tenter le téléchargement direct
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* 1. PDF VIEWER */}
              {isPdf && blobUrl && (
                <iframe src={blobUrl} title={doc.name} className="doc-preview-iframe" />
              )}

              {/* 2. IMAGE VIEWER WITH CONTROLS */}
              {isImage && blobUrl && (
                <div className="doc-preview-image-wrapper">
                  <img
                    src={blobUrl}
                    alt={doc.name}
                    className="doc-preview-image"
                    style={{
                      transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`
                    }}
                  />
                  <div className="image-toolbar">
                    <button onClick={() => setImgZoom(z => Math.max(0.2, z - 0.2))} title="Zoom arrière">
                      <ZoomOut size={16} />
                    </button>
                    <span style={{ fontSize: '0.8rem', minWidth: '45px', textAlign: 'center' }}>
                      {Math.round(imgZoom * 100)}%
                    </span>
                    <button onClick={() => setImgZoom(z => Math.min(4, z + 0.2))} title="Zoom avant">
                      <ZoomIn size={16} />
                    </button>
                    <button onClick={() => setImgRotation(r => (r + 90) % 360)} title="Faire pivoter">
                      <RotateCw size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setImgZoom(1);
                        setImgRotation(0);
                      }}
                      title="Réinitialiser la vue"
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    >
                      100%
                    </button>
                  </div>
                </div>
              )}

              {/* 3. CSV TABULAR VIEWER & EDITOR */}
              {isCsv && (
                <div className="doc-csv-container">
                  <div className="doc-csv-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '300px' }}>
                      <Search size={16} color="#64748B" />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Rechercher dans les cellules..."
                        value={csvSearch}
                        onChange={e => setCsvSearch(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {csvGrid.length} ligne(s) • {csvGrid[0]?.length || 0} colonne(s)
                      </span>
                      {activeMode === 'EDIT' && (
                        <button
                          className="btn btn-secondary"
                          onClick={handleAddCsvRow}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={14} /> Ajouter une ligne
                        </button>
                      )}
                    </div>
                  </div>

                  {activeMode === 'VIEW' ? (
                    <div className="doc-csv-table-wrapper">
                      <table className="doc-csv-table">
                        {filteredCsvRows.length > 0 && (
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                              {filteredCsvRows[0].map((h, i) => (
                                <th key={i}>{h || `Col ${i + 1}`}</th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {filteredCsvRows.slice(1).map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>{rIdx + 1}</td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="doc-csv-table-wrapper">
                      <table className="doc-csv-table">
                        {csvGrid.length > 0 && (
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                              {csvGrid[0].map((h, cIdx) => (
                                <th key={cIdx}>
                                  <input
                                    type="text"
                                    className="doc-csv-input"
                                    value={h}
                                    style={{ fontWeight: 600 }}
                                    onChange={e => handleCsvCellChange(0, cIdx, e.target.value)}
                                  />
                                </th>
                              ))}
                              <th style={{ width: '40px', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {csvGrid.slice(1).map((row, rIdx) => {
                            const actualRowIdx = rIdx + 1;
                            return (
                              <tr key={actualRowIdx}>
                                <td style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>{actualRowIdx}</td>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx}>
                                    <input
                                      type="text"
                                      className="doc-csv-input"
                                      value={cell}
                                      onChange={e => handleCsvCellChange(actualRowIdx, cIdx, e.target.value)}
                                    />
                                  </td>
                                ))}
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="btn-icon text-error"
                                    onClick={() => handleDeleteCsvRow(actualRowIdx)}
                                    title="Supprimer la ligne"
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 4. MARKDOWN VIEWER */}
              {isMarkdown && activeMode === 'VIEW' && (
                <div
                  className="doc-markdown-container"
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(textContent) }}
                />
              )}

              {/* 5. TEXT / CODE / RAW MARKDOWN EDITOR */}
              {isTextOrCode && !isCsv && (activeMode === 'EDIT' || (!isMarkdown && activeMode === 'VIEW')) && (
                <div className="doc-text-editor-container">
                  <div className="doc-text-editor-toolbar">
                    <span>Format : {doc.name.split('.').pop()?.toUpperCase() || 'TEXTE'}</span>
                    <span>
                      {textContent.split('\n').length} ligne(s) • {textContent.length} caractères
                    </span>
                  </div>
                  <textarea
                    className="doc-text-editor-textarea"
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder="Contenu du document..."
                    spellCheck={false}
                  />
                </div>
              )}

              {/* 6. UNSUPPORTED BINARY FALLBACK */}
              {!isPdf && !isImage && !isTextOrCode && (
                <div className="doc-preview-fallback">
                  <File size={54} color="#94A3B8" />
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>{doc.name}</h3>
                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>
                      Format : <code>{doc.type || 'Fichier binaire'}</code> ({formatSize(doc.sizeBytes)})
                    </p>
                    <p style={{ margin: '8px 0 0', opacity: 0.7, fontSize: '0.8rem' }}>
                      Ce type de document peut être téléchargé directement ou ouvert avec une application externe.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadCrmDocument(doc)}>
                    <Download size={16} style={{ marginRight: '6px' }} />
                    Télécharger le fichier
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="doc-preview-footer">
          <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Taille : <strong>{formatSize(doc.sizeBytes)}</strong> • Type : <strong>{doc.type}</strong> • Ajouté le{' '}
            {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
            {doc.updatedAt && (
              <span> • Modifié le {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Fermer
            </button>
            <button className="btn btn-primary" onClick={() => downloadCrmDocument(doc)}>
              <Download size={16} style={{ marginRight: '6px' }} />
              Télécharger
            </button>
          </div>
        </div>
      </div>

      {/* Metadata & Replacement Modal */}
      {showMetadataEditor && (
        <DocumentEditorModal
          document={doc}
          onClose={() => setShowMetadataEditor(false)}
          onSaved={updatedDoc => {
            setDoc(updatedDoc);
            if (onDocumentUpdated) onDocumentUpdated(updatedDoc);
          }}
        />
      )}
    </div>
  );
}
