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

function cleanPdfText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2022\u25E6\u2023]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '');
}

function drawAutoText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, baseSize: number, align: 'left' | 'right' = 'right') {
  let size = baseSize;
  doc.setFontSize(size);
  const clean = cleanPdfText(text);
  while (size > 5 && doc.getTextWidth(clean) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.text(clean, x, y, { align });
}

export function generateQuotePdf(quote: Quote, client: Client | undefined, settings: AppSettings): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2; // 178 mm
  const style = quote.style || 'Classique';
  const accent = parseHexColor(quote.accentColor || '#009688');
  const accentLight = mixWithWhite(accent, 0.92);
  const accentSoft = mixWithWhite(accent, 0.75);
  const dark: [number, number, number] = [30, 34, 42];
  const muted: [number, number, number] = [100, 112, 125];
  const neutralLight: [number, number, number] = [246, 248, 250];
  const neutralBorder: [number, number, number] = [222, 226, 230];
  const isModerne = style === 'Moderne';
  const isMinimaliste = style === 'Minimaliste';
  const companyName = settings.companyName || 'Entreprise';
  const validityText = quote.validUntil 
    ? `Valable jusqu'au ${formatDateFr(quote.validUntil)}`
    : `Valable ${settings.defaultValidity || 30} jours`;
  const dateFr = formatDateFr(quote.date);
  let y = 0;

  // ============================ 1. EN-TÊTE ============================
  if (settings.headerLogoBase64) {
    const bannerH = 36;
    try {
      doc.addImage(settings.headerLogoBase64, 'PNG', 0, 0, pageW, bannerH);
    } catch {
      try {
        doc.addImage(settings.headerLogoBase64, 'JPEG', 0, 0, pageW, bannerH);
      } catch {
        doc.setFillColor(...accent);
        doc.rect(0, 0, pageW, 36, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(companyName.toUpperCase(), margin, 18);
      }
    }

    // Bandeau d'informations sous le logo pour ne jamais perdre le numéro et la date
    y = bannerH + 4;
    doc.setFillColor(...neutralLight);
    doc.roundedRect(margin, y, contentW, 10, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...accent);
    doc.text(`DEVIS N° ${quote.quoteNumber}`, margin + 5, y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(`Émis le : ${dateFr}`, pageW - margin - 55, y + 6.5);
    doc.text(validityText, pageW - margin - 5, y + 6.5, { align: 'right' });
    y += 15;
  } else if (isModerne) {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setFillColor(...mixWithWhite(accent, 0.2));
    doc.rect(0, 40, pageW, 1.5, 'F');

    // Gauche : Société
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyName, margin, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(230, 242, 245);
    if (settings.companyAddress) doc.text(settings.companyAddress, margin, 21);
    const taxInfo = [
      settings.companySiret ? `RCCM : ${settings.companySiret}` : '',
      settings.companyTva ? `IFU/TVA : ${settings.companyTva}` : ''
    ].filter(Boolean).join(' • ');
    if (taxInfo) doc.text(taxInfo, margin, 26);

    // Droite : Devis
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('DEVIS', pageW - margin, 15, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`N° ${quote.quoteNumber}`, pageW - margin, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(230, 242, 245);
    doc.text(`Date : ${dateFr}`, pageW - margin, 27, { align: 'right' });
    doc.text(validityText, pageW - margin, 32, { align: 'right' });
    y = 48;
  } else if (isMinimaliste) {
    // Gauche : Société
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...dark);
    doc.text(companyName.toUpperCase(), margin, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    if (settings.companyAddress) doc.text(settings.companyAddress, margin, 22);
    const taxInfoMin = [
      settings.companySiret ? `RCCM : ${settings.companySiret}` : '',
      settings.companyTva ? `IFU/TVA : ${settings.companyTva}` : ''
    ].filter(Boolean).join(' • ');
    if (taxInfoMin) doc.text(taxInfoMin, margin, 27);

    // Droite : Devis
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...dark);
    doc.text('DEVIS', pageW - margin, 16, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`N° ${quote.quoteNumber}`, pageW - margin, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(`Date : ${dateFr}`, pageW - margin, 27, { align: 'right' });
    doc.text(validityText, pageW - margin, 32, { align: 'right' });

    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.4);
    doc.line(margin, 37, pageW - margin, 37);
    y = 44;
  } else {
    // Classique
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(...mixWithWhite(accent, 0.25));
    doc.rect(0, 38, pageW, 1.2, 'F');

    // Gauche
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyName.toUpperCase(), margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(230, 242, 245);
    if (settings.companyAddress) doc.text(settings.companyAddress, margin, 20);
    const taxInfoClass = [
      settings.companySiret ? `RCCM : ${settings.companySiret}` : '',
      settings.companyTva ? `IFU/TVA : ${settings.companyTva}` : ''
    ].filter(Boolean).join(' • ');
    if (taxInfoClass) doc.text(taxInfoClass, margin, 25);

    // Droite
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('DEVIS', pageW - margin, 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`N° ${quote.quoteNumber}`, pageW - margin, 21, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(230, 242, 245);
    doc.text(`Date : ${dateFr}`, pageW - margin, 26, { align: 'right' });
    doc.text(validityText, pageW - margin, 31, { align: 'right' });
    y = 46;
  }

  // ====================== 2. CARTOUCHES CLIENT & OBJET / RÉFÉRENCES ======================
  const cardGap = 8;
  const cardW = (contentW - cardGap) / 2; // 85 mm chacun
  const cardH = 28;
  const cardLeftX = margin;
  const cardRightX = margin + cardW + cardGap;
  const cardY = y;

  // --- Cartouche Gauche : CLIENT ---
  if (!isMinimaliste) {
    doc.setFillColor(...(isModerne ? accentLight : neutralLight));
    doc.roundedRect(cardLeftX, cardY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...(isModerne ? accentSoft : neutralBorder));
    doc.setLineWidth(0.3);
    doc.roundedRect(cardLeftX, cardY, cardW, cardH, 2, 2, 'S');
  } else {
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardLeftX, cardY, cardW, cardH, 1.5, 1.5, 'S');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...(isMinimaliste ? dark : accent));
  doc.text('DESTINATAIRE (CLIENT)', cardLeftX + 5, cardY + 5.5);

  const clientName = client?.company || client?.name || 'Client comptant';
  const clientLines = [
    client?.contact && client.contact !== client.name && client.contact !== client.company ? `Attn : ${client.contact}` : '',
    client?.phone ? `Tél : ${client.phone}` : '',
    client?.email ? `Email : ${client.email}` : '',
    client?.address || '',
  ].filter(Boolean);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...dark);
  const clientNameWrapped = doc.splitTextToSize(clientName, cardW - 10) as string[];
  doc.text(clientNameWrapped[0], cardLeftX + 5, cardY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  let cOffsetY = cardY + 16.5;
  clientLines.slice(0, 2).forEach((l) => {
    const wrapped = doc.splitTextToSize(l, cardW - 10) as string[];
    doc.text(wrapped[0], cardLeftX + 5, cOffsetY);
    cOffsetY += 4.5;
  });

  // --- Cartouche Droit : OBJET DU DEVIS ou DÉTAILS ---
  if (!isMinimaliste) {
    doc.setFillColor(...(isModerne ? accentLight : neutralLight));
    doc.roundedRect(cardRightX, cardY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...(isModerne ? accentSoft : neutralBorder));
    doc.setLineWidth(0.3);
    doc.roundedRect(cardRightX, cardY, cardW, cardH, 2, 2, 'S');
  } else {
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardRightX, cardY, cardW, cardH, 1.5, 1.5, 'S');
  }

  if (quote.subject) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...(isMinimaliste ? dark : accent));
    doc.text('OBJET DU DEVIS', cardRightX + 5, cardY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...dark);
    const subjectLines = doc.splitTextToSize(quote.subject, cardW - 10) as string[];
    subjectLines.slice(0, 4).forEach((line, i) => {
      doc.text(line, cardRightX + 5, cardY + 11.5 + i * 4.5);
    });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...(isMinimaliste ? dark : accent));
    doc.text('INFORMATIONS DEVIS', cardRightX + 5, cardY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text(`Réf. : ${quote.quoteNumber}`, cardRightX + 5, cardY + 11.5);
    doc.text(`Date d'émission : ${dateFr}`, cardRightX + 5, cardY + 16.5);
    doc.setTextColor(...muted);
    doc.text(`Validité : ${validityText}`, cardRightX + 5, cardY + 21.5);
  }

  y += cardH + 7;

  // ====================== 3. TABLEAU DES ARTICLES ======================
  // Largeurs strictes totalisant 178 mm : [82, 22, 28, 18, 28]
  const colW = {
    desc: 82,
    qty: 22,
    unitPrice: 28,
    discount: 18,
    total: 28
  };
  const tableX = margin;

  const drawTableHeader = () => {
    const thH = 8.5;
    if (isModerne) {
      doc.setFillColor(...accent);
      doc.rect(tableX, y, contentW, thH, 'F');
      doc.setTextColor(255, 255, 255);
    } else if (isMinimaliste) {
      doc.setFillColor(...dark);
      doc.rect(tableX, y, contentW, thH, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(...neutralLight);
      doc.rect(tableX, y, contentW, thH, 'F');
      doc.setTextColor(...accent);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    // Colonne 1 : Description (gauche + 3)
    doc.text('DÉSIGNATION', tableX + 3, y + 5.5);
    // Colonne 2 : Qté (centrée)
    doc.text('QTÉ', tableX + colW.desc + colW.qty / 2, y + 5.5, { align: 'center' });
    // Colonne 3 : Prix unitaire (droite - 3)
    doc.text('P.U. (FCFA)', tableX + colW.desc + colW.qty + colW.unitPrice - 3, y + 5.5, { align: 'right' });
    // Colonne 4 : Remise (centrée)
    doc.text('REMISE', tableX + colW.desc + colW.qty + colW.unitPrice + colW.discount / 2, y + 5.5, { align: 'center' });
    // Colonne 5 : Total (droite - 3)
    doc.text('TOTAL (FCFA)', tableX + contentW - 3, y + 5.5, { align: 'right' });

    y += thH;
  };

  drawTableHeader();

  // Extraire et normaliser les lignes du devis avec support de tous les alias possibles
  const rawLines: any[] = Array.isArray(quote.lines)
    ? quote.lines
    : Array.isArray((quote as any).quote_lines)
      ? (quote as any).quote_lines
      : Array.isArray((quote as any).items)
        ? (quote as any).items
        : [];

  if (rawLines.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Aucun article ou prestation spécifié dans ce devis.', tableX + 3, y + 6);
    y += 10;
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.2);
    doc.line(tableX, y, tableX + contentW, y);
  } else {
    rawLines.forEach((line: any, idx: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const descRaw = line.description || line.designation || line.name || line.prestation_name || line.label || 'Article sans désignation';
      const descClean = cleanPdfText(descRaw) || 'Article sans désignation';
      const qty = Number(line.quantity ?? line.qte ?? line.qty ?? 1);
      const unit = cleanPdfText(line.unit || line.unite || '');
      const unitPrice = Number(line.unitPrice ?? line.unit_price ?? line.price ?? line.pu ?? 0);
      const discountPercent = Number(line.discountPercent ?? line.discount_percent ?? line.remise ?? 0);

      let totalVal = line.total !== undefined && line.total !== null ? Number(line.total) : undefined;
      if (totalVal === undefined || isNaN(totalVal)) {
        if (line.total_price !== undefined) totalVal = Number(line.total_price);
        else if (line.totalPrice !== undefined) totalVal = Number(line.totalPrice);
        else {
          const rawTotal = qty * unitPrice;
          const lineDiscount = Math.round((rawTotal * discountPercent) / 100);
          totalVal = Math.max(0, rawTotal - lineDiscount);
        }
      }

      // Découpage automatique de la description sans jamais perdre de texte
      const descLines = doc.splitTextToSize(descClean, colW.desc - 6) as string[];
      const rowH = Math.max(7.5, descLines.length * 4.2 + 3.5);

      // Vérification de saut de page
      if (y + rowH > pageH - 45) {
        doc.addPage();
        y = margin + 4;
        drawTableHeader();
      }

      // Fond alterné pour style Moderne
      if (isModerne && idx % 2 === 1) {
        doc.setFillColor(...accentLight);
        doc.rect(tableX, y, contentW, rowH, 'F');
      }

      // 1. Description (toutes les lignes affichées)
      doc.setTextColor(...dark);
      descLines.forEach((dLine, dIdx) => {
        doc.text(dLine, tableX + 3, y + 4.8 + dIdx * 4.2);
      });

      // 2. Quantité (centrée)
      const qtyDisplay = unit ? `${qty} ${unit}` : String(qty);
      doc.text(qtyDisplay, tableX + colW.desc + colW.qty / 2, y + 4.8, { align: 'center' });

      // 3. Prix unitaire (aligné à droite)
      doc.text(formatAmount(unitPrice), tableX + colW.desc + colW.qty + colW.unitPrice - 3, y + 4.8, { align: 'right' });

      // 4. Remise (centrée)
      const discountText = discountPercent > 0 ? `-${discountPercent}%` : '-';
      doc.setTextColor(...(discountPercent > 0 ? accent : muted));
      doc.text(discountText, tableX + colW.desc + colW.qty + colW.unitPrice + colW.discount / 2, y + 4.8, { align: 'center' });

      // 5. Total (aligné à droite, gras)
      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text(formatAmount(totalVal), tableX + contentW - 3, y + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += rowH;

      // Bordure de séparation horizontale
      doc.setDrawColor(...neutralBorder);
      doc.setLineWidth(0.2);
      doc.line(tableX, y, tableX + contentW, y);
    });
  }

  y += 5;

  // ====================== 4. TOTAUX & RÉSUMÉ ======================
  if (y > pageH - 65) {
    doc.addPage();
    y = margin + 4;
  }

  const totalsW = 74;
  const totalsX = pageW - margin - totalsW;
  const notesW = contentW - totalsW - 8;
  const notesX = margin;

  const grossSubtotal = (quote.subtotal || 0) + (quote.discountAmount || 0);
  const hasDiscount = Boolean(quote.discountPercent && quote.discountPercent > 0);

  // Bloc gauche : Notes ou Arrêté de devis
  if (quote.notes || quote.paymentTerms) {
    doc.setFillColor(...neutralLight);
    doc.roundedRect(notesX, y, notesW, 28, 1.5, 1.5, 'F');
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(notesX, y, notesW, 28, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...accent);
    doc.text('NOTES & RÈGLEMENT', notesX + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...dark);
    let noteOffsetY = y + 10;
    if (quote.paymentTerms) {
      doc.text(`Modalités : ${cleanPdfText(quote.paymentTerms)}`, notesX + 4, noteOffsetY);
      noteOffsetY += 4.5;
    }
    if (quote.notes) {
      const noteLines = doc.splitTextToSize(cleanPdfText(quote.notes), notesW - 8) as string[];
      noteLines.slice(0, 3).forEach(nl => {
        doc.text(nl, notesX + 4, noteOffsetY);
        noteOffsetY += 4;
      });
    }
  }

  // Bloc droit : Totaux
  const totBoxH = hasDiscount ? 30 : 22;
  if (!isMinimaliste) {
    doc.setFillColor(...(isModerne ? accentLight : neutralLight));
    doc.roundedRect(totalsX, y, totalsW, totBoxH, 2, 2, 'F');
    doc.setDrawColor(...(isModerne ? accentSoft : neutralBorder));
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsX, y, totalsW, totBoxH, 2, 2, 'S');
  } else {
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsX, y, totalsW, totBoxH, 1.5, 1.5, 'S');
  }

  let totY = y + 5.5;
  if (hasDiscount) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text('Total brut :', totalsX + 4, totY);
    doc.setTextColor(...dark);
    doc.text(formatAmount(grossSubtotal), pageW - margin - 4, totY, { align: 'right' });
    totY += 5.5;

    doc.setTextColor(...muted);
    doc.text(`Remise (${quote.discountPercent}%) :`, totalsX + 4, totY);
    doc.setTextColor(...accent);
    doc.text(`-${formatAmount(quote.discountAmount || 0)}`, pageW - margin - 4, totY, { align: 'right' });
    totY += 5.5;

    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.2);
    doc.line(totalsX + 4, totY - 1, pageW - margin - 4, totY - 1);
    totY += 2;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text('Sous-total HT :', totalsX + 4, totY);
    doc.setTextColor(...dark);
    doc.text(formatAmount(quote.subtotal || 0), pageW - margin - 4, totY, { align: 'right' });
    totY += 6;
  }

  // Ligne TOTAL NET mise en valeur
  const totalBannerH = 8.5;
  if (isModerne) {
    doc.setFillColor(...accent);
    doc.roundedRect(totalsX, y + totBoxH - totalBannerH, totalsW, totalBannerH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('NET À PAYER', totalsX + 4, y + totBoxH - 2.8);
    doc.text(formatAmount(quote.total || 0), pageW - margin - 4, y + totBoxH - 2.8, { align: 'right' });
  } else {
    doc.setFillColor(...accent);
    doc.roundedRect(totalsX, y + totBoxH - totalBannerH, totalsW, totalBannerH, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('TOTAL NET', totalsX + 4, y + totBoxH - 2.8);
    doc.text(formatAmount(quote.total || 0), pageW - margin - 4, y + totBoxH - 2.8, { align: 'right' });
  }

  y += totBoxH + 6;

  // ====================== 5. CONDITIONS & MODALITÉS ======================
  if (y > pageH - 52) {
    doc.addPage();
    y = margin + 4;
  }

  const condH = 6;
  doc.setFillColor(...neutralLight);
  doc.rect(margin, y, contentW, condH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text('CONDITIONS & MODALITÉS DE RÈGLEMENT', margin + 4, y + 4.2);
  y += condH + 3.5;

  const conditionsList: string[] = [
    `- Validité de l'offre : ${cleanPdfText(validityText)}.`,
    quote.paymentTerms ? `- Modalités de paiement : ${cleanPdfText(quote.paymentTerms)}.` : '',
    quote.notes ? `- Remarques : ${cleanPdfText(quote.notes)}.` : '',
    settings.defaultTerms ? `- Conditions générales : ${cleanPdfText(settings.defaultTerms)}.` : "- Les marchandises demeurent la propriété de l'entreprise jusqu'au paiement intégral du montant facturé."
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...dark);
  conditionsList.forEach(cond => {
    const wrapped = doc.splitTextToSize(cond, contentW - 8) as string[];
    wrapped.forEach(wl => {
      doc.text(wl, margin + 4, y);
      y += 3.8;
    });
  });

  y += 4;

  // ====================== 6. SIGNATURES ======================
  if (y > pageH - 36) {
    doc.addPage();
    y = margin + 4;
  }

  const sigW = (contentW - cardGap) / 2; // 85 mm chacun
  const sigH = 24;
  const sigLeftX = margin;
  const sigRightX = margin + sigW + cardGap;

  // Cadre Signature Entreprise
  doc.setDrawColor(...neutralBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(sigLeftX, y, sigW, sigH, 1.5, 1.5, 'S');

  const signatoryTitle = quote.signatoryRole || 'Pour l\'entreprise';
  const signatoryName = quote.signatoryName ? `${signatoryTitle} : ${quote.signatoryName}` : signatoryTitle;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...(isMinimaliste ? dark : accent));
  doc.text(cleanPdfText(signatoryName), sigLeftX + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Signature autorisée & Cachet', sigLeftX + 4, y + 9);

  // Cadre Signature Client
  doc.roundedRect(sigRightX, y, sigW, sigH, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...(isMinimaliste ? dark : accent));
  doc.text('BON POUR ACCORD (CLIENT)', sigRightX + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text('Date, cachet & signature précédés de "Bon pour accord"', sigRightX + 4, y + 9);

  // ====================== 7. PIED DE PAGE ======================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    const siretInfo = settings.companySiret ? ` - RCCM : ${cleanPdfText(settings.companySiret)}` : '';
    doc.text(
      `Document généré le ${new Date().toLocaleDateString('fr-FR')} - ${cleanPdfText(companyName)}${siretInfo} - Page ${p}/${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' }
    );
  }

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