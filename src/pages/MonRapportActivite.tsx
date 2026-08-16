import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, FileText, Mail, Trash2, AlertCircle, Download, PieChart, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateWeeklyReportPdf, buildWeeklyReportPdf, buildDailyReportPdf } from '../lib/pdfUtils';
import type { ActivityReport, WeeklyReport } from '../context/AppContext';
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

export function MonRapportActivite() {
  const {
    prospects, prospectActivities, prospectFollowUps, clients, quotes, sales, commissions, installments,
    activityReports, weeklyReports, users,
    upsertActivityReport, deleteActivityReport, saveWeeklyReport, markWeeklyReportSent, settings,
    services, categories
  } = useAppContext();
  const { currentUser } = useAuth();

  const [date, setDate] = useState(getToday());
  const [realisations, setRealisations] = useState('');
  const [difficultes, setDifficultes] = useState('');
  const [remarques, setRemarques] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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
  
  // NOUVEAU: Récupérer les prospects créés par le commercial dans la semaine
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

  const existing = myReports.find(r => r.type === 'Activité' && r.date === date);
  useEffect(() => {
    const current = myReports.find(r => r.type === 'Activité' && r.date === date);
    if (current) {
      setEditingId(current.id);
      setRealisations(current.realisations);
      setDifficultes(current.difficultes);
      setRemarques(current.remarques);
    } else {
      setEditingId(null);
      setRealisations('');
      setDifficultes('');
      setRemarques('');
    }
  }, [myReports, date]);

  const handleSave = async () => {
    if (!currentUser || !date) return;
    const report: ActivityReport = {
      id: editingId || crypto.randomUUID(),
      authorId: currentUser.id,
      role: currentUser.role as ActivityReport['role'],
      type: 'Activité',
      date,
      realisations,
      difficultes,
      remarques,
    };
    await upsertActivityReport(report);
  };

  const makeWeeklyReport = (status: WeeklyReport['status']): WeeklyReport | null => {
    if (!currentUser) return null;
    const sections = [
      { type: 'Activité' as const, content: weekActivity.map(r => `- ${r.date}: ${r.realisations}`).join('\n') },
    ];
    // Réutiliser l'UUID du rapport existant de cette semaine (id stable pour le sync serveur)
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

  const handlePreviewDaily = () => {
    if (!currentUser || !date) return;
    const doc = buildDailyReportPdf(
      { type: 'Activité', date, realisations, difficultes, remarques },
      currentUser,
      settings
    );
    setPreview({
      dataUrl: doc.output('dataurlstring'),
      filename: `Rapport_Activite_${date}.pdf`,
      title: `Aperçu — Rapport d'activité du ${new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')}`,
    });
  };

  const handlePreviewWeekly = () => {
    if (!currentUser) return;
    const report = makeWeeklyReport('Brouillon');
    if (!report) return;
    // On passe weeklyProspects pour générer la section "Rapport de Prospection"
    const doc = buildWeeklyReportPdf(report, weekReports, kpis, currentUser, settings, weeklyProspects, services, categories);
    setPreview({
      dataUrl: doc.output('dataurlstring'),
      filename: `Rapport_Hebdomadaire_${weekStart}.pdf`,
      title: `Aperçu — Rapport hebdomadaire combiné (semaine du ${new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR')})`,
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
          <h2 style={{ margin: 0 }}>Rapport d'activité</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Rédigez votre rapport journalier puis générez le rapport hebdomadaire.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center' }}>
            <PieChart size={16} style={{ marginRight: '8px' }} /> Rafraîchir les données
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3>Rapport journalier d'activité</h3>
        <div className="responsive-form-grid">
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date</label>
            <input className="form-control" type="date" style={{ width: '100%' }} value={date} max={getToday()} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
            {existing ? (
              <span className="badge-status bg-success">Déjà rédigé — modification</span>
            ) : (
              <span className="badge-status bg-primary">Nouveau</span>
            )}
          </div>
          <div />
        </div>

        <div className="responsive-form-grid">
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Réalisations du jour</label>
            <textarea className="form-control" style={{ minHeight: '140px', width: '100%' }} value={realisations} onChange={e => setRealisations(e.target.value)} placeholder="Décrivez ce que vous avez accompli aujourd'hui..." />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Difficultés rencontrées</label>
            <textarea className="form-control" style={{ minHeight: '140px', width: '100%' }} value={difficultes} onChange={e => setDifficultes(e.target.value)} placeholder="Problèmes, blocages ou obstacles..." />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Remarques / observations</label>
            <textarea className="form-control" style={{ minHeight: '140px', width: '100%' }} value={remarques} onChange={e => setRemarques(e.target.value)} placeholder="Toute autre information utile..." />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button className="btn btn-outline" onClick={handlePreviewDaily} style={{ display: 'flex', alignItems: 'center' }}>
            <Eye size={16} style={{ marginRight: '8px' }} /> Prévisualiser le rendu
          </button>
          <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircle2 size={16} style={{ marginRight: '8px' }} /> {editingId ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {editingId && (
            <button className="btn btn-outline text-error" onClick={() => deleteActivityReport(editingId)} style={{ display: 'flex', alignItems: 'center' }}>
              <Trash2 size={16} style={{ marginRight: '8px' }} /> Supprimer
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Rapport hebdomadaire combiné (semaine du {new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR')})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" onClick={handlePreviewWeekly} style={{ display: 'flex', alignItems: 'center' }}>
              <Eye size={16} style={{ marginRight: '8px' }} /> Prévisualiser
            </button>
            <button className="btn btn-outline" onClick={handleExport} style={{ display: 'flex', alignItems: 'center' }}>
              <Download size={16} style={{ marginRight: '8px' }} /> Télécharger PDF pro
            </button>
            <button className="btn btn-primary" onClick={handleSendOutlook} style={{ display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ marginRight: '8px' }} /> Envoyer par Outlook
            </button>
          </div>
        </div>

        {missingDays.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '12px', backgroundColor: '#fff7ed', borderRadius: '8px', color: '#9a3412' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>
              Jours sans rapport d'activité : {missingDays.map(d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })).join(', ') || 'aucun'}
            </span>
          </div>
        )}

        <div className="widgets-grid" style={{ marginTop: '16px' }}>
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

        {weekReports.length > 0 && (
          <div className="mobile-card-grid" style={{ marginTop: '16px' }}>
            {weekReports.map(r => (
              <div key={r.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                  <span className="badge-status bg-primary">{r.type}</span>
                </div>
                
                <div className="mobile-card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="mobile-card-label">Réalisations</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{r.realisations || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    <span className="mobile-card-label">Difficultés</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{r.difficultes || '-'}</span>
                  </div>
                </div>

                <div className="mobile-card-actions">
                  {r.type === 'Activité' && (
                    <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center' }} onClick={() => {
                      setDate(r.date);
                    }} title="Modifier">
                      <FileText size={16} style={{ marginRight: '8px' }} /> Modifier
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
