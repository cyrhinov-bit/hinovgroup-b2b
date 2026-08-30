import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { ShieldAlert, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { queueSyncAction, type SyncAction } from '../../lib/sync';

interface SyncError {
  action: SyncAction;
  failedAt: string;
}

export default function PosSyncErrors() {
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [loading, setLoading] = useState(true);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const stored = (await db.syncErrors.getItem<SyncError[]>('errors')) || [];
      setErrors(stored);
    } catch (e) {
      console.error('Erreur de lecture des syncErrors', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadErrors();
  }, []);

  const clearAll = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer toutes ces erreurs ? Elles seront définitivement perdues.')) return;
    await db.syncErrors.removeItem('errors');
    setErrors([]);
  };

  const retryAction = async (error: SyncError, index: number) => {
    // Retirer de la liste des erreurs
    const newErrors = [...errors];
    newErrors.splice(index, 1);
    await db.syncErrors.setItem('errors', newErrors);
    setErrors(newErrors);

    // Remettre dans la queue de synchronisation avec un nouveau timestamp
    await queueSyncAction(error.action.type, error.action.payload);
    alert('Action remise en file d\'attente de synchronisation.');
  };

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>;

  return (
    <div className="pos-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={24} color="var(--color-error)" />
            Erreurs de Synchronisation
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '14px' }}>
            Affiche les données qui n'ont pas pu être envoyées au serveur à cause d'un refus de sécurité ou d'une anomalie métier.
          </p>
        </div>
        
        {errors.length > 0 && (
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={clearAll}>
            Vider l'historique
          </Button>
        )}
      </div>

      {errors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <ShieldAlert size={48} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Aucune erreur</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Toutes les données ont été synchronisées avec succès avec le serveur.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Type d'Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date d'échec</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Données (Payload)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-error)' }}>
                      {err.action.type}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                      {new Date(err.failedAt).toLocaleString('fr-FR')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={JSON.stringify(err.action.payload, null, 2)}>
                      {JSON.stringify(err.action.payload)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={() => retryAction(err, idx)}>
                        Réessayer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
