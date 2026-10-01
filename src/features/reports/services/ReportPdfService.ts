import { jsPDF } from 'jspdf';
import type { User, V2WeeklyReport, V2DailyReport, V2Task, AppSettings } from '../../../context/AppContext';

/**
 * Nettoyage et assainissement strict des textes pour les polices standards jsPDF (Helvetica / WinAnsi).
 * Élimine tous les caractères Unicode corrupteurs (apostrophes courbes, puces non standards, emojis, symboles exotiques).
 */
export function cleanPdfText(text?: string | null): string {
  if (!text) return '';
  let str = String(text);

  // 1. Remplacements typographiques standards & symboles
  str = str
    .replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'") // Apostrophes courbes / backticks
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"') // Guillemets courbes & français
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-') // Tirets cadratin / demi-cadratin
    .replace(/\u2026/g, '...') // Points de suspension
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF\u25CB]/g, '-') // Puces
    .replace(/[\u00A0\u202F\u2007\u200B\uFEFF]/g, ' ') // Espaces insécables & zéro-largeur
    .replace(/\u20AC/g, 'EUR') // Symbole Euro
    .replace(/[\u2713\u2714\u2705]/g, 'OK') // Checkmarks
    .replace(/[\u274C\u274E\u2716]/g, 'X') // Croix
    .replace(/[\r\n]+/g, ' ') // Retours à la ligne normalisés en espace pour les segments
    .normalize('NFC');

  // 2. Suppression des emojis et caractères Unicode hors table WinAnsi (0x00 - 0xFF)
  str = str
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Emojis surrogate pairs
    .replace(/[\uFE00-\uFE0F]/g, '') // Variation selectors
    .replace(/[\u2190-\u21FF]/g, '') // Flèches
    .replace(/[\u2300-\u23FF]/g, '') // Symboles techniques
    .replace(/[\u2600-\u27BF]/g, '') // Symboles divers
    .replace(/[\u2B50-\u2B55]/g, '') // Étoiles
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' '); // Conserver uniquement ASCII imprimable + Latin-1 standard

  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Parser universel pour extraire un tableau de V2Task fiable depuis n'importe quel format (JSON string, objet, array).
 */
export function ensureTasksArray(raw: any): V2Task[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map((item, idx) => {
      if (typeof item === 'string') {
        return { id: `task-${idx}`, description: item, status: 'Effectuée' };
      }
      return item as V2Task;
    });
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return ensureTasksArray(parsed);
      if (typeof parsed === 'object' && parsed !== null) return [parsed as V2Task];
    } catch {
      return [{ id: '1', description: raw, status: 'Effectuée' }];
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    return [raw as V2Task];
  }
  return [];
}

/**
 * Construit l'objet jsPDF du Rapport Hebdomadaire V2 avec un rendu propre, garanti sans page blanche.
 */
export function buildV2WeeklyReportPdf(
  report: V2WeeklyReport, 
  author: User | null | undefined, 
  settings?: AppSettings,
  allDailyReports?: V2DailyReport[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
  // Logo entreprise (Haut gauche)
  let logoDrawn = false;
  if (settings?.headerLogoBase64 && typeof settings.headerLogoBase64 === 'string' && settings.headerLogoBase64.startsWith('data:image/')) {
    try {
      const isPng = settings.headerLogoBase64.includes('image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      doc.addImage(settings.headerLogoBase64, format, 18, 8, 80, 22);
      logoDrawn = true;
    } catch (e) {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136); // Teal #0D9488
    doc.text(cleanPdfText(settings?.companyName || 'HINOV GROUP'), 18, 20);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("GESTION COMMERCIALE & RAPPORT D'ACTIVITE", 18, 25);
  }

  // Cartouche Collaborateur (Haut droite)
  const cx = pageW - 24;
  const cy = 20;
  const r = 9;

  // Dessin du badge utilisateur avec initiales
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r, 'S');

  const authorName = author?.name || 'Collaborateur';
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 148, 136);
  doc.text(cleanPdfText(initials), cx, cy + 3, { align: 'center' });

  // Nom & Rôle du collaborateur
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(cleanPdfText(authorName), pageW - 38, 17, { align: 'right' });
  
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(cleanPdfText(author?.role || 'Commercial / Agent'), pageW - 38, 23, { align: 'right' });

  // Ligne de séparation sous en-tête
  y = 36;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.75);
  doc.line(18, y, pageW - 18, y);

  // ================= 2. BANNIÈRE DU RAPPORT =================
  y += 8;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(18, y, pageW - 36, 22, 3, 3, 'F');

  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("RAPPORT D'ACTIVITE HEBDOMADAIRE", 24, y + 8.5);

  const formatFrenchDate = (dStr: string) => {
    try {
      const d = new Date(dStr + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const weekEndStr = report.weekEnd ? formatFrenchDate(report.weekEnd) : '';
  const periodLabel = `Semaine du ${formatFrenchDate(report.weekStart)} ${weekEndStr ? `au ${weekEndStr}` : ''}`;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(cleanPdfText(`Periode : ${periodLabel}`), 24, y + 15.5);

  // Badge Statut
  const statusBadgeX = pageW - 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  if (report.status === 'Validé') {
    doc.setTextColor(5, 150, 105); // Vert
    doc.text("VALIDE PAR LA DIRECTION", statusBadgeX, y + 12.5, { align: 'right' });
  } else if (report.status === 'Soumis') {
    doc.setTextColor(13, 148, 136); // Teal
    doc.text("SOUMIS A LA DIRECTION", statusBadgeX, y + 12.5, { align: 'right' });
  } else {
    doc.setTextColor(217, 119, 6); // Ambre
    doc.text("BROUILLON EN COURS", statusBadgeX, y + 12.5, { align: 'right' });
  }

  y += 30;

  // ================= HELPERS DE SECTIONS =================
  const drawSectionHeading = (num: number, title: string) => {
    checkNewPage(18);
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(18, y - 4, 3, 9, 'F');

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(`${num}. ${title.toUpperCase()}`), 24, y + 2.5);
    y += 8.5;
  };

  const drawParagraph = (text?: string, fallback = 'Neant') => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const cleaned = cleanPdfText(text);
    const content = cleaned ? cleaned : cleanPdfText(fallback);
    const lines = doc.splitTextToSize(content, pageW - 40);
    lines.forEach((line: string) => {
      checkNewPage(7);
      doc.text(line, 22, y);
      y += 5.2;
    });
    y += 3.5;
  };

  // ================= 3. SECTIONS DU RAPPORT =================

  // Section 1 : Objectifs de la semaine
  drawSectionHeading(1, "Objectifs de la semaine");
  drawParagraph(report.weeklyObjectives, "Poursuite et traitement des affaires courantes.");

  // Section 2 : Synthèse générale & Faits marquants
  drawSectionHeading(2, "Synthese globale & Faits marquants");
  drawParagraph(
    report.aiSummary || report.summary || report.conclusion,
    "Ce rapport hebdomadaire recapitule l'ensemble des activites, echanges commerciaux et livrables realises par le collaborateur."
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

  // S'assurer que chaque jour contient bien un tableau de tâches
  Object.keys(rawTasksByDay).forEach(k => {
    rawTasksByDay[k] = ensureTasksArray(rawTasksByDay[k]);
  });

  // Hydratation automatique depuis allDailyReports si les activités sont absentes ou vides
  const candidateAuthorIds = [report.authorId, author?.id].filter(Boolean) as string[];
  if (allDailyReports && allDailyReports.length > 0 && report.weekStart) {
    try {
      const startDate = new Date(report.weekStart + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const formattedDate = `${yStr}-${mStr}-${dStr}`;
        const frenchDay = standardDays[i] || 'Dimanche';

        const existingTasks = rawTasksByDay[frenchDay] || rawTasksByDay[frenchDay.toLowerCase()] || [];
        if (!Array.isArray(existingTasks) || existingTasks.length === 0) {
          const matchDaily = allDailyReports.find(dr => {
            const authorMatches = candidateAuthorIds.length === 0 || candidateAuthorIds.includes(dr.authorId);
            const dateMatches = dr.date === formattedDate || dr.date?.startsWith(formattedDate);
            return authorMatches && dateMatches;
          });
          if (matchDaily) {
            const parsedDailyTasks = ensureTasksArray(matchDaily.tasks);
            if (parsedDailyTasks.length > 0) {
              rawTasksByDay[frenchDay] = parsedDailyTasks;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erreur lors du traitement des activites quotidiennes:', err);
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

  // 2. Autres clés éventuelles (ex: dates directes ou Dimanche)
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

  drawSectionHeading(3, "Journal detaille des activites quotidiennes");

  if (displayDays.length > 0) {
    displayDays.forEach(({ dayLabel, tasks }) => {
      checkNewPage(18);
      
      // Puce pour le jour
      doc.setFillColor(13, 148, 136);
      doc.circle(22, y - 1, 1.4, 'F');

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136);
      doc.text(cleanPdfText(dayLabel.toUpperCase()), 26, y);
      y += 5.5;

      tasks.forEach((t: any) => {
        checkNewPage(12);
        
        const status = typeof t === 'object' && t ? (t.status || 'Effectuée') : 'Effectuée';
        const difficulty = typeof t === 'object' && t ? t.difficulty : undefined;
        const timeSpent = typeof t === 'object' && t ? t.timeSpent : undefined;
        const category = typeof t === 'object' && t ? t.category : undefined;

        // Puce colorée selon le statut
        if (status === 'Effectuée' || status === 'Effectuee') {
          doc.setFillColor(5, 150, 105); // Vert
        } else if (status === 'Bloquée' || status === 'Bloquee') {
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
        if (difficulty) taskDesc += ` [Difficulte: ${cleanPdfText(difficulty)}]`;
        if (timeSpent) taskDesc += ` (${cleanPdfText(timeSpent)})`;

        const lines = doc.splitTextToSize(taskDesc || 'Activite enregistree', pageW - 56);
        lines.forEach((l: string, i: number) => {
          if (i > 0) checkNewPage(5.5);
          doc.text(l, 30, y);
          y += 4.8;
        });
      });
      y += 2.5;
    });
    y += 3.5;
  } else {
    drawParagraph(undefined, "Aucune tache journaliere detaillee n'a ete enregistree pour cette semaine.");
  }

  // Section 4 : Principaux résultats & Réalisations
  drawSectionHeading(4, "Principaux resultats & Realisations");
  drawParagraph(
    report.achievements || report.conclusion,
    "Execution conforme des missions, traitement des requetes et suivi des objectifs hebdomadaires."
  );

  // Section 5 : Difficultés rencontrées & Demandes d'arbitrage
  drawSectionHeading(5, "Difficultes rencontrees & Besoins d'arbitrage");
  drawParagraph(
    report.difficulties,
    "Aucun point de blocage majeur ni arbitrage particulier a signaler pour cette periode."
  );

  // Section 6 : Plan d'action & Perspectives semaine N+1
  drawSectionHeading(6, "Plan d'action & Perspectives (Semaine N+1)");
  drawParagraph(
    report.nextWeekObjectives,
    "Assurer la continuite des affaires, le suivi des dossiers clients et la prospection commerciale."
  );

  // Section 7 : Visa & Commentaire Direction (si présent)
  if (report.directorComment || report.status === 'Validé' || report.status === 'Relu') {
    checkNewPage(26);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(18, y, pageW - 36, 20, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text("VISA & COMMENTAIRE DE LA DIRECTION :", 24, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const comment = cleanPdfText(report.directorComment || "Rapport valide sans reserve par la Direction.");
    doc.text(comment, 24, y + 13);
    y += 26;
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
    doc.text(cleanPdfText(settings?.companyName || 'HINOV GROUP - CRM B2B'), 18, pageH - 9);
    doc.text(`Page ${i} sur ${totalPages}`, pageW - 18, pageH - 9, { align: 'right' });
    doc.text("Document confidentiel a usage interne", pageW / 2, pageH - 9, { align: 'center' });
  }

  return doc;
}

export function generateV2WeeklyReportPdf(
  report: V2WeeklyReport, 
  author: User | null | undefined, 
  settings?: AppSettings, 
  allDailyReports?: V2DailyReport[]
) {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  const authorName = (author?.name || 'collaborateur').toLowerCase().replace(/\s+/g, '_');
  doc.save(`rapport_hebdo_${authorName}_${report.weekStart}.pdf`);
}

export function getV2WeeklyReportPdfBlobUrl(
  report: V2WeeklyReport, 
  author: User | null | undefined, 
  settings?: AppSettings, 
  allDailyReports?: V2DailyReport[]
): string {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function getV2WeeklyReportPdfDataUrl(
  report: V2WeeklyReport, 
  author: User | null | undefined, 
  settings?: AppSettings, 
  allDailyReports?: V2DailyReport[]
): string {
  const doc = buildV2WeeklyReportPdf(report, author, settings, allDailyReports);
  return doc.output('dataurlstring');
}
