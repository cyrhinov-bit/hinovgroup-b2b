import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Save, CheckCircle2 } from 'lucide-react';

export default function PosSettings() {
  const { posSettings, updatePosSettings } = useAppContext();
  const [form, setForm] = useState(posSettings);
  const [saved, setSaved] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Resynchroniser le formulaire si les paramètres chargent après le montage
  useEffect(() => {
    setForm(posSettings);
  }, [posSettings]);

  const handleSave = async () => {
    await updatePosSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' };

  return (
    <div style={{ padding: '24px', maxWidth: '640px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Paramètres POS</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }}
            onClick={() => setShowClearModal(true)}
          >
            Vider le cache local (Test)
          </button>
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }}>
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="responsive-form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Nom de la librairie</div>
            <input style={inputStyle} value={form.libraryName} onChange={e => setForm({ ...form, libraryName: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Adresse</div>
            <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Téléphone</div>
            <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Devise</div>
            <input style={inputStyle} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Type d'imprimante</div>
            <select style={inputStyle} value={form.printerType} onChange={e => setForm({ ...form, printerType: e.target.value })}>
              <option>Thermique 58mm</option>
              <option>Thermique 80mm</option>
              <option>A4</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Message sur le ticket</div>
            <textarea style={{ ...inputStyle, minHeight: '80px' }} value={form.ticketMessage} onChange={e => setForm({ ...form, ticketMessage: e.target.value })} />
          </div>
        </div>
      </div>
      
      {showClearModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-lg)', width: '400px', maxWidth: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Confirmer la réinitialisation</h3>
            <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: '1.5' }}>Voulez-vous vraiment supprimer toutes les données locales de l'interface ? Cela réinitialisera l'interface pour vos tests.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowClearModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Annuler</button>
              <button onClick={() => {
                import('../../lib/db').then(async ({ db }) => {
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
                });
              }} style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-error)', color: 'white', cursor: 'pointer', fontWeight: 500 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
