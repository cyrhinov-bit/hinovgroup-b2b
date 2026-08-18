import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, Download, Trash2, Folder, FolderPlus, ChevronRight } from 'lucide-react';
import { useConfirm } from '../components/ConfirmModal';

import { useAppContext, type CrmDocument, type CrmFolder } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function Documents() {
  const { confirm } = useConfirm();
  const { crmDocuments, crmFolders, addCrmDocument, deleteCrmDocument, downloadCrmDocument, addCrmFolder, deleteCrmFolder, users } = useAppContext();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const isAdmin = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Gerant';
  const displayedUserId = isAdmin ? selectedUserId : currentUser?.id;

  const userFolders = useMemo(() => crmFolders.filter(f => f.ownerId === displayedUserId), [crmFolders, displayedUserId]);
  const userDocuments = useMemo(() => crmDocuments.filter(d => d.uploaderId === displayedUserId), [crmDocuments, displayedUserId]);

  const currentLevelFolders = useMemo(() => userFolders.filter(f => f.parentId === currentFolderId), [userFolders, currentFolderId]);
  const currentLevelDocuments = useMemo(() => userDocuments.filter(d => d.folderId === currentFolderId), [userDocuments, currentFolderId]);

  const breadcrumbs: { id: string | undefined, name: string }[] = useMemo(() => {
    const crumbs = [];
    let curr = currentFolderId;
    while (curr) {
      const f = userFolders.find(folder => folder.id === curr);
      if (f) {
        crumbs.unshift({ id: f.id, name: f.name });
        curr = f.parentId;
      } else {
        break;
      }
    }
    return [{ id: undefined, name: 'Racine' }, ...crumbs];
  }, [currentFolderId, userFolders]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        await addCrmDocument(file, displayedUserId, currentFolderId);
      } catch (err) {
        console.error("Erreur d'upload :", err);
        alert('Erreur lors de l\'ajout du document.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !displayedUserId) return;
    await addCrmFolder(newFolderName.trim(), displayedUserId, currentFolderId);
    setShowFolderModal(false);
    setNewFolderName('');
  };

  const handleDeleteFolder = (folder: CrmFolder) => {
    const hasChildren = userFolders.some(f => f.parentId === folder.id) || userDocuments.some(d => d.folderId === folder.id);
    if (hasChildren) {
      alert("Impossible de supprimer un dossier qui n'est pas vide. Veuillez d'abord supprimer son contenu.");
      return;
    }
    confirm({
      title: 'Supprimer le dossier',
      message: `Voulez-vous vraiment supprimer le dossier "${folder.name}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: () => deleteCrmFolder(folder.id)
    });
  };

  const handleDeleteDocument = (doc: CrmDocument) => {
    confirm({
      title: 'Supprimer le document',
      message: `Voulez-vous vraiment supprimer "${doc.name}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: () => deleteCrmDocument(doc.id)
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>Gestion Documentaire</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isAdmin && (
            <select 
              className="input" 
              value={selectedUserId} 
              onChange={e => { setSelectedUserId(e.target.value); setCurrentFolderId(undefined); }}
              style={{ minWidth: '200px' }}
            >
              <option value="">Sélectionner un utilisateur...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          )}

          <button className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
            <FolderPlus size={16} style={{ marginRight: '8px' }} /> Nouveau dossier
          </button>
          
          <button className="btn btn-primary" onClick={handleUploadClick} disabled={uploading}>
            <Upload size={16} style={{ marginRight: '8px' }} /> {uploading ? 'Upload en cours...' : 'Uploader'}
          </button>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id || 'root'}>
            <span 
              onClick={() => setCurrentFolderId(crumb.id)} 
              style={{ cursor: 'pointer', color: idx === breadcrumbs.length - 1 ? 'var(--color-text)' : 'var(--color-primary)', fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400 }}
            >
              {crumb.name}
            </span>
            {idx < breadcrumbs.length - 1 && <ChevronRight size={14} />}
          </React.Fragment>
        ))}
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Date</th>
                <th>Taille</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Dossiers */}
              {currentLevelFolders.map(folder => (
                <tr key={folder.id} style={{ cursor: 'pointer' }} onClick={() => setCurrentFolderId(folder.id)}>
                  <td data-label="Nom" style={{ fontWeight: 500, color: 'var(--color-primary)' }}>
                    <Folder size={16} style={{ verticalAlign: 'middle', marginRight: '8px', fill: 'var(--color-primary-tint)' }} /> 
                    {folder.name}
                  </td>
                  <td data-label="Type">Dossier de fichiers</td>
                  <td data-label="Date">{new Date(folder.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td data-label="Taille">-</td>
                  <td data-label="Actions" onClick={e => e.stopPropagation()}>
                    <button className="icon-button text-error" onClick={() => handleDeleteFolder(folder)} title="Supprimer le dossier">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Fichiers */}
              {currentLevelDocuments.map(doc => (
                <tr key={doc.id}>
                  <td data-label="Nom"><FileText size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-text-muted)' }} /> {doc.name}</td>
                  <td data-label="Type">{doc.type}</td>
                  <td data-label="Date">{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td data-label="Taille">{formatSize(doc.sizeBytes)}</td>
                  <td data-label="Actions">
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => downloadCrmDocument(doc)} title="Télécharger">
                      <Download size={16} />
                    </button>
                    <button className="icon-button text-error" onClick={() => handleDeleteDocument(doc)} title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {currentLevelFolders.length === 0 && currentLevelDocuments.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    <Folder size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <div>Ce dossier est vide.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showFolderModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowFolderModal(false)}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '0 16px' }}>
            <h3>Nouveau dossier</h3>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Nom du dossier</label>
              <input 
                type="text" 
                className="input" 
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Ex: Factures, Devis, Images..."
              />
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
