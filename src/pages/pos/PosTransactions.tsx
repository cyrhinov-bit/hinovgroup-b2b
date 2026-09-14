import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import { Search, RotateCcw, XCircle, ArrowLeft, Trash2, Calendar, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { PosTransaction } from '../../context/AppContext';
import { matchesSearchQuery } from '../../lib/searchUtils';
import { getWeekKey, formatWeekLabel, isCurrentWeek } from '../../lib/dates';

export default function PosTransactions() {
  const { posTransactions, posCashSessions, voidPosTransaction, clearPosSalesHistory } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('all');
  const navigate = useNavigate();

  const currentWeekKey = getWeekKey(new Date());

  const openSession = posCashSessions.find(s => s.status === 'Ouverte');

  const filtered = useMemo(() => {
    return posTransactions.filter(t => {
      if (!search || !search.trim()) return true;
      return matchesSearchQuery([
        t.transactionNumber, 
        t.date, 
        t.status, 
        String(t.total),
        t.lines?.map(l => l.description).join(' ')
      ], search);
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [posTransactions, search]);

  // Regroupement des ventes par semaine (du lundi au dimanche)
  const transactionsByWeek = useMemo(() => {
    const map = new Map<string, PosTransaction[]>();

    filtered.forEach(t => {
      const key = getWeekKey(t.date);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(t);
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map(key => {
      const list = map.get(key)!;
      const validTxs = list.filter(t => t.status === 'Validée');
      const voidedTxs = list.filter(t => t.status === 'Annulée');
      const totalRevenue = validTxs.reduce((sum, t) => sum + t.total, 0);

      return {
        weekKey: key,
        label: formatWeekLabel(list[0].date),
        isCurrent: key === currentWeekKey,
        transactions: list,
        txCount: list.length,
        validCount: validTxs.length,
        voidCount: voidedTxs.length,
        totalRevenue,
      };
    });
  }, [filtered, currentWeekKey]);

  // Filtrage selon le sélecteur de semaine
  const displayedWeekGroups = useMemo(() => {
    if (selectedWeekFilter === 'all') return transactionsByWeek;
    return transactionsByWeek.filter(w => w.weekKey === selectedWeekFilter);
  }, [transactionsByWeek, selectedWeekFilter]);

  // État des semaines dépliées : par défaut la semaine en cours est ouverte
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(() => {
    return { [currentWeekKey]: true };
  });

  // Si l'utilisateur fait une recherche, déplier automatiquement toutes les semaines qui contiennent des résultats
  useEffect(() => {
    if (search && search.trim() !== '') {
      const next: Record<string, boolean> = {};
      transactionsByWeek.forEach(w => { next[w.weekKey] = true; });
      setExpandedWeeks(next);
    }
  }, [search, transactionsByWeek]);

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const expandAllWeeks = () => {
    const next: Record<string, boolean> = {};
    displayedWeekGroups.forEach(w => { next[w.weekKey] = true; });
    setExpandedWeeks(next);
  };

  const collapseAllWeeks = () => {
    setExpandedWeeks({});
  };

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
    <div className="pos-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/pos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', color: 'var(--color-text)' }} title="Retour au tableau de bord">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Historique des Ventes</h1>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {posTransactions.length} transaction(s) archivée(s) par semaine
            </div>
          </div>
        </div>
        {(role === 'Directeur' || role === 'Gerant') && posTransactions.length > 0 && (
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={handleClearHistory}>
            Vider l'historique des ventes
          </Button>
        )}
      </div>

      {/* Barre de recherche et filtres de semaine */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            autoFocus
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }}
            placeholder="Rechercher par n° de ticket, date, article, montant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {transactionsByWeek.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedWeekFilter}
              onChange={e => setSelectedWeekFilter(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'white',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Toutes les semaines ({transactionsByWeek.length})</option>
              {transactionsByWeek.map(w => (
                <option key={w.weekKey} value={w.weekKey}>
                  {w.label} {w.isCurrent ? '(En cours)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={expandAllWeeks}
              style={{
                background: 'white',
                border: '1px solid var(--color-border)',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--color-text)'
              }}
            >
              Tout déplier
            </button>
            <button
              type="button"
              onClick={collapseAllWeeks}
              style={{
                background: 'white',
                border: '1px solid var(--color-border)',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--color-text)'
              }}
            >
              Tout replier
            </button>
          </div>
        )}
      </div>

      {/* Liste des semaines archivées */}
      {displayedWeekGroups.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <Archive size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div style={{ fontSize: '15px', fontWeight: 500 }}>Aucune transaction trouvée</div>
          {search && <div style={{ fontSize: '13px', marginTop: '4px' }}>Essayez d'ajuster votre recherche.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedWeekGroups.map(weekGroup => {
            const isExpanded = !!expandedWeeks[weekGroup.weekKey];
            return (
              <div
                key={weekGroup.weekKey}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  border: '1px solid var(--color-border)'
                }}
              >
                {/* Entête accordéon de la semaine */}
                <div
                  onClick={() => toggleWeek(weekGroup.weekKey)}
                  style={{
                    padding: '14px 18px',
                    background: weekGroup.isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface-alt)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
                    userSelect: 'none',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ color: isExpanded ? 'var(--color-primary)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="var(--color-primary)" />
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
                        {weekGroup.label}
                      </span>
                    </div>
                    {weekGroup.isCurrent ? (
                      <Badge variant="info">Cette semaine</Badge>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Archivée
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      <strong>{weekGroup.txCount}</strong> vente(s) {weekGroup.voidCount > 0 && `(${weekGroup.voidCount} annulée)`}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-success-tint)',
                        color: 'var(--color-success)',
                      }}
                    >
                      CA : {weekGroup.totalRevenue.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                {/* Tableau des transactions de la semaine */}
                {isExpanded && (
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: '#fafafa' }}>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>N° Transaction</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date & Heure</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Articles</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Paiement</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Statut</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekGroup.transactions.map(t => (
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
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}