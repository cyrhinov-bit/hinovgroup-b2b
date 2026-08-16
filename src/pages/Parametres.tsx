import React, { useState } from 'react';
import { Save, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useConfirm } from '../components/ConfirmModal';

export function Parametres() {
  const { settings, updateSettings } = useAppContext();
  const { confirm } = useConfirm();
  const [localSettings, setLocalSettings] = useState(settings);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalSettings({ ...localSettings, headerLogoBase64: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    confirm({
      title: 'Enregistrer les paramètres',
      message: 'Souhaitez-vous enregistrer les modifications apportées aux paramètres de l\'application ?',
      confirmLabel: 'Enregistrer',
      variant: 'info',
      onConfirm: async () => {
        await updateSettings(localSettings);
      }
    });
  };

  return (
    <div className="dashboard">
      <h2>Paramètres de l'application</h2>

      <div className="card" style={{ maxWidth: '800px', padding: 'var(--spacing-5)' }}>
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '16px' }}>Identité de l'entreprise</h3>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Logo / Modèle d'en-tête (Téléversable)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {localSettings.headerLogoBase64 ? (
                <img src={localSettings.headerLogoBase64} alt="En-tête" style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '4px' }} />
              ) : (
                <div style={{ width: '150px', height: '60px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '4px' }}>Aucun logo</div>
              )}
              <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Upload size={16} style={{ marginRight: '8px' }} />
                Téléverser
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
              {localSettings.headerLogoBase64 && (
                <button className="btn btn-secondary" onClick={() => setLocalSettings({ ...localSettings, headerLogoBase64: undefined })}>Supprimer</button>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>Cette image remplacera le texte d'en-tête sur le portail client.</p>
          </div>

          <div className="responsive-form-grid">
            <div className="form-group">
              <label>Nom de l'entreprise</label>
              <input type="text" className="table-input" value={localSettings.companyName} onChange={e => setLocalSettings({...localSettings, companyName: e.target.value})} />
            </div>
            <div className="form-group">
              <label>RCCM</label>
              <input type="text" className="table-input" value={localSettings.companySiret} onChange={e => setLocalSettings({...localSettings, companySiret: e.target.value})} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Adresse siège social</label>
              <input type="text" className="table-input" value={localSettings.companyAddress} onChange={e => setLocalSettings({...localSettings, companyAddress: e.target.value})} />
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '16px' }}>Configuration des devis</h3>
          <div className="responsive-form-grid">
            <div className="form-group">
              <label>Durée de validité par défaut (jours)</label>
              <input type="number" className="table-input" value={localSettings.defaultValidity} onChange={e => setLocalSettings({...localSettings, defaultValidity: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Taux de commission commerciale (%)</label>
              <input type="number" className="table-input" value={localSettings.commissionRate} onChange={e => setLocalSettings({...localSettings, commissionRate: Number(e.target.value)})} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>URL du site / Domaine personnalisé pour les liens de devis</label>
              <input
                type="url"
                className="table-input"
                placeholder="Ex: https://devis.votre-entreprise.com"
                value={localSettings.siteUrl || ''}
                onChange={e => setLocalSettings({ ...localSettings, siteUrl: e.target.value })}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Laisser vide pour utiliser automatiquement l'URL courante de votre navigateur.
              </p>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Mentions légales par défaut</label>
              <textarea className="table-input" rows={4} value={localSettings.defaultTerms} onChange={e => setLocalSettings({...localSettings, defaultTerms: e.target.value})} />
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            className="btn" 
            style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
            onClick={() => {
              confirm({
                title: 'Vider le cache local',
                message: 'Voulez-vous vraiment supprimer toutes les données locales de l\'interface ? Cela ne supprimera pas les données sur Supabase, mais réinitialisera l\'interface pour vos tests.',
                confirmLabel: 'Vider le cache',
                variant: 'danger',
                onConfirm: async () => {
                  const { db } = await import('../lib/db');
                  for (const key of Object.keys(db)) {
                    await (db as any)[key].clear();
                  }
                  window.location.reload();
                }
              });
            }}
          >
            Vider le cache local (Test)
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} style={{ marginRight: '8px' }} /> Enregistrer les paramètres
          </button>
        </div>
      </div>
    </div>
  );
}
