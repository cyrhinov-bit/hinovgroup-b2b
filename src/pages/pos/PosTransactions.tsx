import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import { Search, RotateCcw, XCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { PosTransaction } from '../../context/AppContext';

export default function PosTransactions() {
  const { posTransactions, posCashSessions, voidPosTransaction, clearPosSalesHistory } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const openSession = posCashSessions.find(s => s.status === 'Ouverte');

  const filtered = posTransactions.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.transactionNumber.toLowerCase().includes(q) || t.date.includes(q);
  }).sort((a, b) => b.date.localeCompare(a.date));

  const role = currentUser?.role;

  const canVoid = (t: PosTransaction) => {
    if (t.status !== 'Validée') return false;
    if (role === 'Directeur' || role === 'Gerant') return true;
    if (role === 'Caissier') {
      return !!openSession && t.cashierId === currentUser?.id && t.sessionId === openSession.id;
    }
    return false;
  };

  const canReturn = (t: PosTransaction) => {
    return t.status === 'Validée' && (role === 'Directeur' || role === 'Gerant');
  };

  const handleVoid = (t: PosTransaction) => {
    confirm({
      title: 'Annuler la vente',
      message: `Voulez-vous annuler la vente ${t.transactionNumber} d'un montant de ${t.total.toLocaleString()} FCFA ? Le stock sera restauré et la transaction passera en « Annulée ».`,
      variant: 'warning',
      confirmLabel: 'Annuler la vente',
      onConfirm: async () => {
        await voidPosTransaction(t.id);
      },
    });
  };

  const handleClearHistory = () => {
    confirm({
      title: "Supprimer l'historique des ventes",
      message: "Êtes-vous sûr de vouloir supprimer définitivement toutes les transactions de vente, les lignes associées, les paiements et l'historique des retours ?",
      variant: 'danger',
      confirmLabel: "Supprimer tout l'historique",
      onConfirm: async () => {
        await clearPosSalesHistory();
      },
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/pos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', color: 'var(--color-text)' }} title="Retour au tableau de bord">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Historique des Ventes</h1>
        </div>
        {(role === 'Directeur' || role === 'Gerant') && posTransactions.length > 0 && (
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={handleClearHistory}>
            Vider l'historique des ventes
          </Button>
        )}
      </div>
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input autoFocus style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }} placeholder="Rechercher par numéro ou date..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>N° Transaction</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Articles</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Paiement</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Statut</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Total</th>
            <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace' }}>{t.transactionNumber}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{new Date(t.date).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{t.lines.length} article(s)</td>
                <td style={{ padding: '12px 16px' }}><Badge variant="info">{t.payments[0]?.method || 'N/A'}</Badge></td>
                <td style={{ padding: '12px 16px' }}><Badge variant={t.status === 'Validée' ? 'success' : 'danger'}>{t.status}</Badge></td>
                <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{t.total.toLocaleString()} FCFA</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {canReturn(t) && (
                      <button onClick={() => navigate('/pos/returns', { state: { selectedTxId: t.id } })} style={{ padding: '4px 8px', background: 'var(--color-warning-tint)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-warning-strong)' }}>
                        <RotateCcw size={12} /> Retour
                      </button>
                    )}
                    {canVoid(t) && (
                      <button onClick={() => handleVoid(t)} style={{ padding: '4px 8px', background: 'var(--color-error-tint)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-error)' }}>
                        <XCircle size={12} /> Annuler
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucune transaction</td></tr>}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}