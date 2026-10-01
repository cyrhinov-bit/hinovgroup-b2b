import { jsPDF } from 'jspdf';
import type { User, V2WeeklyReport, V2DailyReport, V2Task, AppSettings } from '../../../context/AppContext';

export function buildV2WeeklyReportPdf(
  report: V2WeeklyReport, 
  author: User | null | undefined, 
  settings?: AppSettings,
  allDailyReports?: V2DailyReport[]
): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 16;

  // Helper check for new page
  const checkNewPage = (neededSpace = 25) => {
    if (y + neededSpace > pageH - 20) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // ================= 1. EN-TÊTE OFFICIEL =================
  // Logo entreprise (Haut gauche - Espace élargi)
  if (settings?.headerLogoBase64) {
    try {
      doc.addImage(settings.headerLogoBase64, 'PNG', 18, 8, 90, 25);
    } catch {
      try {
        doc.addImage(settings.headerLogoBase64, 'JPEG', 18, 8, 90, 25);
      } catch {
        // fallback text
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 148, 136); // Teal
        doc.text(settings?.companyName || 'HINOV GROUP', 18, 20);
      }
    }
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136); // Teal
    doc.text(settings?.companyName || 'HINOV GROUP', 18, 20);
  }

  // Cartouche Collaborateur avec Photo de profil ronde (Haut droite)
  const cx = pageW - 24;
  const cy = 20;
  const r = 10;

  if (author?.photo) {
    try {
      doc.saveGraphicsState();
      doc.circle(cx, cy, r, 'S');
      doc.clip();
      doc.addImage(author.photo, 'PNG', cx - r, cy - r, r * 2, r * 2);
      doc.restoreGraphicsState();
    } catch {
      drawInitialsBadge(doc, cx, cy, r, author?.name || '?');
    }
  } else {
    drawInitialsBadge(doc, cx, cy, r, author?.name || '?');
  }

  // Nom & Rôle du collaborateur
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(author?.name || 'Collaborateur', pageW - 38, 17, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(author?.role || 'Commercial', pageW - 38, 23, { align: 'right' });

  // Ligne de séparation élégante
  y = 38;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.75);
  doc.line(18, y, pageW - 18, y);

  // ================= 2. BANNIÈRE DU RAPPORT =================
  y += 8;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(18, y, pageW - 36, 22, 3, 3, 'F');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("RAPPORT D’ACTIVITÉ HEBDOMADAIRE", 24, y + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const formatFrenchDate = (dStr: string) => {
    try {
      return new Date(dStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const weekEndStr = report.weekEnd ? formatFrenchDate(report.weekEnd) : '';
  const periodLabel = `Semaine du ${formatFrenchDate(report.weekStart)} ${weekEndStr ? `au ${weekEndStr}` : ''}`;
  doc.text(`Période : ${periodLabel}`, 24, y + 16);

  // Statut du rapport
  const statusBadgeX = pageW - 24;
  doc.setFont('helvetica', 'bold');
  if (report.status === 'Validé') {
    doc.setTextColor(5, 150, 105); // Green
    doc.text("✓ VALIDÉ PAR LA DIRECTION", statusBadgeX, y + 13, { align: 'right' });
  } else if (report.status === 'Soumis') {
    doc.setTextColor(13, 148, 136); // Teal
    doc.text("SOUMIS À LA DIRECTION", statusBadgeX, y + 13, { align: 'right' });
  } else {
    doc.setTextColor(217, 119, 6); // Amber
    doc.text("BROUILLON EN COURS", statusBadgeX, y + 13, { align: 'right' });
  }

  y += 30;

  // ================= HELPERS DE SECTIONS =================
  const drawSectionHeading = (num: number, title: string) => {
    checkNewPage(20);
    doc.setFillColor(13, 148, 136); // Teal bar
    doc.rect(18, y - 4, 3, 10, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${num}. ${title.toUpperCase()}`, 25, y + 3);
    y += 10;
  };

  const cleanPdfText = (text?: string | null): string => {
    if (!text) return '';
    return text
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Emojis surrogates
      .replace(/[\u2600-\u27BF]/g, '') // Symbols
      .replace(/[\u2018\u2019]/g, "'") // Smart single quotes / apostrophes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/\u2026/g, '...') // Ellipsis
      .replace(/[\u2013\u2014]/g, '-') // En-dash & Em-dash
      .replace(/\u2022/g, '-') // Bullet
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  };

  const drawParagraph = (text?: string, fallback = 'Néant') => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const cleaned = cleanPdfText(text);
    const content = cleaned ? cleaned : fallback;
    const lines = doc.splitTextToSize(content, pageW - 40);
    lines.forEach((line: string) => {
      checkNewPage(8);
      doc.text(line, 22, y);
      y += 5.5;
    });
    y += 4;
  };

  // ================= 3. SECTIONS DU RAPPORT =================

  // Section 1 : Objectifs de la semaine
  drawSectionHeading(1, "Objectifs de la semaine");
  drawParagraph(report.weeklyObjectives, "Poursuite et traitement des affaires courantes.");

  // Section 2 : Synthèse générale & Faits marquants
  drawSectionHeading(2, "Synthèse globale & Faits marquants");
  drawParagraph(
    report.aiSummary || report.summary || report.conclusion,
    "Ce rapport hebdomadaire récapitule les activités, échanges et livrables menés à bien par le collaborateur au cours de la semaine."
  );

  // Section 3 : Journal détaillé des tâches (Lundi -> Samedi)
  const standardDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  let rawTasksByDay: Record<string, V2Task[]> = {};

  if (typeof report.tasksByDay === 'string') {
    try {
      rawTasksByDay = JSON.parse(report.tasksByDay);
    } catch {
      rawTasksByDay = {};
    }
  } else if (report.tasksByDay && typeof report.tasksByDay === 'object') {
    rawTasksByDay = { ...report.tasksByDay };
  }

  // Hydratation / Fallback automatique depuis allDailyReports si nécessaire
  const authorId = report.authorId || author?.id || '';
  if (allDailyReports && allDailyReports.length > 0 && report.weekStart) {
    try {
      const startDate = new Date(report.weekStart + 'T00:00:00');
      for (let i = 0; i < 6; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const formattedDate = `${yStr}-${mStr}-${dStr}`;
        const frenchDay = standardDays[i];

        const existingTasks = rawTasksByDay[frenchDay] || rawTasksByDay[frenchDay.toLowerCase()] || [];
        if (!Array.isArray(existingTasks) || existingTasks.length === 0) {
          const matchDaily = allDailyReports.find(dr => 
            dr.authorId === authorId && 
            (dr.date === formattedDate || dr.date?.startsWith(formattedDate))
          );
          if (matchDaily && Array.isArray(matchDaily.tasks) && matchDaily.tasks.length > 0) {
            rawTasksByDay[frenchDay] = matchDaily.tasks;
          }
        }
      }
    } catch (err) {
      console.warn('Erreur lors du fallback des activités quotidiennes:', err);
    }
  }

  // Construction de la liste ordonnée des jours avec tâches
  const displayDays: { dayLabel: string; tasks: V2Task[] }[] = [];

  // 1. Jours standards Lundi -> Samedi
  standardDays.forEach(day => {
    const matchedKey = Object.keys(rawTasksByDay).find(k => k.toLowerCase() === day.toLowerCase());
    const tasks = matchedKey ? rawTasksByDay[matchedKey] : (rawTasksByDay[day] || []);
    if (Array.isArray(tasks) && tasks.length > 0) {
      displayDays.push({ dayLabel: day, tasks });
    }
  });

  // 2. Autres clés éventuelles (ex: dates ISO YYYY-MM-DD ou Dimanche)
  Object.keys(rawTasksByDay).forEach(key => {
    const isStandard = standardDays.some(sd => sd.toLowerCase() === key.toLowerCase());
    if (!isStandard) {
      const tasks = rawTasksByDay[key];
      if (Array.isArray(tasks) && tasks.length > 0) {
        let label = key;
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          try {
            const d = new Date(key + 'T00:00:00');
            const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
            const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            const formattedDate = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            label = `${dayCapitalized} (${formattedDate})`;
          } catch {
            label = key;
          }
        }
        displayDays.push({ dayLabel: label, tasks });
      }
    }
  });

  drawSectionHeading(3, "Journal détaillé des tâches quotidiennes");

  if (displayDays.length > 0) {
    displayDays.forEach(({ dayLabel, tasks }) => {
      checkNewPage(18);
      
      // Puce vectorielle élégante pour le jour
      doc.setFillColor(13, 148, 136);
      doc.circle(22, y - 1, 1.5, 'F');

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136);
      doc.text(dayLabel.toUpperCase(), 26, y);
      y += 6;

      tasks.forEach((t: any) => {
        checkNewPage(12);
        
        const status = typeof t === 'object' && t ? (t.status || 'Effectuée') : 'Effectuée';
        const difficulty = typeof t === 'object' && t ? t.difficulty : undefined;
        const timeSpent = typeof t === 'object' && t ? t.timeSpent : undefined;
        const category = typeof t === 'object' && t ? t.category : undefined;

        // Puce vectorielle colorée selon le statut
        if (status === 'Effectuée') {
          doc.setFillColor(5, 150, 105); // Vert
        } else if (status === 'Bloquée') {
          doc.setFillColor(220, 38, 38); // Rouge
        } else if (status === 'En cours') {
          doc.setFillColor(37, 99, 235); // Bleu
        } else {
          doc.setFillColor(217, 119, 6); // Ambre
        }
        doc.circle(25, y - 1, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        
        let rawDesc = '';
        if (typeof t === 'string') {
          rawDesc = t;
        } else if (typeof t === 'object' && t) {
          if (t.title && t.description && t.title.trim() !== t.description.trim()) {
            rawDesc = `[${t.title.trim()}] ${t.description.trim()}`;
          } else {
            rawDesc = t.title || t.description || t.label || t.task || t.content || JSON.stringify(t);
          }
        }
        
        let taskDesc = cleanPdfText(rawDesc);
        if (category) taskDesc = `[${cleanPdfText(category)}] ${taskDesc}`;
        if (difficulty) taskDesc += ` [Difficulté: ${cleanPdfText(difficulty)}]`;
        if (timeSpent) taskDesc += ` (${cleanPdfText(timeSpent)})`;

        const lines = doc.splitTextToSize(taskDesc || 'Activité enregistrée', pageW - 56);
        lines.forEach((l: string, i: number) => {
          if (i > 0) checkNewPage(6);
          doc.text(l, 30, y);
          y += 5;
        });
      });
      y += 3;
    });
    y += 4;
  } else {
    drawParagraph(undefined, "Aucune tâche journalière détaillée n'a été enregistrée pour cette semaine.");
  }

  // Section 4 : Principaux résultats & Réalisations
  drawSectionHeading(4, "Principaux résultats & Réalisations");
  drawParagraph(
    report.achievements || report.conclusion,
    "Exécution conforme des missions, traitement des requêtes et suivi des objectifs hebdomadaires."
  );

  // Section 5 : Difficultés rencontrées & Demandes d'arbitrage
  drawSectionHeading(5, "Difficultés rencontrées & Besoins d'arbitrage");
  drawParagraph(
    report.difficulties,
    "Aucun point de blocage majeur ni arbitrage particulier à signaler pour cette période."
  );

  // Section 6 : Plan d'action & Perspectives semaine N+1
  drawSectionHeading(6, "Plan d'action & Perspectives (Semaine N+1)");
  drawParagraph(
    report.nextWeekObjectives,
    "Assurer la continuité des affaires, le suivi des dossiers clients et la prospection commerciale."
  );

  // Section 7 : Visa & Commentaire Direction (si présent)
  if (report.directorComment || report.status === 'Validé') {
    checkNewPage(28);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(18, y, pageW - 36, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("VISA & COMMENTAIRE DE LA DIRECTION :", 24, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(report.directorComment || "Rapport validé sans réserve par la Direction.", 24, y + 14);
    y += 28;
  }

  // ================= 4. PIED DE PAGE AUTOMATIQUE SUR TOUTES LES PAGES =================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(18, pageH - 14, pageW - 18, pageH - 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(settings?.companyName || 'HINOV GROUP - CRM B2B', 18, pageH - 9);
    doc.text(`Page ${i} sur ${totalPages}`, pageW - 18, pageH - 9, { align: 'right' });
    doc.text("Document confidentiel à usage interne", pageW / 2, pageH - 9, { align: 'center' });
  }

  return doc;
}

function drawInitialsBadge(doc: jsPDF, cx: number, cy: number, r: number, name: string) {
  doc.setFillColor(241, 245, 249);
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.circle(cx, cy, r, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 148, 136);
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  doc.text(initials, cx, cy + 2.5, { align: 'center' });
}

export function generateV2WeeklyReportPdf(report: V2WeeklyReport, author: User | null | undefined, settings?: AppSettings, allDailyReports?: V2DailyReport[]) {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  const authorName = (author?.name || 'collaborateur').toLowerCase().replace(/\s+/g, '_');
  doc.save(`rapport_hebdo_${authorName}_${report.weekStart}.pdf`);
}

export function getV2WeeklyReportPdfBlobUrl(report: V2WeeklyReport, author: User | null | undefined, settings?: AppSettings, allDailyReports?: V2DailyReport[]): string {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function getV2WeeklyReportPdfDataUrl(report: V2WeeklyReport, author: User | null | undefined, settings?: AppSettings, allDailyReports?: V2DailyReport[]): string {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  return doc.output('dataurlstring');
}
