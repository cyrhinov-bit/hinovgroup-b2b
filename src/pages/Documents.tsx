import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { useConfirm } from '../components/ConfirmModal';

import { useAppContext, type CrmDocument } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function Documents() {
  const { confirm } = useConfirm();
  const { crmDocuments, addCrmDocument, deleteCrmDocument, downloadCrmDocument } = useAppContext();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        await addCrmDocument(file, currentUser?.id);
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

  const handleDownload = (doc: CrmDocument) => {
    downloadCrmDocument(doc);
  };

  const handleDelete = (doc: CrmDocument) => {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Gestion Documentaire</h2>
        <button className="btn btn-primary" onClick={handleUploadClick} disabled={uploading}>
          <Upload size={16} style={{ marginRight: '8px' }} /> {uploading ? 'Upload en cours...' : 'Uploader un document'}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
      </div>

      <div className="card">
        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Nom du fichier</th>
              <th>Type</th>
              <th>Date d'ajout</th>
              <th>Taille</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {crmDocuments.map(doc => (
              <tr key={doc.id}>
                <td><FileText size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {doc.name}</td>
                <td>{doc.type}</td>
                <td>{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</td>
                <td>{formatSize(doc.sizeBytes)}</td>
                <td>
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handleDownload(doc)} title="Télécharger">
                    <Download size={16} />
                  </button>
                  <button className="icon-button text-error" onClick={() => handleDelete(doc)} title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {crmDocuments.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Aucun document.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
