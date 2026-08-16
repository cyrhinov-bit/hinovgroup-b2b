import { jsPDF } from 'jspdf';
import type { User, V2DailyReport, V2WeeklyReport, V2Task } from '../../../context/AppContext';

export function buildV2WeeklyReportPdf(report: V2WeeklyReport, author: User | null | undefined): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;
  
  // En-tête officiel
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("RAPPORT D’ACTIVITÉ DE SEMAINE", pageW / 2, y, { align: 'center' });
  
  y += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`➢ Semaine du : ${new Date(report.weekStart).toLocaleDateString('fr-FR')}`, 20, y);
  y += 8;
  doc.text(`➢ Projet : ${report.project}`, 20, y);
  y += 8;
  doc.text(`➢ Fait par : ${author?.name || 'Inconnu'}`, 20, y);
  
  y += 15;
  
  const drawSectionTitle = (title: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
  };

  const drawTextLines = (text: string, x: number) => {
    const lines = doc.splitTextToSize(text || 'Néant', pageW - 40);
    lines.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, x, y);
      y += 6;
    });
    y += 4;
  };

  // 1. OBJECTIFS DE LA SEMAINE
  drawSectionTitle("1. OBJECTIFS DE LA SEMAINE");
  drawTextLines(report.weeklyObjectives, 20);

  // 2. TÂCHES EFFECTUÉES
  drawSectionTitle("2. TÂCHES EFFECTUÉES");
  const taskDays = Object.keys(report.tasksByDay);
  if (taskDays.length > 0) {
    taskDays.forEach(day => {
      const tasksForDay = report.tasksByDay[day] || [];
      if (tasksForDay.length > 0) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.text(day, 20, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        tasksForDay.forEach(t => {
          if (y > 280) { doc.addPage(); y = 20; }
          const taskText = `• ${t.description} [${t.status}]`;
          const lines = doc.splitTextToSize(taskText, pageW - 45);
          doc.text(lines, 25, y);
          y += 6 * lines.length;
        });
        y += 4;
      }
    });
  } else {
    drawTextLines('Aucune tâche.', 20);
  }

  // 3. TÂCHES EN COURS D'EXÉCUTION
  drawSectionTitle("3. TÂCHES EN COURS D'EXÉCUTION");
  if (report.pendingTasks && report.pendingTasks.length > 0) {
    report.pendingTasks.forEach(t => {
      if (y > 280) { doc.addPage(); y = 20; }
      const taskText = `• ${t.description}`;
      const lines = doc.splitTextToSize(taskText, pageW - 45);
      doc.text(lines, 25, y);
      y += 6 * lines.length;
    });
    y += 4;
  } else {
    drawTextLines('Aucune tâche en cours.', 20);
  }

  // 4. BILAN DE LA SEMAINE
  drawSectionTitle("4. BILAN DE LA SEMAINE");
  drawTextLines(report.summary, 20);

  // 5. OBJECTIFS DE LA SEMAINE SUIVANTE
  drawSectionTitle("5. OBJECTIFS DE LA SEMAINE SUIVANTE");
  drawTextLines(report.nextWeekObjectives, 20);

  // CONCLUSION
  drawSectionTitle("CONCLUSION");
  drawTextLines(report.conclusion, 20);
  
  y += 10;
  if (y > 250) { doc.addPage(); y = 20; }
  
  // Signature
  doc.text(`Fait à Abidjan, le ${new Date().toLocaleDateString('fr-FR')}`, 20, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text(author?.name || '', 20, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(author?.role || '', 20, y);
  
  return doc;
}

export function generateV2WeeklyReportPdf(report: V2WeeklyReport, author: User | null | undefined) {
  const doc = buildV2WeeklyReportPdf(report, author);
  const safeName = author?.name ? author.name.replace(/\s+/g, '_') : 'Inconnu';
  doc.save(`Rapport_Hebdomadaire_${safeName}_${report.weekStart}.pdf`);
}
