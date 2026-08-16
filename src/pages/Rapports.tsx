import React, { useMemo, useState } from 'react';
import { Download, CheckCircle2, FileText, Users, Target, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { generateWeeklyReportPdf, buildWeeklyReportPdf } from '../lib/pdfUtils';
import { generateV2WeeklyReportPdf, buildV2WeeklyReportPdf } from '../features/reports/services/ReportPdfService';
import { ReportPdfPreview } from '../components/ReportPdfPreview';
import type { ReportPdfPreviewData } from '../components/ReportPdfPreview';

export function Rapports() {
  const { weeklyReports, activityReports, v2WeeklyReports, users, settings, markWeeklyReportRead } = useAppContext();

  const [filterRole, setFilterRole] = useState<'Tous' | 'Responsable' | 'Commercial'>('Tous');
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  const reports = useMemo(() => {
    // V1 Reports
    const v1 = weeklyReports
      .map(r => ({
        ...r,
        isV2: false,
        author: users.find(u => u.id === r.authorId),
      }));
      
    // V2 Reports
    const v2 = v2WeeklyReports
      .filter(r => r.status === 'Validé') // Only show submitted reports to managers
      .map(r => {
        const author = users.find(u => u.id === r.authorId);
        return {
          ...r,
          isV2: true,
          role: author?.role || 'Inconnu',
          author
        };
      });

    const combined = [...v1, ...v2]
      .filter(r => filterRole === 'Tous' || r.role === filterRole)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      
    return combined;
  }, [weeklyReports, v2WeeklyReports, users, filterRole]);

  const handleDownload = (report: any) => {
    if (report.isV2) {
      generateV2WeeklyReportPdf(report, report.author, settings);
    } else {
      const daily = activityReports.filter(r => r.authorId === report.authorId && r.role === report.role && r.date >= report.weekStart);
      const kpis = report.kpis || {};
      generateWeeklyReportPdf(report, daily, kpis, report.author || null, settings);
    }
  };

  const handlePreview = (report: any) => {
    if (report.isV2) {
      const doc = buildV2WeeklyReportPdf(report, report.author, settings);
      const safeName = report.author?.name ? report.author.name.replace(/\s+/g, '_') : 'Inconnu';
      setPreview({
        dataUrl: doc.output('dataurlstring'),
        filename: `Rapport_Hebdomadaire_${safeName}_${report.weekStart}.pdf`,
        title: `Aperçu — Rapport hebdomadaire V2 (${report.author?.name || 'Expéditeur'})`,
      });
    } else {
      const daily = activityReports.filter(r => r.authorId === report.authorId && r.role === report.role && r.date >= report.weekStart);
      const kpis = report.kpis || {};
      const doc = buildWeeklyReportPdf(report, daily, kpis, report.author || null, settings);
      setPreview({
        dataUrl: doc.output('dataurlstring'),
        filename: `Rapport_Hebdomadaire_${report.weekStart}.pdf`,
        title: `Aperçu — Rapport hebdomadaire V1 (${report.author?.name || 'Expéditeur'})`,
      });
    }
  };

  const handleMarkRead = async (report: any) => {
    if (!report.isV2) {
      await markWeeklyReportRead(report.id);
    }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Rapports & Statistiques</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Rapports hebdomadaires reçus de vos responsables et commerciaux (V1 & V2).
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
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Expéditeur</th>
                <th>Rôle</th>
                <th>Semaine / Projet</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td data-label="Expéditeur">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {r.author?.photo ? (
                        <img src={r.author.photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="avatar-lg" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{r.author?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>
                      )}
                      <span><FileText size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {r.author?.name || 'Inconnu'} {r.isV2 && <small style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>(V2)</small>}</span>
                    </div>
                  </td>
                  <td data-label="Rôle">{r.role}</td>
                  <td data-label="Semaine / Projet">
                    Semaine du {new Date(r.weekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    {r.isV2 && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Projet: {(r as any).project}</div>}
                  </td>
                  <td data-label="Statut">
                    <span className={`badge-status ${r.status === 'Envoyé' || r.status === 'Validé' ? 'bg-success' : r.status === 'Relu' ? 'bg-primary' : 'bg-warning'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handlePreview(r)} title="Prévisualiser">
                      <Eye size={16} />
                    </button>
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handleDownload(r)} title="Télécharger PDF">
                      <Download size={16} />
                    </button>
                    {!r.isV2 && r.status !== 'Relu' && (
                      <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => handleMarkRead(r)} title="Marquer comme relu">
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
            <div className="widget-label">TOTAL RAPPORTS</div>
            <div className="widget-value">{reports.length}</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-success"><CheckCircle2 size={32} color="white" /></div>
          <div className="widget-content">
            <div className="widget-label">RAPPORTS (V2)</div>
            <div className="widget-value">{reports.filter(r => r.isV2).length}</div>
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