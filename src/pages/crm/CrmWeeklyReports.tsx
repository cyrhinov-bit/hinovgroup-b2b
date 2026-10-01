import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, CheckCircle, Clock, AlertCircle, FileText, Send, Download, 
  Eye, Plus, Trash2, ChevronLeft, ChevronRight, Bell, Shield, 
  Filter, Search, User as UserIcon, Building, MessageSquare, Lock, ClipboardCheck
} from 'lucide-react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext, type V2WeeklyReport, type V2DailyReport, type V2Task, type User } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import { generateV2WeeklyReportPdf, getV2WeeklyReportPdfBlobUrl } from '../../features/reports/services/ReportPdfService';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../../components/ReportPdfPreview';
import toast from 'react-hot-toast';
import './CrmWeeklyReports.css';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TASK_CATEGORIES = ['Opérationnel', 'Commercial', 'Support & Client', 'Technique', 'Administratif', 'Réunion & Stratégie'];

export function CrmWeeklyReports() {
  const { currentUser } = useAuth();
  const { 
    v2WeeklyReports, v2DailyReports, users, services, settings, notifications,
    saveV2DailyReport, saveV2WeeklyReport, submitV2WeeklyReport, 
    sendWeeklyReportReminder, reviewV2WeeklyReport, markNotificationAsRead 
  } = useAppContext();
  const { confirm } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isDirection = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '');
  const isSupervisionRoute = location.pathname.includes('rapports-equipe');

  // Helper date for Monday
  const getMondayOf = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(date.setDate(diff));
    return mon.toISOString().slice(0, 10);
  };

  const currentMondayStr = useMemo(() => getMondayOf(new Date()), []);
  const initialWeek = searchParams.get('week') || currentMondayStr;
  const initialTab = isDirection ? 'supervision' : (searchParams.get('tab') || 'daily');

  const [currentWeekStart, setCurrentWeekStart] = useState<string>(initialWeek);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedDay, setSelectedDay] = useState<string>('Lundi');

  // Preview Modal State
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  // Direction Review Modal State
  const [reviewingReport, setReviewingReport] = useState<V2WeeklyReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  // Daily task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskCategory, setTaskCategory] = useState('Opérationnel');
  const [taskStatus, setTaskStatus] = useState<V2Task['status']>('Effectuée');
  const [taskDifficulty, setTaskDifficulty] = useState('');
  const [taskTimeSpent, setTaskTimeSpent] = useState('');

  // Report editor state
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [nextWeekObjectives, setNextWeekObjectives] = useState('');
  const [weeklyObjectives, setWeeklyObjectives] = useState('');

  // Direction supervision filters
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Synchroniser paramètres URL et routes
  useEffect(() => {
    if (isDirection) {
      setActiveTab('supervision');
    } else {
      const pTab = searchParams.get('tab');
      if (pTab && ['daily', 'report', 'history'].includes(pTab)) {
        setActiveTab(pTab);
      }
    }
    const pWeek = searchParams.get('week');
    if (pWeek && pWeek !== currentWeekStart) {
      setCurrentWeekStart(pWeek);
    }
  }, [searchParams, location.pathname, isDirection]);

  // Marquer automatiquement les notifications de rapports comme lues lorsque la Direction consulte la supervision
  useEffect(() => {
    if (isDirection && currentUser) {
      const unreadReportNotifs = (notifications || []).filter(n => 
        n.user_id === currentUser.id && 
        !n.is_read && 
        (n.title?.toLowerCase().includes('rapport') || n.link?.includes('rapports') || n.link?.includes('supervision'))
      );
      for (const notif of unreadReportNotifs) {
        markNotificationAsRead(notif.id);
      }
    }
  }, [isDirection, currentUser, notifications, markNotificationAsRead]);

  const handleTabChange = (newTab: string) => {
    if (isDirection) return;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab, week: currentWeekStart });
  };

  // Calcul des dates de la semaine courante
  const weekDates = useMemo(() => {
    const dates: Record<string, string> = {};
    const startDate = new Date(currentWeekStart + 'T00:00:00');
    DAYS.forEach((day, idx) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + idx);
      dates[day] = d.toISOString().slice(0, 10);
    });
    return dates;
  }, [currentWeekStart]);

  // Trouver ou charger le rapport hebdomadaire de la semaine
  const currentWeeklyReport = useMemo(() => {
    return v2WeeklyReports.find(r => r.authorId === currentUser?.id && r.weekStart === currentWeekStart);
  }, [v2WeeklyReports, currentUser?.id, currentWeekStart]);

  const isWeekLocked = useMemo(() => {
    return currentWeeklyReport?.status === 'Soumis' || currentWeeklyReport?.status === 'Validé';
  }, [currentWeeklyReport]);

  // Initialiser les champs du formulaire hebdomadaire lors du changement de semaine / rapport
  useEffect(() => {
    if (currentWeeklyReport) {
      setSummary(currentWeeklyReport.summary || '');
      setAchievements(currentWeeklyReport.achievements || '');
      setDifficulties(currentWeeklyReport.difficulties || '');
      setNextWeekObjectives(currentWeeklyReport.nextWeekObjectives || '');
      setWeeklyObjectives(currentWeeklyReport.weeklyObjectives || '');
    } else {
      setSummary('');
      setAchievements('');
      setDifficulties('');
      setNextWeekObjectives('');
      setWeeklyObjectives('');
    }
  }, [currentWeeklyReport, currentWeekStart]);

  // Récupérer les activités du jour sélectionné
  const currentDayDate = weekDates[selectedDay];
  const currentDailyReport = useMemo(() => {
    return v2DailyReports.find(d => d.authorId === currentUser?.id && d.date === currentDayDate);
  }, [v2DailyReports, currentUser?.id, currentDayDate]);

  const dailyTasks = currentDailyReport?.tasks || [];

  // Changer de semaine (semaine précédente / suivante)
  const shiftWeek = (offsetWeeks: number) => {
    const d = new Date(currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() + offsetWeeks * 7);
    const newMonday = getMondayOf(d);
    setCurrentWeekStart(newMonday);
    setSearchParams({ tab: activeTab, week: newMonday });
  };

  // 1. Ajouter une activité quotidienne
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    if (isWeekLocked) {
      toast.error('Cette semaine est déjà verrouillée suite à sa soumission.');
      return;
    }

    const cleanTitle = taskTitle.trim();
    const cleanDesc = taskDescription.trim() || cleanTitle;

    const newTask: V2Task = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      title: cleanTitle,
      description: cleanDesc,
      category: taskCategory,
      status: taskStatus,
      difficulty: taskDifficulty.trim() || undefined,
      timeSpent: taskTimeSpent.trim() || undefined
    };

    const updatedTasks = [...dailyTasks, newTask];
    const reportToSave: V2DailyReport = {
      id: currentDailyReport?.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      authorId: currentUser?.id || '',
      date: currentDayDate,
      project: 'HINOV',
      objectives: currentDailyReport?.objectives || '',
      tasks: updatedTasks,
      results: currentDailyReport?.results || '',
      difficulties: currentDailyReport?.difficulties || '',
      observations: currentDailyReport?.observations || '',
      status: isWeekLocked ? 'Soumis' : 'Brouillon'
    };

    await saveV2DailyReport(reportToSave);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDifficulty('');
    setTaskTimeSpent('');
    toast.success('Activité ajoutée avec succès.');
  };

  // 2. Basculer le statut d'une tâche
  const handleToggleTaskStatus = async (taskId: string) => {
    if (isWeekLocked) {
      toast.error('Modification impossible : la semaine est verrouillée.');
      return;
    }
    const statusCycle: Record<V2Task['status'], V2Task['status']> = {
      'En cours': 'Effectuée',
      'Effectuée': 'Restante',
      'Restante': 'Bloquée',
      'Bloquée': 'En cours'
    };

    const updatedTasks = dailyTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: statusCycle[t.status] || 'Effectuée' };
      }
      return t;
    });

    if (currentDailyReport) {
      await saveV2DailyReport({ ...currentDailyReport, tasks: updatedTasks });
    }
  };

  // 3. Supprimer une tâche
  const handleDeleteTask = async (taskId: string) => {
    if (isWeekLocked) {
      toast.error('Suppression impossible : la semaine est verrouillée.');
      return;
    }
    const updatedTasks = dailyTasks.filter(t => t.id !== taskId);
    if (currentDailyReport) {
      await saveV2DailyReport({ ...currentDailyReport, tasks: updatedTasks });
      toast.success('Activité supprimée.');
    }
  };

  // 4. Consolider et importer les tâches de la semaine dans le brouillon
  const handleConsolidateWeek = () => {
    const tasksByDayMap: Record<string, V2Task[]> = {};
    DAYS.forEach(day => {
      const dStr = weekDates[day];
      const rep = v2DailyReports.find(d => d.authorId === currentUser?.id && d.date === dStr);
      tasksByDayMap[day] = rep?.tasks || [];
    });

    // Auto-déduction des réalisations et difficultés
    const allTasks = Object.values(tasksByDayMap).flat();
    const formatTaskLine = (t: V2Task) => {
      if (t.title && t.description && t.title.trim() !== t.description.trim()) {
        return `• [${t.title.trim()}] : ${t.description.trim()}`;
      }
      return `• ${t.title || t.description}`;
    };

    const completedTasks = allTasks.filter(t => t.status === 'Effectuée').map(formatTaskLine);
    const blockedTasks = allTasks.filter(t => t.status === 'Bloquée' || t.difficulty).map(t => {
      const base = formatTaskLine(t);
      return `${base} ${t.difficulty ? `(Point bloquant : ${t.difficulty})` : ''}`;
    });

    if (!achievements && completedTasks.length > 0) {
      setAchievements(completedTasks.join('\n'));
    }
    if (!difficulties && blockedTasks.length > 0) {
      setDifficulties(blockedTasks.join('\n'));
    }

    toast.success('Activités journalières consolidées avec succès.');
  };

  // 5. Sauvegarder le brouillon de rapport
  const handleSaveDraft = async () => {
    const tasksByDayMap: Record<string, V2Task[]> = {};
    DAYS.forEach(day => {
      const dStr = weekDates[day];
      const rep = v2DailyReports.find(d => d.authorId === currentUser?.id && d.date === dStr);
      tasksByDayMap[day] = rep?.tasks || [];
    });

    const reportObj: V2WeeklyReport = {
      id: currentWeeklyReport?.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      authorId: currentUser?.id || '',
      weekStart: currentWeekStart,
      weekEnd: weekDates['Samedi'],
      project: 'HINOV GROUP',
      weeklyObjectives,
      tasksByDay: tasksByDayMap,
      summary,
      achievements,
      difficulties,
      nextWeekObjectives,
      status: currentWeeklyReport?.status || 'Brouillon'
    };

    await saveV2WeeklyReport(reportObj);
    toast.success('Brouillon de rapport sauvegardé.');
  };

  // 6. Soumettre le rapport hebdomadaire à la Direction
  const handleSubmitReport = () => {
    if (isWeekLocked) return;

    confirm({
      title: 'Soumettre mon rapport à la Direction',
      message: 'Attention : La soumission verrouillera définitivement toutes les activités de cette semaine pour garantir l\'intégrité des comptes-rendus. Confirmez-vous l\'envoi officiel ?',
      confirmLabel: 'Confirmer et soumettre',
      onConfirm: async () => {
        const tasksByDayMap: Record<string, V2Task[]> = {};
        DAYS.forEach(day => {
          const dStr = weekDates[day];
          const rep = v2DailyReports.find(d => d.authorId === currentUser?.id && d.date === dStr);
          tasksByDayMap[day] = rep?.tasks || [];
        });

        const reportId = currentWeeklyReport?.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
        const reportObj: V2WeeklyReport = {
          id: reportId,
          authorId: currentUser?.id || '',
          weekStart: currentWeekStart,
          weekEnd: weekDates['Samedi'],
          project: 'HINOV GROUP',
          weeklyObjectives,
          tasksByDay: tasksByDayMap,
          summary,
          achievements,
          difficulties,
          nextWeekObjectives,
          status: 'Soumis'
        };

        await saveV2WeeklyReport(reportObj);
        await submitV2WeeklyReport(reportId);
        toast.success('Rapport hebdomadaire soumis avec succès à la Direction !');
      }
    });
  };

  // 7. Aperçu PDF Certifié
  const handlePreviewPdf = (reportToPreview?: V2WeeklyReport) => {
    const authorId = reportToPreview ? reportToPreview.authorId : (currentUser?.id || '');
    const tasksByDayRecord: Record<string, V2Task[]> = {};
    DAYS.forEach(day => {
      const rep = v2DailyReports.find(d => d.authorId === authorId && d.date === weekDates[day]);
      tasksByDayRecord[day] = rep?.tasks || [];
    });

    const reportObj: V2WeeklyReport = reportToPreview || {
      id: currentWeeklyReport?.id || 'temp-id',
      authorId: currentUser?.id || '',
      weekStart: currentWeekStart,
      weekEnd: weekDates['Samedi'],
      weeklyObjectives,
      tasksByDay: tasksByDayRecord,
      summary,
      achievements,
      difficulties,
      nextWeekObjectives,
      status: currentWeeklyReport?.status || 'Brouillon'
    };

    const targetAuthor = users.find(u => u.id === reportObj.authorId) || currentUser;
    const blobUrl = getV2WeeklyReportPdfBlobUrl(reportObj, targetAuthor, settings);
    const safeName = targetAuthor?.name ? targetAuthor.name.toLowerCase().replace(/\s+/g, '_') : 'collaborateur';

    setPreview({
      blobUrl,
      filename: `rapport_hebdo_${safeName}_${reportObj.weekStart}.pdf`,
      title: `Rapport Hebdomadaire — ${targetAuthor?.name || 'Collaborateur'} (Semaine du ${new Date(reportObj.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')})`,
      onDownload: () => generateV2WeeklyReportPdf(reportObj, targetAuthor, settings)
    });
  };

  // ================= SUPERVISION DIRECTION DATA & KPIs =================
  const activeStaff = useMemo(() => {
    return users.filter(u => 
      u.active !== false && 
      u.crmReportsEnabled !== false &&
      !['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(u.role)
    );
  }, [users]);

  const weeklyReportsForSelectedWeek = useMemo(() => {
    return v2WeeklyReports.filter(r => r.weekStart === currentWeekStart);
  }, [v2WeeklyReports, currentWeekStart]);

  const submittedStaffIds = useMemo(() => {
    return weeklyReportsForSelectedWeek.filter(r => r.status === 'Soumis' || r.status === 'Validé').map(r => r.authorId);
  }, [weeklyReportsForSelectedWeek]);

  const pendingStaff = useMemo(() => {
    return activeStaff.filter(u => !submittedStaffIds.includes(u.id));
  }, [activeStaff, submittedStaffIds]);

  const completionRate = activeStaff.length > 0 
    ? Math.round((submittedStaffIds.length / activeStaff.length) * 100) 
    : 0;

  // Filtrage du cockpit de supervision
  const filteredStaffList = useMemo(() => {
    return activeStaff.filter(u => {
      const matchSearch = searchQuery ? u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const matchService = serviceFilter === 'ALL' ? true : u.serviceId === serviceFilter;
      const isSubmitted = submittedStaffIds.includes(u.id);
      const matchStatus = statusFilter === 'ALL' ? true : (statusFilter === 'SOUMIS' ? isSubmitted : !isSubmitted);
      return matchSearch && matchService && matchStatus;
    });
  }, [activeStaff, searchQuery, serviceFilter, statusFilter, submittedStaffIds]);

  // Relancer tous les retardataires
  const handleRemindAllPending = () => {
    if (pendingStaff.length === 0) {
      toast.success('Tous les collaborateurs ont déjà soumis leur rapport !');
      return;
    }

    confirm({
      title: 'Relancer les retardataires',
      message: `Voulez-vous envoyer une notification de rappel à ${pendingStaff.length} collaborateur(s) n'ayant pas encore soumis leur rapport pour la semaine du ${new Date(currentWeekStart + 'T00:00:00').toLocaleDateString('fr-FR')} ?`,
      confirmLabel: 'Envoyer les relances',
      onConfirm: async () => {
        await sendWeeklyReportReminder(pendingStaff.map(u => u.id), currentWeekStart);
        toast.success(`Relance envoyée avec succès à ${pendingStaff.length} collaborateur(s).`);
      }
    });
  };

  // Validation par la Direction
  const handleValidateReport = async () => {
    if (!reviewingReport) return;
    await reviewV2WeeklyReport(reviewingReport.id, reviewComment, 'Validé');
    toast.success('Rapport validé avec succès.');
    setReviewingReport(null);
    setReviewComment('');
  };

  if (isDirection && currentUser?.crmTeamReportsEnabled === false) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Shield size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
        <h2>Module "Rapports Équipe" désactivé</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '500px', margin: '8px auto 0' }}>
          Ce module n'est pas activé pour votre profil. Rendez-vous dans <strong>Activation Modules</strong> pour l'activer.
        </p>
      </div>
    );
  }

  if (!isDirection && currentUser?.crmReportsEnabled === false) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Shield size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
        <h2>Module "Rapports Hebdo" désactivé</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '500px', margin: '8px auto 0' }}>
          Le module de reporting hebdomadaire n'est pas activé pour votre compte. Veuillez contacter la Direction.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDirection ? (
              <>
                <ClipboardCheck size={24} color="#7C3AED" /> Rapports d'Activité de l'Équipe
              </>
            ) : (
              <>
                <FileText size={24} color="var(--color-primary)" /> Rapports d'Activité Hebdomadaires
              </>
            )}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {isDirection 
              ? "Cockpit de supervision, consultation des rapports soumis et relance de l'équipe"
              : "Suivi journalier des activités, consolidation des comptes-rendus et transmission à la Direction"
            }
          </p>
        </div>

        {/* SÉLECTEUR DE SEMAINE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <button className="icon-button" onClick={() => shiftWeek(-1)} title="Semaine précédente">
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
            <Calendar size={16} color="var(--color-primary)" />
            <span>Semaine du {new Date(currentWeekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <button className="icon-button" onClick={() => shiftWeek(1)} title="Semaine suivante">
            <ChevronRight size={18} />
          </button>
          {currentWeekStart !== currentMondayStr && (
            <button 
              className="btn btn-secondary" 
              style={{ fontSize: '0.8rem', padding: '4px 8px', marginLeft: '4px' }}
              onClick={() => { setCurrentWeekStart(currentMondayStr); setSearchParams({ tab: activeTab, week: currentMondayStr }); }}
            >
              Semaine actuelle
            </button>
          )}
        </div>
      </div>

      {/* NAVIGATION PAR ONGLETS (Uniquement pour les collaborateurs opérationnels) */}
      {!isDirection && (
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--color-border)', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button 
            className={`tab-button ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => handleTabChange('daily')}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'daily' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'daily' ? 700 : 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Clock size={16} /> 1. Saisie Journalière (Lun - Sam)
          </button>

          <button 
            className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => handleTabChange('report')}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'report' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'report' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'report' ? 700 : 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <FileText size={16} /> 2. Mon Rapport Hebdomadaire
            {isWeekLocked && <span title="Semaine soumise et verrouillée"><Lock size={14} color="#10B981" /></span>}
          </button>

          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'history' ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'history' ? 700 : 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <CheckCircle size={16} /> 3. Mes Rapports Soumis
          </button>
        </div>
      )}

      {/* ================= ONGLET 1 : SAISIE JOURNALIÈRE ================= */}
      {!isDirection && activeTab === 'daily' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* BANDEAU JOURS DE LA SEMAINE - CARTES ANIMÉES MULTI-COULEURS */}
          <div className="crm-days-grid">
            {DAYS.map(day => {
              const dStr = weekDates[day];
              const dayRep = v2DailyReports.find(d => d.authorId === currentUser?.id && d.date === dStr);
              const tasks = dayRep?.tasks || [];
              const count = tasks.length;
              const completedCount = tasks.filter(t => t.status === 'Effectuée').length;
              const progressPct = count > 0 ? Math.round((completedCount / count) * 100) : 0;
              const isSelected = selectedDay === day;
              const dayClass = `day-${day.toLowerCase()}`;

              return (
                <div
                  key={day}
                  className={`crm-day-card ${dayClass} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDay(day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedDay(day); }}
                >
                  <div>
                    <div className="day-header">
                      <div>
                        <div className="day-name">{day}</div>
                        <div className="day-date">
                          {new Date(dStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                      <span className="day-badge">
                        {count > 0 ? `${completedCount}/${count}` : '0 act.'}
                      </span>
                    </div>

                    <div className="day-progress-bar">
                      <div 
                        className="day-progress-fill" 
                        style={{ 
                          width: `${progressPct}%`, 
                          background: count > 0 && progressPct === 100 ? '#10B981' : 'currentColor' 
                        }} 
                      />
                    </div>
                  </div>

                  <div className="day-footer">
                    <span className="day-count-label">
                      {count} {count > 1 ? 'activités' : 'activité'}
                    </span>
                    <span className="day-status-pill">
                      {count === 0 ? 'À renseigner' : progressPct === 100 ? '✅ Clôturé' : `${progressPct}% fait`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* STUDIO D'ÉDITION DU JOUR SÉLECTIONNÉ */}
          <div className="crm-active-day-studio">
            {/* EN-TÊTE DYNAMIQUE DU JOUR */}
            <div className={`crm-day-banner-header day-${selectedDay.toLowerCase()}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                    Activités du {selectedDay} {new Date(currentDayDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                    {dailyTasks.length} {dailyTasks.length > 1 ? 'activités enregistrées' : 'activité enregistrée'} • Semaine du {new Date(currentWeekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>

              {dailyTasks.length > 0 && !isWeekLocked && (
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.85rem', padding: '6px 14px', background: 'rgba(255,255,255,0.95)', color: '#1E293B', border: 'none', fontWeight: 700 }}
                  onClick={() => { setActiveTab('report'); setSearchParams({ tab: 'report', week: currentWeekStart }); }}
                >
                  ➡️ Passer au rapport hebdo
                </button>
              )}
            </div>

            {/* FORMULAIRE D'AJOUT RAPIDE */}
            {!isWeekLocked ? (
              <div style={{ background: 'var(--color-background)', padding: '20px', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                  <Plus size={18} color="var(--color-primary)" /> Ajouter une nouvelle tâche / activité
                </h4>

                <form onSubmit={handleAddTask} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600 }}>Titre de l'activité *</label>
                    <input 
                      className="table-input" 
                      placeholder="Ex: Rendez-vous client BOA, Conception maquette catalogue, Livraison commande #402..."
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Description détaillée de l'activité (optionnel)</label>
                    <textarea 
                      className="table-input" 
                      rows={2}
                      placeholder="Détails de l'intervention, points abordés, actions menées, résultat obtenu..."
                      value={taskDescription}
                      onChange={e => setTaskDescription(e.target.value)}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Catégorie</label>
                    <select className="table-input" value={taskCategory} onChange={e => setTaskCategory(e.target.value)}>
                      {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Statut</label>
                    <select className="table-input" value={taskStatus} onChange={e => setTaskStatus(e.target.value as V2Task['status'])}>
                      <option value="Effectuée">✅ Terminée / Effectuée</option>
                      <option value="En cours">⏳ En cours</option>
                      <option value="Restante">📌 En attente / Restante</option>
                      <option value="Bloquée">⚠️ Bloquée</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Difficulté / Point bloquant (optionnel)</label>
                    <input 
                      className="table-input" 
                      placeholder="Ex: Attente retour client..."
                      value={taskDifficulty}
                      onChange={e => setTaskDifficulty(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Temps passé (optionnel)</label>
                    <input 
                      className="table-input" 
                      placeholder="Ex: 1h30, 2h..."
                      value={taskTimeSpent}
                      onChange={e => setTaskTimeSpent(e.target.value)}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontWeight: 600 }}>
                      <Plus size={16} /> Enregistrer l'activité
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Lock size={20} color="#059669" />
                <div>
                  <strong style={{ color: '#065F46' }}>Semaine officielle verrouillée</strong>
                  <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.85rem' }}>
                    Votre rapport hebdomadaire pour cette semaine a été soumis à la Direction. Les activités quotidiennes sont verrouillées.
                  </p>
                </div>
              </div>
            )}

            {/* LISTE DES ACTIVITÉS DU JOUR */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  Liste des activités enregistrées ({dailyTasks.length})
                </h4>
              </div>

              {dailyTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--color-background)', borderRadius: '10px', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>
                  <Clock size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>Aucune activité enregistrée pour ce {selectedDay}.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.8 }}>Utilisez le formulaire ci-dessus pour ajouter vos réalisations.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dailyTasks.map((t, idx) => {
                    const hasSubtitle = t.title && t.description && t.title.trim() !== t.description.trim();
                    const displayTitle = t.title || t.description;

                    return (
                      <div 
                        key={t.id || idx}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '14px 18px', borderRadius: '10px', background: 'var(--color-background)',
                          border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '240px' }}>
                          <button 
                            onClick={() => handleToggleTaskStatus(t.id)}
                            disabled={isWeekLocked}
                            style={{ background: 'none', border: 'none', cursor: isWeekLocked ? 'default' : 'pointer', padding: 0, marginTop: '2px' }}
                            title="Cliquer pour changer de statut"
                          >
                            {t.status === 'Effectuée' && <CheckCircle size={20} color="#10B981" />}
                            {t.status === 'En cours' && <Clock size={20} color="#3B82F6" />}
                            {t.status === 'Restante' && <AlertCircle size={20} color="#F59E0B" />}
                            {t.status === 'Bloquée' && <AlertCircle size={20} color="#EF4444" />}
                          </button>

                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', textDecoration: t.status === 'Effectuée' ? 'line-through' : 'none', color: t.status === 'Effectuée' ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                              {displayTitle}
                            </div>
                            {hasSubtitle && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                                {t.description}
                              </div>
                            )}
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '5px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {t.category && <span style={{ background: 'var(--color-card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontWeight: 600 }}>🏷️ {t.category}</span>}
                              {t.difficulty && <span style={{ color: '#EF4444', fontWeight: 500 }}>⚠️ Difficulté : {t.difficulty}</span>}
                              {t.timeSpent && <span>⏱️ Durée : {t.timeSpent}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            onClick={() => handleToggleTaskStatus(t.id)}
                            style={{
                              fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', cursor: isWeekLocked ? 'default' : 'pointer',
                              background: t.status === 'Effectuée' ? '#ECFDF5' : t.status === 'En cours' ? '#EFF6FF' : t.status === 'Bloquée' ? '#FEF2F2' : '#FFFBEB',
                              color: t.status === 'Effectuée' ? '#059669' : t.status === 'En cours' ? '#2563EB' : t.status === 'Bloquée' ? '#DC2626' : '#D97706',
                              border: '1px solid currentColor'
                            }}
                          >
                            {t.status}
                          </span>

                          {!isWeekLocked && (
                            <button className="icon-button text-error" onClick={() => handleDeleteTask(t.id)} title="Supprimer">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= ONGLET 2 : MON RAPPORT HEBDOMADAIRE ================= */}
      {!isDirection && activeTab === 'report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* BANDEAU D'ÉTAT DU RAPPORT */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderLeft: isWeekLocked ? '4px solid #10B981' : '4px solid #F59E0B' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>STATUT DU RAPPORT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isWeekLocked ? '#059669' : '#D97706' }}>
                {currentWeeklyReport?.status === 'Validé' ? '✅ Validé par la Direction' : currentWeeklyReport?.status === 'Soumis' ? '🔒 Soumis à la Direction' : '📝 Brouillon en préparation'}
              </div>
              {currentWeeklyReport?.submittedAt && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Soumis le {new Date(currentWeeklyReport.submittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isWeekLocked && (
                <button className="btn btn-secondary" onClick={handleConsolidateWeek} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔄 Importer les activités journalières
                </button>
              )}

              <button className="btn btn-secondary" onClick={() => handlePreviewPdf()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={16} /> Aperçu PDF Certifié
              </button>

              {!isWeekLocked ? (
                <>
                  <button className="btn btn-secondary" onClick={handleSaveDraft}>
                    💾 Sauvegarder brouillon
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmitReport} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#059669' }}>
                    <Send size={16} /> SOUMETTRE À LA DIRECTION
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => handlePreviewPdf()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={16} /> Télécharger Attestation PDF
                </button>
              )}
            </div>
          </div>

          {/* COMMENTAIRE DIRECTION SI PRÉSENT */}
          {currentWeeklyReport?.directorComment && (
            <div className="card" style={{ padding: '16px 20px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div style={{ fontWeight: 'bold', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} /> Retour / Annotation de la Direction
              </div>
              <p style={{ margin: '6px 0 0', color: '#1E3A8A', fontSize: '0.95rem' }}>
                {currentWeeklyReport.directorComment}
              </p>
            </div>
          )}

          {/* CONTENU DU RAPPORT */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* OBJECTIFS DE LA SEMAINE */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>
                  1. Objectifs initiaux de la semaine
                </label>
                <textarea
                  className="table-input"
                  rows={2}
                  placeholder="Quels étaient les objectifs fixés pour cette semaine ?"
                  value={weeklyObjectives}
                  onChange={e => setWeeklyObjectives(e.target.value)}
                  disabled={isWeekLocked}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* SYNTHÈSE & RÉALISATIONS CLÉS */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>
                  2. Synthèse globale & Réalisations clés accomplies
                </label>
                <textarea
                  className="table-input"
                  rows={4}
                  placeholder="Détaillez les principaux résultats concrets obtenus (contrats signés, livrables, affaires traitées)..."
                  value={achievements}
                  onChange={e => setAchievements(e.target.value)}
                  disabled={isWeekLocked}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* DIFFICULTÉS & POINTS BLOQUANTS */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem', color: '#DC2626' }}>
                  3. Difficultés & Points d'arbitrage nécessitant l'appui de la Direction
                </label>
                <textarea
                  className="table-input"
                  rows={3}
                  placeholder="Mentionnez les blocages techniques, retards clients ou ressources manquantes..."
                  value={difficulties}
                  onChange={e => setDifficulties(e.target.value)}
                  disabled={isWeekLocked}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* PERSPECTIVES & OBJECTIFS S+1 */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem', color: '#2563EB' }}>
                  4. Perspectives & Priorités pour la semaine prochaine (S+1)
                </label>
                <textarea
                  className="table-input"
                  rows={3}
                  placeholder="Quels sont les objectifs prioritaires et dossiers clés prévus pour la semaine prochaine ?"
                  value={nextWeekObjectives}
                  onChange={e => setNextWeekObjectives(e.target.value)}
                  disabled={isWeekLocked}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ONGLET 3 : MES RAPPORTS SOUMIS (HISTORIQUE) ================= */}
      {!isDirection && activeTab === 'history' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>
            Historique de mes rapports hebdomadaires
          </h3>

          <div className="table-responsive">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Semaine</th>
                  <th>Date de soumission</th>
                  <th>Statut</th>
                  <th>Retour Direction</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {v2WeeklyReports
                  .filter(r => r.authorId === currentUser?.id)
                  .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                  .map(rep => (
                    <tr key={rep.id}>
                      <td data-label="Semaine">
                        <strong>Semaine du {new Date(rep.weekStart + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                      </td>
                      <td data-label="Date de soumission">
                        {rep.submittedAt ? new Date(rep.submittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Non soumis'}
                      </td>
                      <td data-label="Statut">
                        <span className={`badge-status ${rep.status === 'Validé' ? 'bg-success' : rep.status === 'Soumis' ? 'bg-info' : 'bg-warning'}`}>
                          {rep.status}
                        </span>
                      </td>
                      <td data-label="Retour Direction">
                        {rep.directorComment ? (
                          <span style={{ fontSize: '0.85rem', color: '#1E40AF' }}>💬 {rep.directorComment}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                            onClick={() => handlePreviewPdf(rep)}
                            title="Aperçu / Télécharger PDF"
                          >
                            <Eye size={14} style={{ marginRight: '4px' }} /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {v2WeeklyReports.filter(r => r.authorId === currentUser?.id).length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      Aucun rapport soumis pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= COCKPIT SUPERVISION DIRECTION : RAPPORTS ÉQUIPE ================= */}
      {isDirection && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* COCKPIT KPIS DIRECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>EFFECTIF ATTENDU</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '4px' }}>{activeStaff.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Collaborateurs actifs</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>RAPPORTS REÇUS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>
                {submittedStaffIds.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>Rapports officiels soumis</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>EN ATTENTE / RETARDATAIRES</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: pendingStaff.length > 0 ? '#DC2626' : '#059669', marginTop: '4px' }}>
                {pendingStaff.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Rapports non encore soumis</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TAUX DE COMPLÉTION</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: completionRate >= 80 ? '#059669' : '#D97706', marginTop: '4px' }}>
                {completionRate}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: completionRate >= 80 ? '#10B981' : '#F59E0B' }} />
              </div>
            </div>
          </div>

          {/* BARRE D'ACTIONS DIRECTION & FILTRES */}
          <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted)' }} />
                <input 
                  className="table-input" 
                  placeholder="Rechercher un collaborateur..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              <select className="table-input" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
                <option value="ALL">Tous les départements / services</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select className="table-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ALL">Tous les statuts</option>
                <option value="SOUMIS">✅ Rapports Reçus ({submittedStaffIds.length})</option>
                <option value="ATTENTE">⏳ En Attente ({pendingStaff.length})</option>
              </select>
            </div>

            {pendingStaff.length > 0 && (
              <button 
                className="btn btn-primary" 
                onClick={handleRemindAllPending}
                style={{ background: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Bell size={16} /> Relancer les retardataires ({pendingStaff.length})
              </button>
            )}
          </div>

          {/* TABLEAU DES COLLABORATEURS ET DES RAPPORTS */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="table-responsive">
              <table className="data-table responsive-table">
                <thead>
                  <tr>
                    <th>Collaborateur</th>
                    <th>Département</th>
                    <th>Rôle</th>
                    <th>Statut Rapport</th>
                    <th>Date Soumission</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffList.map(member => {
                    const memberReport = weeklyReportsForSelectedWeek.find(r => r.authorId === member.id);
                    const isSubmitted = memberReport?.status === 'Soumis' || memberReport?.status === 'Validé';
                    const serviceName = services.find(s => s.id === member.serviceId)?.name || 'Général';

                    return (
                      <tr key={member.id}>
                        <td data-label="Collaborateur">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong>{member.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Département">{serviceName}</td>
                        <td data-label="Rôle">{member.role}</td>
                        <td data-label="Statut Rapport">
                          {isSubmitted ? (
                            <span className={`badge-status ${memberReport?.status === 'Validé' ? 'bg-success' : 'bg-info'}`}>
                              {memberReport?.status === 'Validé' ? '✅ Validé' : '📩 Reçu (Soumis)'}
                            </span>
                          ) : (
                            <span className="badge-status bg-error" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                              ⏳ En attente
                            </span>
                          )}
                        </td>
                        <td data-label="Date Soumission">
                          {memberReport?.submittedAt ? new Date(memberReport.submittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {isSubmitted && memberReport ? (
                              <>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                  onClick={() => handlePreviewPdf(memberReport)}
                                  title="Consulter / Télécharger PDF"
                                >
                                  <Eye size={14} style={{ marginRight: '4px' }} /> PDF
                                </button>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#7C3AED' }}
                                  onClick={() => { setReviewingReport(memberReport); setReviewComment(memberReport.directorComment || ''); }}
                                  title="Annoter et Valider"
                                >
                                  <MessageSquare size={14} style={{ marginRight: '4px' }} /> Annoter
                                </button>
                              </>
                            ) : (
                              <button 
                                className="btn btn-secondary" 
                                style={{ fontSize: '0.8rem', padding: '4px 8px', color: '#DC2626' }}
                                onClick={async () => {
                                  await sendWeeklyReportReminder([member.id], currentWeekStart);
                                  toast.success(`Rappel envoyé à ${member.name}.`);
                                }}
                                title="Envoyer un rappel individuel"
                              >
                                <Bell size={14} style={{ marginRight: '4px' }} /> Relancer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VALIDATION & ANNOTATION DIRECTION */}
      {reviewingReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} color="#7C3AED" /> Retour & Validation de la Direction
            </h3>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Rapport de <strong>{users.find(u => u.id === reviewingReport.authorId)?.name}</strong> pour la semaine du {new Date(reviewingReport.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')}.
            </p>

            <div style={{ margin: '16px 0' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
                Commentaire / Remarques de la Direction :
              </label>
              <textarea 
                className="table-input"
                rows={4}
                placeholder="Indiquez vos félicitations, points d'amélioration ou directives pour la semaine suivante..."
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setReviewingReport(null)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleValidateReport} style={{ background: '#7C3AED' }}>
                Valider et Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APERÇU PDF CERTIFIÉ MODAL */}
      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
