import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, File, AlertCircle } from 'lucide-react';
import { useAppContext, type CrmDocument } from '../context/AppContext';
import './DocumentPreviewModal.css';

interface DocumentPreviewModalProps {
  document: CrmDocument;
  onClose: () => void;
}

export function DocumentPreviewModal({ document: doc, onClose }: DocumentPreviewModalProps) {
  const { getCrmDocumentBlob, downloadCrmDocument } = useAppContext();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;

    async function loadBlob() {
      setLoading(true);
      setError(null);
      try {
        const blob = await getCrmDocumentBlob(doc);
        if (!blob) {
          setError("Le fichier n'a pas pu être chargé.");
          return;
        }
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement.');
      } finally {
        setLoading(false);
      }
    }

    loadBlob();

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, getCrmDocumentBlob]);

  const isPdf = doc.type.includes('pdf') || doc.name.toLowerCase().endsWith('.pdf');
  const isImage = doc.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.name);

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div className="doc-preview-backdrop" onClick={onClose}>
      <div className="doc-preview-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-preview-header">
          <div className="doc-preview-title">
            {isPdf && <FileText size={18} color="#0D9488" />}
            {isImage && <ImageIcon size={18} color="#3B82F6" />}
            {!isPdf && !isImage && <File size={18} color="#64748B" />}
            <span title={doc.name}>{doc.name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {doc.category && (
              <span className="badge-status bg-info" style={{ fontSize: '0.75rem' }}>
                {doc.category}
              </span>
            )}
            <button className="btn-icon" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="doc-preview-body">
          {loading && (
            <div style={{ color: 'white', fontSize: '0.95rem' }}>
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

          {!loading && !error && blobUrl && (
            <>
              {isPdf && (
                <iframe
                  src={blobUrl}
                  title={doc.name}
                  className="doc-preview-iframe"
                />
              )}

              {isImage && (
                <img
                  src={blobUrl}
                  alt={doc.name}
                  className="doc-preview-image"
                />
              )}

              {!isPdf && !isImage && (
                <div className="doc-preview-fallback">
                  <File size={48} color="#94A3B8" />
                  <div>
                    <h4 style={{ margin: 0 }}>{doc.name}</h4>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
                      Ce format de fichier ({doc.type}) ne peut pas être prévisualisé directement dans le navigateur.
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
            Taille : <strong>{formatSize(doc.sizeBytes)}</strong> • Ajouté le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
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
    </div>
  );
}

