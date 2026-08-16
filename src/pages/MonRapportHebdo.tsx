import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Save, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { V2Task, V2DailyReport } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateV2WeeklyReportPdf, buildV2WeeklyReportPdf } from '../features/reports/services/ReportPdfService';
import toast from 'react-hot-toast';
import { ReportPdfPreview } from '../components/ReportPdfPreview';
import type { ReportPdfPreviewData } from '../components/ReportPdfPreview';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust when day is sunday
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

function getToday(): string {
  return toDateStr(new Date());
}

export function MonRapportHebdo() {
  const { v2DailyReports, v2WeeklyReports, saveV2WeeklyReport } = useAppContext();
  const { currentUser } = useAuth();

  const [date, setDate] = useState(getToday());
  const [project, setProject] = useState('');
  
  const weekStart = useMemo(() => getWeekStart(date), [date]);
  const weekEnd = useMemo(() => toDateStr(new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000)), [weekStart]);

  const [weeklyObjectives, setWeeklyObjectives] = useState('');
  const [summary, setSummary] = useState('');
  const [nextWeekObjectives, setNextWeekObjectives] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'Brouillon' | 'Validé'>('Brouillon');
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  // Agrégation des rapports journaliers
  const { dailyReportIds, tasksByDay, pendingTasks, autoObjectives, coverage } = useMemo(() => {
    if (!currentUser || !project.trim()) {
      return { dailyReportIds: [], tasksByDay: {}, pendingTasks: [], autoObjectives: '', coverage: [] };
    }
    
    const weekReports = v2DailyReports.filter(r => 
      r.authorId === currentUser.id && 
      r.date >= weekStart && r.date <= weekEnd &&
      r.project.toLowerCase() === project.toLowerCase().trim()
    );

    const ids = weekReports.map(r => r.id);
    const tasksMap: Record<string, V2Task[]> = {};
    const pending: V2Task[] = [];
    const objList: string[] = [];
    
    // Déterminer la couverture des jours
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const coverageResult = days.map((dayName, idx) => {
      const d = new Date(new Date(weekStart + 'T00:00:00').getTime() + idx * 86400000);
      const dStr = toDateStr(d);
      const hasReport = weekReports.some(r => r.date === dStr);
      return { dayName, dStr, hasReport };
    });

    // Agrégation
    const jsDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    weekReports.forEach(report => {
      const d = new Date(report.date + 'T00:00:00');
      const dayName = jsDays[d.getDay()];
      const header = `${dayName} ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      
      if (!tasksMap[header]) tasksMap[header] = [];
      
      // On déduplique les objectifs
      if (report.objectives) {
        const lines = report.objectives.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        lines.forEach(line => {
          const cleanLine = line.replace(/^- /, ''); // remove leading dash if present
          if (!objList.includes(`- ${cleanLine}`)) {
            objList.push(`- ${cleanLine}`);
          }
        });
      }
      
      report.tasks.forEach(task => {
        tasksMap[header].push(task);
        if (task.status === 'En cours' || task.status === 'Restante') {
          // Check for duplication in pending
          if (!pending.some(p => p.description.toLowerCase() === task.description.toLowerCase())) {
            pending.push(task);
          }
        }
      });
    });

    return {
      dailyReportIds: ids,
      tasksByDay: tasksMap,
      pendingTasks: pending,
      autoObjectives: objList.join('\n'),
      coverage: coverageResult
    };
  }, [v2DailyReports, currentUser, weekStart, weekEnd, project]);

  useEffect(() => {
    if (!currentUser || !project.trim()) return;
    const existing = v2WeeklyReports.find(r => r.authorId === currentUser.id && r.weekStart === weekStart && r.project.toLowerCase() === project.toLowerCase().trim());
    
    if (existing) {
      setEditingId(existing.id);
      setWeeklyObjectives(existing.weeklyObjectives);
      setSummary(existing.summary);
      setNextWeekObjectives(existing.nextWeekObjectives);
      setConclusion(existing.conclusion);
      setCurrentStatus(existing.status);
    } else {
      setEditingId(null);
      setWeeklyObjectives(autoObjectives);
      setSummary('');
      setNextWeekObjectives(pendingTasks.map(t => `- ${t.description}`).join('\n'));
      setConclusion('');
      setCurrentStatus('Brouillon');
    }
  }, [v2WeeklyReports, currentUser, weekStart, project, autoObjectives, pendingTasks]);

  const makeReport = (status: 'Brouillon' | 'Validé') => {
    if (!currentUser || !project.trim()) return null;
    return {
      id: editingId || crypto.randomUUID(),
      authorId: currentUser.id,
      weekStart,
      project: project.trim(),
      dailyReportIds,
      weeklyObjectives,
      tasksByDay,
      pendingTasks,
      summary,
      nextWeekObjectives,
      conclusion,
      status
    };
  };

  const handleSave = async () => {
    const report = makeReport('Brouillon');
    if (!report) { toast.error("Veuillez saisir un projet."); return; }
    await saveV2WeeklyReport(report as any);
    toast.success("Rapport hebdomadaire sauvegardé en brouillon.");
  };

  const handleValidateAndDownload = async () => {
    const report = makeReport('Validé');
    if (!report) { toast.error("Veuillez saisir un projet."); return; }
    await saveV2WeeklyReport(report as any);
    generateV2WeeklyReportPdf(report as any, currentUser);
    toast.success("Rapport validé et PDF généré.");
  };

  const handlePreview = () => {
    const report = makeReport(currentStatus);
    if (!report) { toast.error("Veuillez saisir un projet."); return; }
    const doc = buildV2WeeklyReportPdf(report as any, currentUser);
    const safeName = currentUser?.name ? currentUser.name.replace(/\s+/g, '_') : 'Inconnu';
    setPreview({
      dataUrl: doc.output('dataurlstring'),
      filename: `Rapport_Hebdomadaire_${safeName}_${report.weekStart}.pdf`,
      title: `Aperçu — Rapport hebdomadaire (${report.project})`,
    });
  };

  const isReadOnly = currentStatus === 'Validé';

  return (
    <div className="dashboard">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Rapport Hebdomadaire</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
          Générez votre rapport de semaine automatiquement à partir de vos saisies journalières.
        </p>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="responsive-form-grid">
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Semaine du</label>
            <input type="date" className="form-control" style={{ width: '100%' }} value={date} onChange={e => setDate(e.target.value)} disabled={isReadOnly} />
            <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
              Du {new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR')} au {new Date(weekEnd + 'T00:00:00').toLocaleDateString('fr-FR')}
            </small>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Projet</label>
            <input type="text" className="form-control" style={{ width: '100%' }} placeholder="Nom exact du projet..." value={project} onChange={e => setProject(e.target.value)} disabled={isReadOnly} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
            <span className={`badge-status ${currentStatus === 'Brouillon' ? 'bg-warning' : 'bg-success'}`}>
              {currentStatus}
            </span>
          </div>
        </div>

        {project.trim() && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--color-background-alt)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px' }}>Contrôle de complétude ({dailyReportIds.length} rapport(s) trouvé(s))</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {coverage.map(c => (
                <div key={c.dStr} style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.8rem', 
                  backgroundColor: c.hasReport ? 'var(--color-success)' : 'var(--color-border)', 
                  color: c.hasReport ? '#fff' : 'inherit'
                }}>
                  {c.dayName.substring(0, 3)}. {c.hasReport ? '✅' : '❌'}
                </div>
              ))}
            </div>
            <small style={{ display: 'block', marginTop: '8px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Note: Un jour sans rapport n'est pas automatiquement une erreur (ex: week-end ou jour férié).
            </small>
          </div>
        )}
      </div>

      {dailyReportIds.length > 0 && (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Synthèse & Modification</h3>
          
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>1. Objectifs de la semaine (Extraits des rapports journaliers)</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '100px' }} value={weeklyObjectives} onChange={e => setWeeklyObjectives(e.target.value)} disabled={isReadOnly} />
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--color-background-alt)', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 8px 0' }}>
              2. Tâches effectuées & 3. Tâches en cours (Automatique)
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Ces sections sont directement formatées par jour (ex: Lundi 10 août) et intégrées au PDF final de manière déterministe. 
              <strong> {pendingTasks.length}</strong> tâches en cours/restantes uniques ont été détectées.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>4. Bilan de la semaine</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '120px' }} placeholder="Synthèse des activités, résultats, difficultés, corrections, avancées..." value={summary} onChange={e => setSummary(e.target.value)} disabled={isReadOnly} />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>5. Objectifs de la semaine suivante (Proposés depuis les tâches restantes)</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '100px' }} value={nextWeekObjectives} onChange={e => setNextWeekObjectives(e.target.value)} disabled={isReadOnly} />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Conclusion</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '80px' }} placeholder="Conclusion cohérente du bilan..." value={conclusion} onChange={e => setConclusion(e.target.value)} disabled={isReadOnly} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-outline" onClick={handlePreview} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} /> Aperçu
            </button>
            {!isReadOnly ? (
              <>
                <button className="btn btn-outline" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} /> Sauvegarder Brouillon
                </button>
                <button className="btn btn-primary" onClick={handleValidateAndDownload} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} /> Valider le rapport et PDF
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleValidateAndDownload} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> Télécharger le PDF
              </button>
            )}
          </div>
        </div>
      )}

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
