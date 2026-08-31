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

function parseHexColor(hex: string): [number, number, number] {
  const clean = (hex || '#009688').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return [0, 150, 136];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixWithWhite(rgb: [number, number, number], ratio: number): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * ratio)) as [number, number, number];
}

function formatAmount(n: number): string {
  return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

function formatDateFr(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function drawAutoText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, baseSize: number, align: 'left' | 'right' = 'right') {
  let size = baseSize;
  doc.setFontSize(size);
  while (size > 5 && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.text(text, x, y, { align });
}

export function generateQuotePdf(quote: Quote, client: Client | undefined, settings: AppSettings): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const style = quote.style || 'Classique';
  const accent = parseHexColor(quote.accentColor || '#009688');
  const accentLight = mixWithWhite(accent, 0.9);
  const accentSoft = mixWithWhite(accent, 0.7);
  const dark: [number, number, number] = [30, 34, 42];
  const muted: [number, number, number] = [110, 120, 130];
  const neutralLight: [number, number, number] = [245, 247, 249];
  const neutralBorder: [number, number, number] = [220, 224, 228];
  const isModerne = style === 'Moderne';
  const isMinimaliste = style === 'Minimaliste';
  const companyName = settings.companyName || 'Entreprise';
  const validity = quote.validUntil 
    ? `Ce devis est valable jusqu'au ${formatDateFr(quote.validUntil)}.`
    : `Ce devis est valable pour une durée de ${settings.defaultValidity || 30} jours.`;
  const dateFr = formatDateFr(quote.date);
  let y = 0;

  // ============================ HEADER ============================
  if (isModerne) {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 44, 'F');
    doc.setFillColor(...mixWithWhite(accent, 0.15));
    doc.rect(0, 44, pageW, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    if (settings.headerLogoBase64) {
      try { doc.addImage(settings.headerLogoBase64, 'PNG', margin, 8, 36, 14); } catch { /* logo invalide */ }
    }
    const logoOffset = settings.headerLogoBase64 ? margin + 40 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(companyName, logoOffset, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 240, 245);
    doc.text(settings.companyAddress || '', logoOffset, 25);
    if (settings.companySiret) doc.text(`RCCM : ${settings.companySiret}`, logoOffset, 30);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('DEVIS', pageW - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`N° ${quote.quoteNumber}`, pageW - margin, 26, { align: 'right' });
    doc.text(`Date : ${dateFr}`, pageW - margin, 31, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(226, 240, 245);
    doc.text(validity, pageW - margin, 38, { align: 'right' });
    y = 56;
  } else {
    // En-tête pleine largeur avec bandeau coloré
    if (!isMinimaliste) {
      doc.setFillColor(...accent);
      doc.rect(0, 0, pageW, 38, 'F');
      doc.setFillColor(...mixWithWhite(accent, 0.3));
      doc.rect(0, 38, pageW, 1, 'F');
    }
    y = isMinimaliste ? margin : 8;
    if (settings.headerLogoBase64) {
      try { doc.addImage(settings.headerLogoBase64, 'PNG', margin, y, 36, 14); } catch { /* logo invalide */ }
      const logoOffset = margin + 40;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(isMinimaliste ? dark[0] : 255, isMinimaliste ? dark[1] : 255, isMinimaliste ? dark[2] : 255);
      doc.text(companyName, logoOffset, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(isMinimaliste ? muted[0] : 226, isMinimaliste ? muted[1] : 240, isMinimaliste ? muted[2] : 245);
      doc.text(settings.companyAddress || '', logoOffset, y + 13);
      if (settings.companySiret) doc.text(`RCCM : ${settings.companySiret}`, logoOffset, y + 18);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(isMinimaliste ? dark[0] : 255, isMinimaliste ? dark[1] : 255, isMinimaliste ? dark[2] : 255);
      doc.text(companyName.toUpperCase(), margin, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(isMinimaliste ? muted[0] : 226, isMinimaliste ? muted[1] : 240, isMinimaliste ? muted[2] : 245);
      doc.text(settings.companyAddress || '', margin, y + 13);
      if (settings.companySiret) doc.text(`RCCM : ${settings.companySiret}`, margin, y + 18);
    }

    // Titre DEVIS à droite
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(isMinimaliste ? dark[0] : 255, isMinimaliste ? dark[1] : 255, isMinimaliste ? dark[2] : 255);
    doc.text('DEVIS', pageW - margin, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(isMinimaliste ? muted[0] : 226, isMinimaliste ? muted[1] : 240, isMinimaliste ? muted[2] : 245);
    doc.text(`N° ${quote.quoteNumber}`, pageW - margin, y + 15, { align: 'right' });
    doc.text(`Date : ${dateFr}`, pageW - margin, y + 20, { align: 'right' });
    doc.setFontSize(8);
    doc.text(validity, pageW - margin, y + 25, { align: 'right' });
    y = isMinimaliste ? y + 30 : 48;
  }

  // ====================== CLIENT + OBJET ======================
  const cardW = 78;
  const cardH = 26;
  const cardX = margin;
  const cardY = y;
  if (!isMinimaliste) {
    doc.setFillColor(...(isModerne ? accentLight : neutralLight));
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...(isModerne ? accentSoft : neutralBorder));
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'S');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...(isMinimaliste ? dark : accent));
  doc.text('CLIENT', cardX + 5, cardY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...dark);
  const clientLines = [
    client?.company || client?.name || 'Inconnu',
    // Only show contact if it differs from name/company
    client?.contact && client.contact !== client.name && client.contact !== client.company ? `Contact : ${client.contact}` : '',
    client?.phone || '',
    client?.email || '',
  ].filter(Boolean);
  clientLines.slice(0, 3).forEach((line, i) => {
    doc.text(line, cardX + 5, cardY + 12 + i * 4.5);
  });

  const objX = cardX + cardW + 10;
  const objW = pageW - margin - objX;
  if (quote.subject) {
    if (!isMinimaliste) {
      doc.setFillColor(...(isModerne ? accentLight : neutralLight));
      doc.roundedRect(objX, cardY, objW, cardH, 2, 2, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...(isMinimaliste ? dark : accent));
    doc.text('OBJET', objX + 5, cardY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    const subjectLines = doc.splitTextToSize(quote.subject, objW - 10) as string[];
    subjectLines.slice(0, 3).forEach((line, i) => {
      doc.text(line, objX + 5, cardY + 12 + i * 4.5);
    });
  }
  y += cardH + 10;

  // ====================== TABLEAU ======================
  const colWidths = [contentW * 0.40, contentW * 0.13, contentW * 0.16, contentW * 0.10, contentW * 0.21];
  const headers = ['DESCRIPTION', 'QTÉ / UNITÉ', 'PRIX UNITAIRE', 'REMISE', 'TOTAL'];
  const tableX = margin;

  const drawTableHeader = () => {
    if (isModerne) {
      doc.setFillColor(...accent);
      doc.rect(tableX, y, contentW, 9, 'F');
      doc.setTextColor(255, 255, 255);
    } else if (isMinimaliste) {
      doc.setFillColor(...dark);
      doc.rect(tableX, y, contentW, 9, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(...neutralLight);
      doc.rect(tableX, y, contentW, 9, 'F');
      doc.setTextColor(...accent);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let hx = tableX;
    headers.forEach((h, i) => {
      if (i === 0) {
        doc.text(h, hx + 2, y + 6);
      } else {
        doc.text(h, hx + colWidths[i] - 2, y + 6, { align: 'right' });
      }
      hx += colWidths[i];
    });
    y += 9;
  };

  drawTableHeader();

  quote.lines.forEach((line, idx) => {
    if (y > pageH - 36) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }
    const rowH = 8;
    if (isModerne && idx % 2 === 1) {
      doc.setFillColor(...accentLight);
      doc.rect(tableX, y, contentW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    const descLines = doc.splitTextToSize(line.description || '-', colWidths[0] - 4) as string[];
    let cx = tableX;
    doc.text(descLines[0], cx + 2, y + 5.5);
    cx += colWidths[0];
    
    const qtyDisplay = line.unit ? `${line.quantity || 0} ${line.unit}` : String(line.quantity || 0);
    const cells = [
      qtyDisplay,
      formatAmount(line.unitPrice || 0),
      line.discountPercent && line.discountPercent > 0 ? `-${line.discountPercent}%` : '—',
      formatAmount(line.total || 0),
    ];
    cells.forEach((cell, i) => {
      const colIdx = i + 1;
      cx += colWidths[colIdx];
      drawAutoText(doc, cell, cx - 2, y + 5.5, colWidths[colIdx] - 4, 8);
    });
    y += rowH;
    if (!isModerne) {
      doc.setDrawColor(isMinimaliste ? 230 : 235);
      doc.setLineWidth(0.2);
      doc.line(tableX, y, pageW - margin, y);
    }
  });

  y += 4;

  // ====================== TOTAUX ======================
  const grossSubtotal = (quote.subtotal || 0) + (quote.discountAmount || 0);
  const totalsW = 62;
  const totalsX = pageW - margin - totalsW;
  const totalRows = [
    { label: 'Montant brut', value: formatAmount(grossSubtotal) },
    ...(quote.discountPercent && quote.discountPercent > 0
      ? [{ label: `Remise (${quote.discountPercent}%)`, value: `-${formatAmount(quote.discountAmount || 0)}` }]
      : []),
  ];

  if (!isMinimaliste) {
    doc.setFillColor(...(isModerne ? accentLight : neutralLight));
    const boxH = totalRows.length * 7 + 13;
    doc.roundedRect(totalsX, y - 3, totalsW, boxH, 2, 2, 'F');
  }

  totalRows.forEach((r) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(r.label, totalsX + 5, y + 2);
    doc.setTextColor(...dark);
    doc.text(r.value, pageW - margin - 5, y + 2, { align: 'right' });
    y += 6;
  });
  y += 1;

  if (isModerne) {
    doc.setFillColor(...accent);
    doc.roundedRect(totalsX, y - 3, totalsW, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', totalsX + 5, y + 3);
    doc.text(formatAmount(quote.total || 0), pageW - margin - 5, y + 3, { align: 'right' });
    y += 10;
  } else {
    doc.setDrawColor(isMinimaliste ? 0 : accent[0], isMinimaliste ? 0 : accent[1], isMinimaliste ? 0 : accent[2]);
    doc.setLineWidth(0.6);
    doc.line(totalsX, y, pageW - margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text('TOTAL', totalsX + 5, y);
    doc.text(formatAmount(quote.total || 0), pageW - margin - 5, y, { align: 'right' });
    y += 8;
  }

  // ====================== CONDITIONS & MODALITÉS ======================
  y += 6;
  if (y > pageH - 55) {
    doc.addPage();
    y = margin + 6;
  }
  if (!isMinimaliste) {
    doc.setFillColor(...neutralLight);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...accent);
    doc.text('CONDITIONS & MODALITÉS DE RÈGLEMENT', margin + 5, y + 5);
    y += 7 + 4;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text('CONDITIONS & MODALITÉS DE RÈGLEMENT', margin, y);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    y += 7;
  }

  // Lignes de conditions
  const conditionsList: string[] = [];
  conditionsList.push(`• Validité de l'offre : ${validity}`);
  if (quote.paymentTerms) {
    conditionsList.push(`• Modalités de paiement : ${quote.paymentTerms}`);
  }
  if (quote.notes) {
    conditionsList.push(`• Remarques : ${quote.notes}`);
  }
  if (settings.defaultTerms) {
    conditionsList.push(`• Conditions générales : ${settings.defaultTerms}`);
  }

  const termsText = conditionsList.join('\n');
  const termLines = doc.splitTextToSize(termsText, contentW) as string[];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(termLines, margin, y);
  y += termLines.length * 4 + 4;

  // ====================== SIGNATURES ======================
  y += 4;
  if (y > pageH - 35) {
    doc.addPage();
    y = margin + 10;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...dark);
  
  const signatoryTitle = quote.signatoryRole || 'Pour l\'entreprise';
  const signatoryName = quote.signatoryName ? `${signatoryTitle} : ${quote.signatoryName}` : signatoryTitle;
  doc.text(signatoryName, margin, y);
  doc.text('Bon pour accord (Client) :', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text('Date, signature & cachet', pageW - margin, y + 4, { align: 'right' });

  doc.setDrawColor(...muted);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(margin, y + 12, margin + 55, y + 12);
  doc.line(pageW - margin - 55, y + 12, pageW - margin, y + 12);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${companyName}${settings.companySiret ? ` — RCCM : ${settings.companySiret}` : ''}`,
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  );

  const blob = doc.output('blob');
  return blob;
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