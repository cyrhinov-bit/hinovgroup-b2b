import { jsPDF } from 'jspdf';
import type { Quote, Sale, Client, AppSettings, ActivityReport, WeeklyReport, User, Prospect, Service, Category } from '../context/AppContext';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function drawHeader(doc: jsPDF, settings: AppSettings, x: number, y: number): number {
  if (settings.headerLogoBase64) {
    try {
      doc.addImage(settings.headerLogoBase64, 'PNG', x, y, 60, 20);
      return y + 26;
    } catch {
      // fallback to text
    }
  }
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.companyName || 'Entreprise', x, y + 6);
  return y + 12;
}

const REPORT_COLOR: [number, number, number] = [0, 150, 136];
const REPORT_LIGHT: [number, number, number] = [224, 242, 241];
const REPORT_GREY: [number, number, number] = [240, 244, 247];
const REPORT_DARK: [number, number, number] = [30, 34, 42];
const REPORT_MUTED: [number, number, number] = [110, 120, 130];


function drawExpHeader(doc: jsPDF, author: User | null | undefined, weekLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const headerH = 34;

  doc.setFillColor(...REPORT_COLOR);
  doc.rect(0, 0, pageW, 8, 'F');
  doc.rect(0, 0, pageW, headerH + 8, 'F');

  const cx = margin;
  const cy = 8 + headerH / 2;
  const r = 12;

  if (author?.photo) {
    try {
      doc.saveGraphicsState();
      doc.circle(cx, cy, r, 'S');
      doc.clip();
      doc.addImage(author.photo, 'PNG', cx - r, cy - r, r * 2, r * 2);
      doc.restoreGraphicsState();
    } catch {
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, r, 'F');
      doc.setFillColor(...REPORT_COLOR);
      doc.circle(cx, cy, r, 'S');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      const initials = (author?.name || '?')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      doc.text(initials, cx, cy + 4, { align: 'center' });
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r, 'F');
    doc.setFillColor(...REPORT_COLOR);
    doc.circle(cx, cy, r, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const initials = (author?.name || '?')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    doc.text(initials, cx, cy + 4, { align: 'center' });
  }

  const tx = cx + r + 8;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(author?.name || 'Expéditeur', tx, cy - 4);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(author?.role || '', tx, cy + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RAPPORT HEBDOMADAIRE', pageW - margin, cy - 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(weekLabel, pageW - margin, cy + 4, { align: 'right' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(margin, headerH + 8 + 2, pageW - margin, headerH + 8 + 2);

  return headerH + 8 + 18;
}

function drawKpiCards(doc: jsPDF, kpis: Record<string, number>, yStart: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const gap = 5;
  const cols = 4;
  const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = 22;
  let y = yStart;

  const defs: { key: string; label: string }[] = [
    { key: 'prospectsCrees', label: 'PROSPECTS CRÉÉS' },
    { key: 'prospectsConvertis', label: 'CONVERSIONS' },
    { key: 'relancesTerminees', label: 'RELANCES TERMINÉES' },
    { key: 'appels', label: 'APPELS' },
  ];

  defs.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const yy = y + row * (cardH + gap);

    doc.setFillColor(...REPORT_LIGHT);
    doc.roundedRect(x, yy, cardW, cardH, 2, 2, 'F');
    doc.setFillColor(...REPORT_COLOR);
    doc.rect(x, yy, 2.5, cardH, 'F');

    doc.setTextColor(...REPORT_COLOR);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(String(kpis[d.key] || 0), x + 7, yy + 10);

    doc.setTextColor(...REPORT_MUTED);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(d.label, x + 7, yy + 17);
  });

  return y + (rowsFor(defs.length, cols) * (cardH + gap)) + 4;
}

function rowsFor(count: number, cols: number) {
  return Math.ceil(count / cols);
}

function drawSynthesisTable(doc: jsPDF, kpis: Record<string, number>, yStart: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = yStart;

  const rows: { label: string; value: string }[] = [
    { label: 'Taux de conversion prospects', value: `${Math.round(((kpis.prospectsConvertis || 0) / (kpis.prospectsCrees || 1)) * 100)}%` },
    { label: 'Relances terminées', value: String(kpis.relancesTerminees || 0) },
    { label: 'Emails envoyés', value: String(kpis.emails || 0) },
    { label: 'Réunions et démos', value: String((kpis.reunions || 0) + (kpis.demos || 0)) },
  ];

  doc.setFillColor(...REPORT_COLOR);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('SYNTHÈSE DE LA SEMAINE', margin + 4, y + 5.5);
  y += 8;

rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(...REPORT_GREY);
    }
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_DARK);
    doc.text(row.label, margin + 4, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(row.value, pageW - margin - 4, y + 5.5, { align: 'right' });
    y += 8;
  });

  return y + 8;
}

export function buildWeeklyReportPdf(
  report: WeeklyReport,
  dailyReports: ActivityReport[],
  kpis: Record<string, number>,
  author: User | null | undefined,
  settings: AppSettings,
  weeklyProspects: Prospect[] = [],
  services: Service[] = [],
  categories: Category[] = []
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  const dayNames: Record<string, string> = {
    Mon: 'Lundi', Tue: 'Mardi', Wed: 'Mercredi', Thu: 'Jeudi', Fri: 'Vendredi', Sat: 'Samedi', Sun: 'Dimanche',
  };
  const start = new Date(report.weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmtDay = (d: Date) => `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const weekLabel = `Semaine du ${fmtDay(start)} au ${fmtDay(end)}`;

  let y = drawExpHeader(doc, author, weekLabel);

  const companyLine = settings.companyName ? (settings.companyAddress ? `${settings.companyName} - ${settings.companyAddress}` : settings.companyName) : '';
  if (companyLine) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...REPORT_MUTED);
    doc.text(companyLine, margin, y);
    y += 6;
  }

  // KPI cards
  y = drawKpiCards(doc, kpis, y);

  // Synthesis table
  y = drawSynthesisTable(doc, kpis, y);

  // Daily detail
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...REPORT_COLOR);
  doc.text('1. RAPPORT D\'ACTIVITÉ', margin, y);
  doc.setDrawColor(...REPORT_COLOR);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 2.5, pageW - margin, y + 2.5);
  y += 9;

  const sorted = [...dailyReports].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...REPORT_MUTED);
    doc.text('Aucun rapport journalier pour cette période.', margin, y + 4);
    y += 12;
  }

  for (const r of sorted) {
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    }
    const d = new Date(r.date + 'T00:00:00');
    const dayLabel = `${dayNames[d.toLocaleDateString('en-US', { weekday: 'short' })] || d.toLocaleDateString('fr-FR')} ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`;

    doc.setFillColor(...REPORT_COLOR);
    doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${dayLabel} — ${r.type}`, margin + 4, y + 6);
    y += 13;

    const sections: { label: string; value: string }[] = [
      { label: 'Réalisations', value: r.realisations },
      { label: 'Difficultés', value: r.difficultes },
      { label: 'Remarques', value: r.remarques },
    ];

    for (const s of sections) {
      if (!s.value) continue;
      if (y > pageH - 40) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...REPORT_COLOR);
      doc.text(s.label, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...REPORT_DARK);
      const lines = doc.splitTextToSize(s.value, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    }
    y += 2;
  }

  // Prospection detail
  if (weeklyProspects.length > 0) {
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    } else {
      y += 10;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...REPORT_COLOR);
    doc.text('2. RAPPORT DE PROSPECTION', margin, y);
    doc.setDrawColor(...REPORT_COLOR);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 2.5, pageW - margin, y + 2.5);
    y += 9;

    const groupedProspects: Record<string, Prospect[]> = {};
    for (const p of weeklyProspects) {
      const d = p.createdAt ? p.createdAt.split('T')[0] : '';
      if (d) {
        if (!groupedProspects[d]) groupedProspects[d] = [];
        groupedProspects[d].push(p);
      }
    }
    const sortedDates = Object.keys(groupedProspects).sort();

    for (const dStr of sortedDates) {
      const d = new Date(dStr + 'T00:00:00');
      const dayLabel = `${dayNames[d.toLocaleDateString('en-US', { weekday: 'short' })] || d.toLocaleDateString('fr-FR')} ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`;
      const dayProspects = groupedProspects[dStr];

      if (y > pageH - 30) {
        doc.addPage();
        y = margin;
      }
      doc.setFillColor(...REPORT_COLOR);
      doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${dayLabel} — ${dayProspects.length} prospect${dayProspects.length > 1 ? 's' : ''}`, margin + 4, y + 6);
      y += 13;

      for (const p of dayProspects) {
        if (y > pageH - 40) {
          doc.addPage();
          y = margin;
        }
        
        const serviceName = services.find(s => s.id === p.serviceId)?.name || '-';
        const categoryName = categories.find(c => c.id === p.categoryId)?.name || '-';
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...REPORT_DARK);
        doc.text(`${p.prospectNumber} - ${p.name}`, margin, y);
        y += 5;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const details = [
          `Type: ${p.type}`,
          `Société: ${p.company || '-'}`,
          `Téléphone: ${p.phone || '-'}`,
          `Email: ${p.email || '-'}`,
          `Adresse: ${p.address || '-'}`,
          `Ville: ${p.city || '-'}`,
          `Service: ${serviceName}`,
          `Catégorie: ${categoryName}`,
          `Niveau d'intérêt: ${p.interestLevel}`,
          `Source: ${p.source || '-'}`,
          `Statut: ${p.status}`
        ];
        
        for (const line of details) {
          if (y > pageH - 20) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin + 4, y);
          y += 5;
        }
        
        if (p.need || p.comments) {
          y += 2;
          if (p.need) {
             if (y > pageH - 25) { doc.addPage(); y = margin; }
             doc.setFont('helvetica', 'bold');
             doc.text('Besoin exprimé:', margin + 4, y);
             doc.setFont('helvetica', 'normal');
             y += 5;
             const lines = doc.splitTextToSize(p.need, contentW - 8);
             doc.text(lines, margin + 8, y);
             y += lines.length * 5;
          }
          if (p.comments) {
             y += 2;
             if (y > pageH - 25) { doc.addPage(); y = margin; }
             doc.setFont('helvetica', 'bold');
             doc.text('Commentaires:', margin + 4, y);
             doc.setFont('helvetica', 'normal');
             y += 5;
             const lines = doc.splitTextToSize(p.comments, contentW - 8);
             doc.text(lines, margin + 8, y);
             y += lines.length * 5;
          }
        }
        
        y += 4;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
      }
    }
    
    // Total prospects
    if (y > pageH - 25) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...REPORT_DARK);
    doc.text(`TOTAL : ${weeklyProspects.length} prospect${weeklyProspects.length > 1 ? 's' : ''} créé${weeklyProspects.length > 1 ? 's' : ''}`, margin, y);
    y += 10;
  }


  // Signature
  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }
  y = pageH - 32;
  doc.setDrawColor(170, 170, 170);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, y, margin + 60, y);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...REPORT_DARK);
  doc.text(`Signature de ${author?.name || 'Expéditeur'}`, margin, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...REPORT_MUTED);
  doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')} — ${settings.companyName || ''}`, margin, pageH - 8);

  return doc;
}

export function generateWeeklyReportPdf(
  report: WeeklyReport,
  dailyReports: ActivityReport[],
  kpis: Record<string, number>,
  author: User | null | undefined,
  settings: AppSettings,
  weeklyProspects: Prospect[] = [],
  services: Service[] = [],
  categories: Category[] = []
) {
  const doc = buildWeeklyReportPdf(report, dailyReports, kpis, author, settings, weeklyProspects, services, categories);
  const blob = doc.output('blob');
  downloadBlob(blob, `Rapport_Hebdomadaire_${report.weekStart}.pdf`);
}

export interface DailyReportInput {
  type: 'Activité' | 'Prospection';
  date: string;
  realisations: string;
  difficultes: string;
  remarques: string;
}

export function buildDailyReportPdf(
  report: DailyReportInput,
  author: User | null | undefined,
  settings: AppSettings
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  const start = new Date(report.date + 'T00:00:00');
  const dayLabel = `${start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;
  const weekLabel = `Rapport du ${dayLabel}`;

  let y = drawExpHeader(doc, author, weekLabel);

  const companyLine = settings.companyName ? (settings.companyAddress ? `${settings.companyName} - ${settings.companyAddress}` : settings.companyName) : '';
  if (companyLine) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...REPORT_MUTED);
    doc.text(companyLine, margin, y);
    y += 6;
  }

  // Type badge
  doc.setFillColor(...REPORT_COLOR);
  doc.roundedRect(margin, y, 40, 8, 1.5, 1.5, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`RAPPORT ${report.type.toUpperCase()}`, margin + 4, y + 5.5);
  y += 14;

  const sections: { label: string; value: string }[] = [
    { label: 'Réalisations du jour', value: report.realisations },
    { label: 'Difficultés rencontrées', value: report.difficultes },
    { label: 'Remarques / observations', value: report.remarques },
  ];

  for (const s of sections) {
    if (y > pageH - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(...REPORT_LIGHT);
    doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...REPORT_COLOR);
    doc.text(s.label, margin + 4, y + 6);
    y += 14;

    if (s.value) {
      if (y > pageH - 40) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...REPORT_DARK);
      const lines = doc.splitTextToSize(s.value, contentW) as string[];
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...REPORT_MUTED);
      doc.text('— Aucune information renseignée —', margin, y);
      y += 8;
    }
    y += 4;
  }

  // Signature
  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }
  y = Math.max(y + 12, pageH - 48);
  if (y > pageH - 40) y = pageH - 40;
  doc.setDrawColor(170, 170, 170);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, y, margin + 60, y);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...REPORT_DARK);
  doc.text(`Signature de ${author?.name || 'Expéditeur'}`, margin, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...REPORT_MUTED);
  doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')} — ${settings.companyName || ''}`, margin, pageH - 8);

  return doc;
}

export function generateDailyReportPdf(
  report: DailyReportInput,
  author: User | null | undefined,
  settings: AppSettings
) {
  const doc = buildDailyReportPdf(report, author, settings);
  const blob = doc.output('blob');
  downloadBlob(blob, `Rapport_Journalier_${report.date}.pdf`);
}

export function generateQuotePdf(quote: Quote, client: Client | undefined, settings: AppSettings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header
  y = drawHeader(doc, settings, margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(settings.companyAddress || '', margin, y);
  y += 5;
  doc.text(`RCCM: ${settings.companySiret || ''}`, margin, y);
  y += 10;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('DEVIS', margin, y);
  y += 8;

  // Quote number & date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${quote.quoteNumber}`, margin, y);
  doc.text(`Date: ${quote.date}`, pageW - margin, y, { align: 'right' });
  y += 10;

  // Client info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(pageW - margin - 70, y - 5, 70, 28, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Client:', pageW - margin - 65, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  const clientLines = [
    client?.name || 'Inconnu',
    client?.contact || '',
    client?.email || '',
    client?.company || '',
  ].filter(Boolean);
  clientLines.forEach((line, i) => {
    doc.text(line, pageW - margin - 65, y + 7 + i * 5);
  });
  y += 15;

  // Subject
  if (quote.subject) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`Objet: ${quote.subject}`, margin, y);
    y += 10;
  }

  // Table header
  const colWidths = [contentW * 0.40, contentW * 0.10, contentW * 0.18, contentW * 0.14, contentW * 0.18];
  const headers = ['Description', 'Qté', 'Prix Unitaire', 'Remise', 'Total'];
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 5.5);
    x += colWidths[i];
  });
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  quote.lines.forEach((line) => {
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 2;
    x = margin;
    const cells = [
      line.description,
      String(line.quantity),
      `${line.unitPrice.toLocaleString('fr-FR')} FCFA`,
      line.discountPercent && line.discountPercent > 0 ? `-${line.discountPercent}%` : '-',
      `${line.total.toLocaleString('fr-FR')} FCFA`,
    ];
    cells.forEach((cell, i) => {
      doc.text(cell, x + 2, y + 4);
      x += colWidths[i];
    });
    y += 8;
  });

  // Separator
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Totals
  const totalsX = pageW - margin - 60;
  doc.setFontSize(9);
  if (quote.discountPercent && quote.discountPercent > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Remise (${quote.discountPercent}%)`, totalsX, y);
    doc.text(`-${quote.discountAmount?.toLocaleString('fr-FR') || '0'} FCFA`, pageW - margin, y, { align: 'right' });
    y += 6;
    doc.text('Sous-total Net', totalsX, y);
    doc.text(`${quote.subtotal.toLocaleString('fr-FR')} FCFA`, pageW - margin, y, { align: 'right' });
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('Sous-total', totalsX, y);
    doc.text(`${quote.subtotal.toLocaleString('fr-FR')} FCFA`, pageW - margin, y, { align: 'right' });
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total', totalsX, y);
  doc.text(`${quote.total.toLocaleString('fr-FR')} FCFA`, pageW - margin, y, { align: 'right' });
  y += 12;

  // Conditions
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Conditions Générales:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const validity = `Ce devis est valable pour une durée de ${settings.defaultValidity || 30} jours.`;
  doc.text(validity, margin, y);
  y += 5;
  if (settings.defaultTerms) {
    const termLines = doc.splitTextToSize(settings.defaultTerms, contentW);
    doc.text(termLines, margin, y);
  }

  // Signatures
  y = Math.max(y + 20, 240);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Signature du prestataire', margin, y);
  doc.text('Signature du client', pageW - margin - 50, y);
  y += 3;
  doc.setDrawColor(180);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, y + 15, margin + 50, y + 15);
  doc.line(pageW - margin - 50, y + 15, pageW - margin, y + 15);
  doc.setLineDashPattern([], 0);

  const blob = doc.output('blob');
  downloadBlob(blob, `Devis_${quote.quoteNumber}.pdf`);
}

export function generateSalePdf(sale: Sale, client: Client | undefined, settings: AppSettings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header
  y = drawHeader(doc, settings, margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(settings.companyAddress || '', margin, y);
  y += 5;
  doc.text(`RCCM: ${settings.companySiret || ''}`, margin, y);
  y += 10;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('BON DE VENTE', margin, y);
  y += 8;

  // Sale number & dates
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${sale.saleNumber}`, margin, y);
  doc.text(`Date: ${sale.date}`, pageW - margin, y, { align: 'right' });
  y += 4;

  // Client info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(pageW - margin - 70, y - 5, 70, 28, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Client:', pageW - margin - 65, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);
  const clientLines = [
    client?.name || 'Inconnu',
    client?.contact || '',
    client?.email || '',
    client?.company || '',
  ].filter(Boolean);
  clientLines.forEach((line, i) => {
    doc.text(line, pageW - margin - 65, y + 7 + i * 5);
  });
  y += 15;

  // Table header
  const colWidths = [contentW * 0.50, contentW * 0.12, contentW * 0.19, contentW * 0.19];
  const headers = ['Description', 'Qté', 'Prix Unitaire', 'Total'];
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 5.5);
    x += colWidths[i];
  });
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  sale.lines.forEach((line) => {
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 2;
    x = margin;
    const cells = [
      line.description,
      String(line.quantity),
      `${line.unitPrice.toLocaleString('fr-FR')} FCFA`,
      `${line.total.toLocaleString('fr-FR')} FCFA`,
    ];
    cells.forEach((cell, i) => {
      doc.text(cell, x + 2, y + 4);
      x += colWidths[i];
    });
    y += 8;
  });

  // Separator
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Totals
  const totalsX = pageW - margin - 60;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total', totalsX, y);
  doc.text(`${sale.subtotal.toLocaleString('fr-FR')} FCFA`, pageW - margin, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total', totalsX, y);
  doc.text(`${sale.total.toLocaleString('fr-FR')} FCFA`, pageW - margin, y, { align: 'right' });

  const blob = doc.output('blob');
  downloadBlob(blob, `Vente_${sale.saleNumber}.pdf`);
}