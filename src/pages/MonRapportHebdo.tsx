import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, FileText, Mail, AlertCircle, Download, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateWeeklyReportPdf, buildWeeklyReportPdf } from '../lib/pdfUtils';
import type { WeeklyReport } from '../context/AppContext';
import { ReportPdfPreview } from '../components/ReportPdfPreview';
import type { ReportPdfPreviewData } from '../components/ReportPdfPreview';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

function getToday(): string {
  return toDateStr(new Date());
}

function computeActivityKPIs(
  authorId: string,
  weekStart: string,
  prospects: any[],
  prospectActivities: any[],
  prospectFollowUps: any[]
) {
  const weekEnd = new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000);
  const inWeek = (date?: string) => !!date && date.slice(0, 10) >= weekStart && date.slice(0, 10) <= toDateStr(weekEnd);

  const myProspects = prospects.filter(p => p.commercialId === authorId);
  const prospectsCrees = myProspects.filter(p => inWeek(p.createdAt?.split('T')[0])).length;
  const prospectsConvertis = myProspects.filter(p => p.status === 'Converti' && inWeek(p.updatedAt?.split('T')[0])).length;
  const prospectsPerdus = myProspects.filter(p => p.status === 'Perdu' && inWeek(p.updatedAt?.split('T')[0])).length;

  const myProspectIds = new Set(myProspects.map(p => p.id));
  const activities = prospectActivities.filter(a => inWeek(a.date?.split('T')[0]) && myProspectIds.has(a.prospectId));
  const counts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const relancesTerminees = prospectFollowUps.filter(f =>
    f.status === 'Terminée' && inWeek(f.date) && myProspectIds.has(f.prospectId)
  ).length;

  return {
    prospectsCrees,
    prospectsConvertis,
    prospectsPerdus,
    relancesTerminees,
    appels: counts['Appel'] || 0,
    emails: counts['Email'] || 0,
    visites: counts['Visite'] || 0,
    reunions: counts['Réunion'] || 0,
    demos: counts['Démonstration'] || 0,
    comptesRendus: counts['Compte rendu'] || 0,
  };
}

export function MonRapportHebdo() {
  const {
    prospects, prospectActivities, prospectFollowUps,
    activityReports, weeklyReports, users,
    saveWeeklyReport, markWeeklyReportSent, settings,
    services, categories
  } = useAppContext();
  const { currentUser } = useAuth();

  const [date, setDate] = useState(getToday());
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  const weekStart = getWeekStart(date);
  const weekEnd = toDateStr(new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000));

  const authorId = currentUser?.id || '';
  const myReports = useMemo(
    () => activityReports.filter(r => r.authorId === authorId && r.role === currentUser?.role),
    [activityReports, authorId, currentUser]
  );
  const weekReports = myReports.filter(r => r.date >= weekStart && r.date <= weekEnd);
  const weekActivity = weekReports.filter(r => r.type === 'Activité');
  
  const weeklyProspects = useMemo(() => {
    return prospects.filter(p => {
      if (p.commercialId !== authorId) return false;
      const createdDate = p.createdAt?.split('T')[0];
      return createdDate && createdDate >= weekStart && createdDate <= weekEnd;
    });
  }, [prospects, authorId, weekStart, weekEnd]);

  const kpis = useMemo(
    () => computeActivityKPIs(authorId, weekStart, prospects, prospectActivities, prospectFollowUps),
    [authorId, weekStart, prospects, prospectActivities, prospectFollowUps]
  );

  const makeWeeklyReport = (status: WeeklyReport['status']): WeeklyReport | null => {
    if (!currentUser) return null;
    const sections = [
      { type: 'Activité' as const, content: weekActivity.map(r => `- ${r.date}: ${r.realisations}`).join('\n') },
    ];
    const existingWeekly = weeklyReports.find(r => r.authorId === currentUser.id && r.weekStart === weekStart);
    return {
      id: existingWeekly?.id || crypto.randomUUID(),
      authorId: currentUser.id,
      role: currentUser.role as WeeklyReport['role'],
      weekStart,
      sections,
      kpis,
      status,
    };
  };

  const handlePreviewWeekly = () => {
    if (!currentUser) return;
    const report = makeWeeklyReport('Brouillon');
    if (!report) return;
    const doc = buildWeeklyReportPdf(report, weekReports, kpis, currentUser, settings, weeklyProspects, services, categories);
    setPreview({
      dataUrl: doc.output('dataurlstring'),
      filename: `Rapport_Hebdomadaire_${weekStart}.pdf`,
      title: `Aperçu — Rapport hebdomadaire (semaine du ${new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR')})`,
    });
  };

  const handleExport = () => {
    if (!currentUser) return;
    const report = makeWeeklyReport('Brouillon');
    if (!report) return;
    generateWeeklyReportPdf(report, weekReports, kpis, currentUser, settings, weeklyProspects, services, categories);
    saveWeeklyReport(report);
  };

  const handleSendOutlook = async () => {
    if (!currentUser) return;
    const director = users.find(u => u.role === 'Directeur');
    const report = makeWeeklyReport('Envoyé');
    if (!report) return;
    generateWeeklyReportPdf(report, weekReports, kpis, currentUser, settings, weeklyProspects, services, categories);
    const directorEmail = director?.email || '';
    const startDate = new Date(weekStart + 'T00:00:00');
    const subject = `Rapport hebdomadaire combiné – Semaine du ${startDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    const body = `Bonjour,\n\nVeuillez trouver ci-joint le rapport hebdomadaire (${report.role}) de la semaine du ${startDate.toLocaleDateString('fr-FR')}.\nCe document inclut l'activité ainsi que la prospection le cas échéant.\n\nLe fichier PDF a été téléchargé : veuillez le joindre à cet email avant l'envoi.\n\nCordialement,\n${currentUser.name}`;
    window.location.href = `mailto:${encodeURIComponent(directorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await markWeeklyReportSent(report.id);
    await saveWeeklyReport(report);
  };

  const missingDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(new Date(weekStart + 'T00:00:00').getTime() + i * 86400000).toISOString().split('T')[0];
      days.push(d);
    }
    return days.filter(d => !weekReports.some(r => r.date === d && r.type === 'Activité'));
  }, [weekStart, weekReports]);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Rapport hebdomadaire</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Générez et envoyez votre rapport consolidé pour la semaine.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div className="responsive-flex-actions" style={{ alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ flex: '0 0 auto', width: '250px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Semaine du</label>
            <input 
              className="table-input" 
              type="date" 
              style={{ width: '100%' }} 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '22px' }}>
            <button className="btn btn-outline" onClick={handlePreviewWeekly} style={{ display: 'flex', alignItems: 'center' }}>
              <Eye size={16} style={{ marginRight: '8px' }} /> Prévisualiser
            </button>
            <button className="btn btn-outline" onClick={handleExport} style={{ display: 'flex', alignItems: 'center' }}>
              <Download size={16} style={{ marginRight: '8px' }} /> Télécharger PDF
            </button>
            <button className="btn btn-primary" onClick={handleSendOutlook} style={{ display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ marginRight: '8px' }} /> Envoyer
            </button>
          </div>
        </div>

        {missingDays.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '12px', backgroundColor: '#fff7ed', borderRadius: '8px', color: '#9a3412' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>
              Jours sans rapport d'activité : {missingDays.map(d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })).join(', ') || 'aucun'}
            </span>
          </div>
        )}

        <div className="widgets-grid">
          <div className="widget-card">
            <div className="widget-icon bg-info"><FileText size={32} color="white" /></div>
            <div className="widget-content">
              <div className="widget-label">PROSPECTS CRÉÉS</div>
              <div className="widget-value">{kpis.prospectsCrees}</div>
            </div>
          </div>
          <div className="widget-card">
            <div className="widget-icon bg-success"><CheckCircle2 size={32} color="white" /></div>
            <div className="widget-content">
              <div className="widget-label">CONVERSIONS</div>
              <div className="widget-value">{kpis.prospectsConvertis}</div>
            </div>
          </div>
          <div className="widget-card">
            <div className="widget-icon bg-primary"><FileText size={32} color="white" /></div>
            <div className="widget-content">
              <div className="widget-label">RELANCES TERMINÉES</div>
              <div className="widget-value">{kpis.relancesTerminees}</div>
            </div>
          </div>
          <div className="widget-card">
            <div className="widget-icon bg-warning"><Calendar size={32} color="white" /></div>
            <div className="widget-content">
              <div className="widget-label">JOURS RENSEIGNÉS</div>
              <div className="widget-value">{new Set(weekActivity.map(r => r.date)).size}/7</div>
            </div>
          </div>
        </div>
      </div>

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
