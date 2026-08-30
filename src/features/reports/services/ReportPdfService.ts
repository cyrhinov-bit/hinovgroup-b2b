import { jsPDF } from 'jspdf';
import type { User, V2WeeklyReport, AppSettings } from '../../../context/AppContext';

export function buildV2WeeklyReportPdf(report: V2WeeklyReport, author: User | null | undefined, settings?: AppSettings): jsPDF {
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
  // Logo entreprise (Haut gauche)
  if (settings?.headerLogoBase64) {
    try {
      doc.addImage(settings.headerLogoBase64, 'PNG', 18, 12, 50, 16);
    } catch {
      // fallback text
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136); // Teal
      doc.text(settings?.companyName || 'HINOV GROUP', 18, 20);
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136); // Teal
    doc.text(settings?.companyName || 'HINOV GROUP', 18, 20);
  }

  // Cartouche Collaborateur avec Photo de profil ronde (Haut droite)
  const cx = pageW - 24;
  const cy = 20;
  const r = 9;

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
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(author?.name || 'Collaborateur', pageW - 36, 17, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(author?.role || 'Commercial', pageW - 36, 22, { align: 'right' });

  // Ligne de séparation élégante
  y = 33;
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

  const drawParagraph = (text?: string, fallback = 'Néant') => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const content = text && text.trim() ? text.trim() : fallback;
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

  // Section 2 : Synthèse générale
  if (report.aiSummary || report.summary) {
    drawSectionHeading(2, "Synthèse globale & Faits marquants");
    drawParagraph(report.aiSummary || report.summary);
  }

  // Section 3 : Journal détaillé des tâches (Lundi -> Samedi)
  const taskDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].filter(
    d => report.tasksByDay?.[d] && report.tasksByDay[d].length > 0
  );

  if (taskDays.length > 0) {
    drawSectionHeading(3, "Journal détaillé des tâches quotidiennes");

    taskDays.forEach(day => {
      checkNewPage(18);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136);
      doc.text(`📅 ${day}`, 22, y);
      y += 6;

      const tasks = report.tasksByDay[day] || [];
      tasks.forEach(t => {
        checkNewPage(12);
        
        // Checkmark / status dot
        doc.setFontSize(8.5);
        if (t.status === 'Effectuée') {
          doc.setTextColor(5, 150, 105);
          doc.text("✔", 25, y);
        } else if (t.status === 'Bloquée') {
          doc.setTextColor(220, 38, 38);
          doc.text("✖", 25, y);
        } else {
          doc.setTextColor(217, 119, 6);
          doc.text("●", 25, y);
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        let taskDesc = t.description;
        if (t.difficulty) taskDesc += ` [Difficulté: ${t.difficulty}]`;
        if (t.timeSpent) taskDesc += ` (${t.timeSpent})`;

        const lines = doc.splitTextToSize(taskDesc, pageW - 56);
        lines.forEach((l: string, i: number) => {
          if (i > 0) checkNewPage(6);
          doc.text(l, 31, y);
          y += 5;
        });
      });
      y += 3;
    });
    y += 4;
  }

  // Section 4 : Principaux résultats & Réalisations
  if (report.achievements) {
    drawSectionHeading(4, "Principaux résultats & Réalisations");
    drawParagraph(report.achievements);
  }

  // Section 5 : Difficultés rencontrées & Demandes d'arbitrage
  if (report.difficulties) {
    drawSectionHeading(5, "Difficultés rencontrées & Besoins d'arbitrage");
    drawParagraph(report.difficulties);
  }

  // Section 6 : Plan d'action & Perspectives semaine N+1
  drawSectionHeading(6, "Plan d'action & Perspectives (Semaine N+1)");
  drawParagraph(report.nextWeekObjectives, "Assurer la continuité des affaires et la prospection commerciale.");

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

export function generateV2WeeklyReportPdf(report: V2WeeklyReport, author: User | null | undefined, settings?: AppSettings) {
  const doc = buildV2WeeklyReportPdf(report, author, settings);
  const authorName = (author?.name || 'collaborateur').toLowerCase().replace(/\s+/g, '_');
  doc.save(`rapport_hebdo_${authorName}_${report.weekStart}.pdf`);
}
