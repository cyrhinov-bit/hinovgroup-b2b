import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Wallet, Plus } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

export default function PosCash() {
  const { posCashSessions, posTransactions, posReturns, addPosCashSession, updatePosCashSession } = useAppContext();
  const { currentUser } = useAuth();

  const [showOpen, setShowOpen] = useState(false);
  const [initialFund, setInitialFund] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [finalAmount, setFinalAmount] = useState('');

  const openSession = posCashSessions.find(s => s.status === 'Ouverte');
  const closedSessions = posCashSessions
    .filter(s => s.status === 'Fermée')
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  const validTx = posTransactions.filter(t => t.status === 'Validée');

  // Seule la part encaissée en espèces (ou mixte) doit apparaître dans la caisse physique.
  // Les paiements Carte / Mobile Money ne passent pas par le tiroir-caisse.
  const cashOfTransaction = (t: typeof posTransactions[number]) => {
    const cashPayments = t.payments
      .filter(p => p.method === 'Espèces' || p.method === 'Mixte')
      .reduce((a, p) => a + p.amount, 0);
    return cashPayments > 0 ? cashPayments : (t.payments.length === 0 ? t.total : 0);
  };

  const sessionReturns = openSession ? posReturns
    .filter(r => r.status === 'Traité' && r.sessionId === openSession.id)
    .reduce((s, r) => s + r.totalRefund, 0) : 0;
  const sessionSales = openSession ? validTx.filter(t => t.sessionId === openSession.id).reduce((s, t) => s + cashOfTransaction(t), 0) : 0;
  const expectedAmount = openSession ? openSession.initialFund + sessionSales - sessionReturns : 0;
  const diffPreview = Number(finalAmount || 0) - expectedAmount;

  const handleOpen = async () => {
    const fund = Number(initialFund);
    if (isNaN(fund) || fund < 0 || initialFund === '') {
      alert('Le fonds de caisse doit être supérieur ou égal à 0.');
      return;
    }
    await addPosCashSession({
      id: uuidv4(),
      cashierId: currentUser?.id,
      openedAt: new Date().toISOString(),
      initialFund: fund,
      status: 'Ouverte',
    });
    setShowOpen(false);
    setInitialFund('');
  };

  const handleClose = async () => {
    if (!openSession) return;
    const final = Number(finalAmount);
    if (finalAmount === '' || Number.isNaN(final)) {
      alert('Veuillez saisir le montant réel en caisse.');
      return;
    }
    const difference = final - expectedAmount;
    await updatePosCashSession(openSession.id, {
      closedAt: new Date().toISOString(),
      finalAmount: final,
      expectedAmount,
      difference,
      status: 'Fermée',
    });
    setShowClose(false);
    setFinalAmount('');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    fontSize: '14px',
    outline: 'none',
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR');
  const formatMoney = (v: number) => `${v.toLocaleString()} FCFA`;

  const sessionExpected = (s: typeof posCashSessions[number]) => {
    const tx = validTx.filter(t => t.sessionId === s.id).reduce((sum, t) => sum + cashOfTransaction(t), 0);
    const rt = posReturns
      .filter(r => r.status === 'Traité' && r.sessionId === s.id)
      .reduce((sum, r) => sum + r.totalRefund, 0);
    return s.expectedAmount ?? s.initialFund + tx - rt;
  };
  const sessionDiff = (s: typeof posCashSessions[number]) => s.difference ?? (s.finalAmount || 0) - sessionExpected(s);

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Gestion de caisse</h1>

      {/* Session en cours */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        {openSession ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--color-warning-tint)', borderRadius: '10px', padding: '10px' }}>
                <Wallet size={22} color="var(--color-warning)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Session ouverte</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Ouverte le {formatDate(openSession.openedAt)}
                </div>
              </div>
              <Badge variant="warning">En cours</Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Fond initial</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatMoney(openSession.initialFund)}</div>
              </div>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ventes</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>+{formatMoney(sessionSales)}</div>
              </div>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Retours</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-error)' }}>-{formatMoney(sessionReturns)}</div>
              </div>
              <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Attendu en caisse</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatMoney(expectedAmount)}</div>
              </div>
            </div>

            <Button variant="warning" onClick={() => { setFinalAmount(String(expectedAmount)); setShowClose(true); }}>
              Fermer la caisse
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ background: 'var(--color-primary-tint)', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Wallet size={28} color="var(--color-primary)" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Aucune session ouverte</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Ouvrez la caisse pour commencer à encaisser les ventes.</div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowOpen(true)}>Ouvrir la caisse</Button>
          </div>
        )}
      </div>

      {/* Historique des sessions */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Historique des sessions</h3>
        {closedSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>Aucune session clôturée</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Ouverture</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Clôture</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Fond initial</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Attendu</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Réel</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Écart</th>
                  <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {closedSessions.map(s => {
                  const expected = sessionExpected(s);
                  const diff = sessionDiff(s);
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{formatDate(s.openedAt)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{s.closedAt ? formatDate(s.closedAt) : '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{formatMoney(s.initialFund)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(expected)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{(s.finalAmount || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600, color: diff === 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {diff === 0 ? 'Équilibré' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}><Badge variant="success">Clôturée</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
</div>
          </div>
        )}
      </div>

      {/* Modal ouverture */}
      <Modal
        open={showOpen}
        onClose={() => setShowOpen(false)}
        title="Ouvrir la caisse"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleOpen}>Ouvrir</Button>
          </>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Fonds de caisse initial (FCFA)</div>
          <input
            autoFocus
            style={inputStyle}
            type="text"
            inputMode="numeric"
            value={initialFund}
            onChange={e => setInitialFund(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleOpen(); }}
            placeholder="Ex : 50000"
          />
        </div>
      </Modal>

      {/* Modal fermeture */}
      <Modal
        open={showClose}
        onClose={() => setShowClose(false)}
        title="Fermer la caisse"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowClose(false)}>Annuler</Button>
            <Button variant="warning" onClick={handleClose}>Fermer la caisse</Button>
          </>
        }
      >
        <div style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px', fontSize: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Montant attendu</span>
            <span style={{ fontWeight: 600 }}>{formatMoney(expectedAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Écart prévisionnel</span>
            <span style={{ fontWeight: 600, color: diffPreview === 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              {diffPreview === 0 ? 'Équilibré' : `${diffPreview > 0 ? '+' : ''}${formatMoney(diffPreview)}`}
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Montant réel en caisse (FCFA)</div>
          <input
            autoFocus
            style={inputStyle}
            type="text"
            inputMode="numeric"
            value={finalAmount}
            onChange={e => setFinalAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex : 150000"
          />
        </div>
      </Modal>
    </div>
  );
}
