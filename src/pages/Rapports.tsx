import React, { useMemo, useState } from 'react';
import { Download, CheckCircle2, FileText, Users, Target, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { generateWeeklyReportPdf, buildWeeklyReportPdf } from '../lib/pdfUtils';
import { ReportPdfPreview } from '../components/ReportPdfPreview';
import type { ReportPdfPreviewData } from '../components/ReportPdfPreview';

export function Rapports() {
  const { weeklyReports, activityReports, users, settings, markWeeklyReportRead } = useAppContext();

  const [filterRole, setFilterRole] = useState<'Tous' | 'Responsable' | 'Commercial'>('Tous');
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  const reports = useMemo(() => {
    const filtered = weeklyReports
      .filter(r => filterRole === 'Tous' || r.role === filterRole)
      .map(r => ({
        ...r,
        author: users.find(u => u.id === r.authorId),
      }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    return filtered;
  }, [weeklyReports, users, filterRole]);

  const handleDownload = (report: any) => {
    const daily = activityReports.filter(r => r.authorId === report.authorId && r.role === report.role && r.date >= report.weekStart);
    const kpis = report.kpis || {};
    generateWeeklyReportPdf(report, daily, kpis, report.author || null, settings);
  };

  const handlePreview = (report: any) => {
    const daily = activityReports.filter(r => r.authorId === report.authorId && r.role === report.role && r.date >= report.weekStart);
    const kpis = report.kpis || {};
    const doc = buildWeeklyReportPdf(report, daily, kpis, report.author || null, settings);
    setPreview({
      dataUrl: doc.output('dataurlstring'),
      filename: `Rapport_Hebdomadaire_${report.weekStart}.pdf`,
      title: `Aperçu — Rapport hebdomadaire (${report.author?.name || 'Expéditeur'})`,
    });
  };

  const handleMarkRead = async (id: string) => {
    await markWeeklyReportRead(id);
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Rapports & Statistiques</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Rapports hebdomadaires reçus de vos responsables et commerciaux.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select className="form-control" value={filterRole} onChange={e => setFilterRole(e.target.value as any)} style={{ width: '160px' }}>
            <option value="Tous">Tous</option>
            <option value="Responsable">Responsables</option>
            <option value="Commercial">Commerciaux</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Expéditeur</th>
              <th>Rôle</th>
              <th>Semaine</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {r.author?.photo ? (
                      <img src={r.author.photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div className="avatar-lg" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{r.author?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    )}
                    <span><FileText size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {r.author?.name || 'Inconnu'}</span>
                  </div>
                </td>
                <td>{r.role}</td>
                <td>Semaine du {new Date(r.weekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td>
                <td>
                  <span className={`badge-status ${r.status === 'Envoyé' ? 'bg-success' : r.status === 'Relu' ? 'bg-primary' : 'bg-warning'}`}>{r.status}</span>
                </td>
                <td>
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handlePreview(r)} title="Prévisualiser">
                    <Eye size={16} />
                  </button>
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handleDownload(r)} title="Télécharger PDF">
                    <Download size={16} />
                  </button>
                  {r.status !== 'Relu' && (
                    <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => handleMarkRead(r.id)} title="Marquer comme relu">
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                  Aucun rapport hebdomadaire reçu pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>

      <div className="widgets-grid" style={{ marginTop: '24px' }}>
        <div className="widget-card">
          <div className="widget-icon bg-info"><FileText size={32} color="white" /></div>
          <div className="widget-content">
            <div className="widget-label">RAPPORTS REÇUS</div>
            <div className="widget-value">{weeklyReports.length}</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-success"><CheckCircle2 size={32} color="white" /></div>
          <div className="widget-content">
            <div className="widget-label">RAPPORTS LUES</div>
            <div className="widget-value">{weeklyReports.filter(r => r.status === 'Relu').length}</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-primary"><Users size={32} color="white" /></div>
          <div className="widget-content">
            <div className="widget-label">RESPONSABLES</div>
            <div className="widget-value">{users.filter(u => u.role === 'Responsable' && u.active).length}</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-warning"><Target size={32} color="white" /></div>
          <div className="widget-content">
            <div className="widget-label">COMMERCIAUX</div>
            <div className="widget-value">{users.filter(u => u.role === 'Commercial' && u.active).length}</div>
          </div>
        </div>
      </div>

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}