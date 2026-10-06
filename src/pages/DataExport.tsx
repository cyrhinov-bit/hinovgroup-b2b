import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, CheckSquare, Square } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import {
  ALL_EXPORT_KEYS, EXPORT_LABELS,
  exportPosCrmExcel,
  type ExportKey,
} from '../features/reports/services/PosCrmExportService';
import { Button } from '../components/ui/Button';

export default function DataExport() {
  const ctx = useAppContext();
  const [selected, setSelected] = useState<ExportKey[]>([...ALL_EXPORT_KEYS]);
  const [isExporting, setIsExporting] = useState(false);

  const counts: Record<ExportKey, number> = useMemo(() => ({
    pos_produits: ctx.posProducts.length,
    pos_transactions: ctx.posTransactions.length,
    pos_lignes_vente: ctx.posTransactions.reduce((n, t) => n + (t.lines?.length ?? 0), 0),
    pos_paiements: ctx.posTransactions.reduce((n, t) => n + (t.payments?.length ?? 0), 0) + ctx.posPayments.length,
    pos_retours: ctx.posReturns.length,
    pos_mouvements_stock: ctx.posStockMovements.length,
    pos_sessions_caisse: ctx.posCashSessions.length,
    pos_fournisseurs: ctx.posSuppliers.length,
    crm_tiers: ctx.crmTiers.length,
    crm_commerciaux: ctx.crmCommerciaux.length,
    crm_prestations: ctx.crmPrestations.length,
    crm_caisse: ctx.crmCaisse.length,
    crm_commissions: ctx.crmCommissions.length,
    crm_catalogue: ctx.crmArticles.length,
    crm_maintenance: ctx.crmMaintenance.length,
    crm_techniciens: ctx.crmTechniciens.length,
    crm_factures: ctx.invoices.length,
    crm_clients: ctx.clients.length,
    crm_affaires: ctx.affaires.length,
    crm_devis: ctx.quotes.length,
    crm_ventes: ctx.sales.length,
  }), [ctx]);

  const toggle = (key: ExportKey) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const selectGroup = (group: 'POS' | 'CRM') =>
    setSelected(prev => Array.from(new Set([...prev, ...ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === group)])));
  const deselectGroup = (group: 'POS' | 'CRM') =>
    setSelected(prev => prev.filter(k => EXPORT_LABELS[k].group !== group));

  const handleExport = async (keys: ExportKey[]) => {
    if (keys.length === 0) {
      toast.error('Sélectionnez au moins un module à exporter');
      return;
    }
    setIsExporting(true);
    try {
      const fileName = exportPosCrmExcel({
        posProducts: ctx.posProducts,
        posTransactions: ctx.posTransactions,
        posPayments: ctx.posPayments,
        posReturns: ctx.posReturns,
        posStockMovements: ctx.posStockMovements,
        posCashSessions: ctx.posCashSessions,
        posSuppliers: ctx.posSuppliers,
        crmTiers: ctx.crmTiers,
        crmCommerciaux: ctx.crmCommerciaux,
        crmPrestations: ctx.crmPrestations,
        crmCaisse: ctx.crmCaisse,
        crmCommissions: ctx.crmCommissions,
        crmArticles: ctx.crmArticles,
        crmMaintenance: ctx.crmMaintenance,
        crmTechniciens: ctx.crmTechniciens,
        invoices: ctx.invoices,
        clients: ctx.clients,
        affaires: ctx.affaires,
        quotes: ctx.quotes,
        sales: ctx.sales,
      }, keys);
      toast.success(`Export généré : ${fileName}`);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const renderGroup = (group: 'POS' | 'CRM') => (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
          {group === 'POS' ? '🛒 Données POS' : '💼 Données CRM'}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => selectGroup(group)}>Tout</button>
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => deselectGroup(group)}>Aucun</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
        {ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === group).map(key => {
          const active = selected.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                border: active ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: active ? 'var(--color-primary-tint)' : 'white',
              }}
            >
              {active ? <CheckSquare size={18} color="var(--color-primary)" /> : <Square size={18} color="var(--color-text-muted)" />}
              <span>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{EXPORT_LABELS[key].label}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {counts[key].toLocaleString('fr-FR')} ligne(s) → feuille {EXPORT_LABELS[key].sheet}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={26} /> Centre d'export POS + CRM
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Un seul fichier Excel multi-onglets (une feuille par module). Les données exportées sont celles chargées localement (pensez à synchroniser avant).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setSelected([...ALL_EXPORT_KEYS])}>Tout sélectionner</Button>
          <Button variant="secondary" onClick={() => setSelected([])}>Tout désélectionner</Button>
          <Button variant="primary" icon={<Download size={16} />} onClick={() => handleExport(selected)} disabled={isExporting || selected.length === 0}>
            {isExporting ? 'Export...' : `Exporter (${selected.length})`}
          </Button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => handleExport(ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === 'POS'))} disabled={isExporting}>
          Export POS seul ({ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === 'POS').length} feuilles)
        </Button>
        <Button variant="secondary" onClick={() => handleExport(ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === 'CRM'))} disabled={isExporting}>
          Export CRM seul ({ALL_EXPORT_KEYS.filter(k => EXPORT_LABELS[k].group === 'CRM').length} feuilles)
        </Button>
      </div>

      {renderGroup('POS')}
      {renderGroup('CRM')}

      <div className="card" style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        <strong>Exports rapides déjà existants :</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
          <li>POS → Produits → onglet « Import / Export » : catalogue seul (<em>catalogue-produits-AAAA-MM-JJ.xlsx</em>).</li>
          <li>Factures → « Exporter Excel » : registre mensuel 13 colonnes (<em>SUIVI_FACTURES_CLIENTS_MOIS_ANNEE.xlsx</em>).</li>
          <li>CRM → Rapports hebdo : export PDF du rapport.</li>
        </ul>
      </div>
    </div>
  );
}
