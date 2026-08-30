import React, { useState, useMemo } from 'react';
import { Save, Upload, Bot, Palette, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { getUserGeminiKey, setUserGeminiKey } from '../lib/geminiKey';
import { THEME_PRESETS, THEME_CATEGORIES, DEFAULT_THEME_COLOR, getUserThemeColor, setUserThemeColor, applyTheme } from '../lib/theme';

export function Parametres() {
  const { settings, updateSettings } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();
  const [localSettings, setLocalSettings] = useState(settings);
  const [geminiKey, setGeminiKey] = useState(() => getUserGeminiKey(currentUser?.id));
  const [selectedThemeColor, setSelectedThemeColor] = useState(() => getUserThemeColor(currentUser?.id));
  const [themeCategory, setThemeCategory] = useState<string>('Tous');

  const filteredThemePresets = useMemo(() => {
    if (themeCategory === 'Tous') return THEME_PRESETS;
    return THEME_PRESETS.filter(p => p.category === themeCategory);
  }, [themeCategory]);

  const handleThemeChange = (hex: string) => {
    setSelectedThemeColor(hex);
    applyTheme(hex);
  };

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
        if (currentUser?.id) {
          setUserGeminiKey(currentUser.id, geminiKey);
          setUserThemeColor(currentUser.id, selectedThemeColor);
        }
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

        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '16px' }}>Paramètres IA (Personnel)</h3>
          <div className="form-group">
            <label>Clé API Gemini Personnelle</label>
            <input 
              type="password" 
              className="table-input" 
              placeholder="Ex: AIzaSy..." 
              value={geminiKey} 
              onChange={e => setGeminiKey(e.target.value)} 
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Cette clé est stockée localement sur votre appareil. Elle sera utilisée pour générer vos rapports d'activités, ce qui permet à chaque utilisateur de gérer sa propre consommation.
            </p>
          </div>
        </section>

        {/* Section Thème & Apparence */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={20} /> Thème & Apparence Personnelle ({THEME_PRESETS.length} nuances)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Personnalisez la couleur primaire de votre interface. Les boutons, accents et menus s'adapteront immédiatement.
          </p>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {THEME_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setThemeCategory(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: themeCategory === cat ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: themeCategory === cat ? 'var(--color-primary)' : '#F8FAFC',
                  color: themeCategory === cat ? '#ffffff' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {filteredThemePresets.map(preset => {
              const isSelected = selectedThemeColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <div
                  key={preset.hex}
                  onClick={() => handleThemeChange(preset.hex)}
                  style={{
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '10px 8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--color-primary-tint)' : '#ffffff',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: preset.hex,
                      margin: '0 auto 6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                    }}
                  >
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>{preset.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{preset.mood}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', maxWidth: '380px' }}>
            <input
              type="color"
              value={selectedThemeColor}
              onChange={e => handleThemeChange(e.target.value)}
              style={{ width: '40px', height: '34px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
            />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nuancier Libre : <span style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{selectedThemeColor.toUpperCase()}</span></div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Cliquez pour choisir n'importe quelle couleur</div>
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
                  const queue = (await db.syncQueue.getItem('queue')) as any[] || [];
                  if (queue.length > 0) {
                    alert(`Attention : ${queue.length} élément(s) en attente de synchronisation. Veuillez patienter ou vous connecter à internet avant de vider le cache, sous peine de perdre ces données.`);
                    return;
                  }
                  
                  const protectedKeys = ['syncQueue', 'syncErrors', 'syncMetadata'];
                  for (const key of Object.keys(db)) {
                    if (!protectedKeys.includes(key)) {
                      await (db as any)[key].clear();
                    }
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
