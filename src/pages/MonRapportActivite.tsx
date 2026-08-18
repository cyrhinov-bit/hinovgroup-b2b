import React, { useState, useEffect } from 'react';
import { Save, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { V2Task } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DynamicTaskList } from '../features/reports/presentation/components/DynamicTaskList';
import toast from 'react-hot-toast';

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonRapportActivite() {
  const { v2DailyReports, saveV2DailyReport } = useAppContext();
  const { currentUser } = useAuth();

  const [date, setDate] = useState(getToday());
  const [project, setProject] = useState('');
  const [objectives, setObjectives] = useState('');
  const [tasks, setTasks] = useState<V2Task[]>([]);
  const [results, setResults] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [observations, setObservations] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'Brouillon' | 'Soumis' | 'Validé'>('Brouillon');

  // Load existing report for this date & project
  useEffect(() => {
    if (!currentUser) return;
    const existing = v2DailyReports.find(r => r.authorId === currentUser.id && r.date === date && r.project === project);
    if (existing) {
      setEditingId(existing.id);
      setObjectives(existing.objectives);
      setTasks(existing.tasks);
      setResults(existing.results);
      setDifficulties(existing.difficulties);
      setObservations(existing.observations);
      setCurrentStatus(existing.status);
    } else {
      setEditingId(null);
      setObjectives('');
      setTasks([]);
      setResults('');
      setDifficulties('');
      setObservations('');
      setCurrentStatus('Brouillon');
    }
  }, [v2DailyReports, date, project, currentUser]);

  const validate = () => {
    if (!currentUser || !date || !project.trim()) {
      toast.error('La date et le projet sont obligatoires.');
      return false;
    }
    return true;
  };

  const handleSave = async (status: 'Brouillon' | 'Soumis') => {
    if (!validate()) return;
    if (!currentUser) return;
    
    await saveV2DailyReport({
      id: editingId || crypto.randomUUID(),
      authorId: currentUser.id,
      date,
      project: project.trim(),
      objectives,
      tasks,
      results,
      difficulties,
      observations,
      status
    });
    
    toast.success(`Rapport ${status === 'Brouillon' ? 'sauvegardé en brouillon' : 'soumis'} avec succès.`);
  };

  const isReadOnly = currentStatus === 'Validé' || currentStatus === 'Soumis';

  // Recent reports for the user
  const recentReports = v2DailyReports
    .filter(r => r.authorId === currentUser?.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="dashboard">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Rapport d'activité (Journalier)</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
          Saisissez votre activité du jour pour préparer le bilan de la semaine.
        </p>
      </div>

      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div className="responsive-form-grid">
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date</label>
            <input type="date" className="form-control" style={{ width: '100%' }} value={date} onChange={e => setDate(e.target.value)} max={getToday()} disabled={isReadOnly} />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Projet</label>
            <input type="text" className="form-control" style={{ width: '100%' }} placeholder="Nom du projet..." value={project} onChange={e => setProject(e.target.value)} disabled={isReadOnly} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
            {editingId ? (
              <span className={`badge-status ${currentStatus === 'Brouillon' ? 'bg-warning' : currentStatus === 'Soumis' ? 'bg-primary' : 'bg-success'}`}>
                {currentStatus}
              </span>
            ) : (
              <span className="badge-status bg-info">Nouveau</span>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Objectifs du jour</label>
          <textarea className="form-control" style={{ width: '100%', minHeight: '80px' }} placeholder="Quels étaient les objectifs fixés pour aujourd'hui ?" value={objectives} onChange={e => setObjectives(e.target.value)} disabled={isReadOnly} />
        </div>

        <DynamicTaskList tasks={tasks} onChange={setTasks} readonly={isReadOnly} />

        <div className="responsive-form-grid">
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Résultats obtenus</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '100px' }} placeholder="Livrables, avancées concrètes..." value={results} onChange={e => setResults(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Difficultés rencontrées</label>
            <textarea className="form-control" style={{ width: '100%', minHeight: '100px' }} placeholder="Problèmes techniques, blocages..." value={difficulties} onChange={e => setDifficulties(e.target.value)} disabled={isReadOnly} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Observations</label>
          <textarea className="form-control" style={{ width: '100%', minHeight: '80px' }} placeholder="Remarques éventuelles..." value={observations} onChange={e => setObservations(e.target.value)} disabled={isReadOnly} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          {!isReadOnly && (
            <>
              <button className="btn btn-outline" onClick={() => handleSave('Brouillon')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Sauvegarder Brouillon
              </button>
              <button className="btn btn-primary" onClick={() => handleSave('Soumis')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} /> Soumettre le rapport
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Historique Récent</h3>
        {recentReports.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Aucun rapport récent.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentReports.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR')} - {r.project}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.tasks.length} tâche(s)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`badge-status ${r.status === 'Brouillon' ? 'bg-warning' : r.status === 'Soumis' ? 'bg-primary' : 'bg-success'}`}>
                    {r.status}
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => {
                    setDate(r.date);
                    setProject(r.project);
                  }}>Ouvrir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
