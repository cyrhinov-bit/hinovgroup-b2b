import React, { useMemo, useState } from 'react';
import { Download, Calendar, FileText, Sparkles, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext, type V2WeeklyReport } from '../../../../context/AppContext';
import { useAuth } from '../../../../context/AuthContext';
import { generateV2WeeklyReportPdf, getV2WeeklyReportPdfBlobUrl } from '../../services/ReportPdfService';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../../../../components/ReportPdfPreview';

export const ReportsHistory: React.FC = () => {
  const { v2DailyReports, v2WeeklyReports, users, settings } = useAppContext();
  const { currentUser } = useAuth();
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  const isDirector = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '');

  const myDaily = useMemo(() => isDirector ? v2DailyReports : v2DailyReports.filter(r => r.authorId === currentUser?.id), [v2DailyReports, currentUser, isDirector]);
  const myWeekly = useMemo(() => isDirector ? v2WeeklyReports : v2WeeklyReports.filter(r => r.authorId === currentUser?.id), [v2WeeklyReports, currentUser, isDirector]);

  const handlePreviewPdf = (report: V2WeeklyReport) => {
    const author = users?.find((u: any) => u.id === report.authorId) || currentUser;
    const blobUrl = getV2WeeklyReportPdfBlobUrl(report, author, settings);
    const safeName = author?.name ? author.name.toLowerCase().replace(/\s+/g, '_') : 'collaborateur';
    setPreview({
      blobUrl,
      filename: `rapport_hebdo_${safeName}_${report.weekStart}.pdf`,
      title: `Rapport Hebdomadaire — ${author?.name || 'Moi'} (Semaine du ${new Date(report.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')})`,
      onDownload: () => generateV2WeeklyReportPdf(report, author, settings)
    });
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Historique des Rapports</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Consultez les rapports journaliers et hebdomadaires archivés.
          </p>
        </div>
        <Link to="/mon-rapport-hebdo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} /> Rédiger mon Rapport Hebdo (IA)
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Rapports Hebdomadaires */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} /> Rapports Hebdomadaires</h3>
          {myWeekly.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Aucun rapport hebdomadaire trouvé.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myWeekly.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map(report => {
                const author = users?.find((u: any) => u.id === report.authorId);
                return (
                  <div key={report.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>Semaine du {new Date(report.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Projet: {report.project || 'Général'} {isDirector && `• Par: ${author?.name || 'Inconnu'}`}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handlePreviewPdf(report)} title="Lire le document PDF en ligne">
                        <Eye size={16} />
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => generateV2WeeklyReportPdf(report, author || currentUser, settings)} title="Télécharger PDF">
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rapports Journaliers */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> Rapports Journaliers</h3>
          {myDaily.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Aucun rapport journalier trouvé.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myDaily.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50).map(report => {
                const author = users?.find((u: any) => u.id === report.authorId);
                return (
                  <div key={report.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>Date: {new Date(report.date + 'T00:00:00').toLocaleDateString('fr-FR')}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Projet: {report.project} {isDirector && `• Par: ${author?.name}`}</p>
                    </div>
                    <span className="badge-status bg-info">{report.tasks.length} tâches</span>
                  </div>
                );
              })}
              {myDaily.length > 50 && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Affichage limité aux 50 plus récents.</p>}
            </div>
          )}
        </div>
      </div>

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
};
