import { jsPDF } from 'jspdf';
import type { Quote, Sale, Client, AppSettings, ActivityReport, WeeklyReport, User, Prospect, Service, Category, Invoice, InvoicePayment } from '../context/AppContext';

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
      const isPng = settings.headerLogoBase64.includes('image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      doc.addImage(settings.headerLogoBase64, format, x, y, 60, 20);
      return y + 26;
    } catch {
      try {
        doc.addImage(settings.headerLogoBase64, 'JPEG', x, y, 60, 20);
        return y + 26;
      } catch {
        try {
          doc.addImage(settings.headerLogoBase64, 'PNG', x, y, 60, 20);
          return y + 26;
        } catch {
          // fallback to text
        }
      }
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

// ====================== DEVIS PDF — modèle officiel HINOV (devi.pdf) ======================
// Reproduction fidèle du modèle : bannière, titre + client, bandeau
// Date/Client/Devis, tableau 6 colonnes à filets noirs, totaux HT / TVA 18% / TTC,
// montant en toutes lettres, cadre signature + cachet, mini-tableau Échéance /
// Montant, CGV + IBAN, pied de page bleu. Style unique pour tous les devis
// (remplace Classique / Moderne / Minimaliste).
import devisBannerUrl from '../assets/devis_banner.jpg';
import devisCachetUrl from '../assets/devis_cachet.jpg';

const devisPdfAssets: { banner?: string; cachet?: string } = {};
let devisPdfAssetsPromise: Promise<void> | null = null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(new Error('read'));
      fr.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

/** Précharge (une fois) bannière + cachet de secours. À appeler avant generateQuotePdf. */
export function ensureDevisPdfAssets(): Promise<void> {
  if (!devisPdfAssetsPromise) {
    devisPdfAssetsPromise = (async () => {
      try {
        const res = await fetch(devisBannerUrl);
        if (res.ok) devisPdfAssets.banner = await blobToDataUrl(await res.blob());
      } catch { /* bannière ignorée si inaccessible */ }
      try {
        const res = await fetch(devisCachetUrl);
        if (res.ok) devisPdfAssets.cachet = await blobToDataUrl(await res.blob());
      } catch { /* cachet ignoré si inaccessible */ }
    })();
  }
  return devisPdfAssetsPromise;
}

/** 123456 -> "123 456" (sans devise, comme le modèle). */
function formatMontant(n: number): string {
  return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 260000 -> "DEUX CENT SOIXANTE MILLE" (majuscules, sans devise). */
function nombreEnLettres(n: number): string {
  const N = Math.round(Math.abs(n || 0));
  if (N === 0) return 'ZÉRO';
  const U = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF', 'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
  const T = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT'];
  const under100 = (x: number): string => {
    if (x < 20) return U[x];
    const t = Math.floor(x / 10);
    const r = x % 10;
    if (t === 7 || t === 9) {
      const rest = x - (t === 7 ? 60 : 80);
      if (t === 7 && rest === 11) return 'SOIXANTE ET ONZE';
      return T[t] + '-' + U[rest];
    }
    if (r === 0) return t === 8 ? 'QUATRE-VINGTS' : T[t];
    if (r === 1 && t !== 8) return T[t] + ' ET UN';
    return T[t] + '-' + U[r];
  };
  const under1000 = (x: number): string => {
    const c = Math.floor(x / 100);
    const r = x % 100;
    if (c === 0) return under100(r);
    let s = c > 1 ? U[c] + ' CENT' : 'CENT';
    if (r === 0) {
      if (c > 1) s += 'S';
      return s;
    }
    return s + ' ' + under100(r);
  };
  const parts: string[] = [];
  const M = Math.floor(N / 1000000);
  const restM = N % 1000000;
  const K = Math.floor(restM / 1000);
  const rest = restM % 1000;
  if (M > 0) parts.push(M === 1 ? 'UN MILLION' : under1000(M) + ' MILLIONS');
  if (K > 0) parts.push(K === 1 ? 'MILLE' : under1000(K) + ' MILLE');
  if (rest > 0) parts.push(under1000(rest));
  return parts.join(' ');
}

export function generateQuotePdf(
  quote: Quote,
  client: Client | undefined,
  settings: AppSettings,
  prestations?: Array<{ id: string; code?: string }>
): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const black: [number, number, number] = [0, 0, 0];
  const hinovBlue: [number, number, number] = [0, 112, 191];
  const companyName = (settings.companyName || 'HINOV GROUP').toUpperCase();
  const clientName = client?.company || client?.name || 'Client comptant';
  const dateFr = formatDateFr(quote.date);
  const validUntilFr = quote.validUntil ? formatDateFr(quote.validUntil) : '';
  const validityText = quote.validUntil
    ? `Valable jusqu'au ${validUntilFr}`
    : `Valable ${settings.defaultValidity || 30} jours`;

  // ---- Montants : Total H.T. (net remisé), TVA 18%, Total TTC ----
  const netHt = Math.round(quote.total || 0);
  const discountAmount = Math.round(quote.discountAmount || 0);
  const discountPercent = quote.discountPercent || 0;
  const tva = Math.round(netHt * 0.18);
  const ttc = netHt + tva;
  const hasDiscount = discountPercent > 0 && discountAmount > 0;

  // ---- Lignes normalisées (mêmes alias que l'ancien générateur) ----
  const rawLines: any[] = Array.isArray(quote.lines)
    ? quote.lines
    : Array.isArray((quote as any).quote_lines)
      ? (quote as any).quote_lines
      : Array.isArray((quote as any).items)
        ? (quote as any).items
        : [];
  const lines = rawLines.map((line: any, idx: number) => {
    const descRaw = line.description || line.designation || line.name || line.prestation_name || line.label || 'Article sans désignation';
    const qty = Number(line.quantity ?? line.qte ?? line.qty ?? 1);
    const unitPrice = Number(line.unitPrice ?? line.unit_price ?? line.price ?? line.pu ?? 0);
    const disc = Number(line.discountPercent ?? line.discount_percent ?? line.remise ?? 0);
    let totalVal = line.total !== undefined && line.total !== null ? Number(line.total) : undefined;
    if (totalVal === undefined || isNaN(totalVal)) {
      if (line.total_price !== undefined) totalVal = Number(line.total_price);
      else if (line.totalPrice !== undefined) totalVal = Number(line.totalPrice);
      else {
        const rawTotal = qty * unitPrice;
        totalVal = Math.max(0, rawTotal - Math.round((rawTotal * disc) / 100));
      }
    }
    const prestaId = line.prestationId ?? line.prestation_id;
    const ref = (prestations || []).find(p => p.id === prestaId)?.code || '';
    return { ref, desc: cleanPdfText(descRaw) || 'Article sans désignation', qty, unitPrice, disc, total: totalVal || 0, key: idx };
  });

  // ---- Coordonnées entreprise (paramètres, sinon valeurs du modèle) ----
  const capital = settings.companyCapital || '2.000.000';
  const address = settings.companyAddress || "Yopougon Cite CIE, Rue S259 - ABIDJAN - COTE D'IVOIRE";
  const phone = settings.companyPhone || '(225) 27 23 22 79 92';
  const email = settings.companyEmail || 'hinovgroup@hinovgroup.com';
  const rccm = settings.companySiret || 'CI-ABJ-03-2024-B13-02088';
  const ibanFull = (settings.bankIban || 'CI93 CI16 6010 0701 1527 1241 0180').replace(/\s+/g, ' ').trim();
  const iban1 = ibanFull.slice(0, 27).trim();
  const iban2 = ibanFull.slice(27).trim();

  const setBlack = () => doc.setTextColor(...black);
  const rule = (x1: number, y1: number, x2: number, y2: number, w = 0.25) => {
    doc.setDrawColor(...black);
    doc.setLineWidth(w);
    doc.line(x1, y1, x2, y2);
  };

  // ---- Cadre page + pied de page (chaque page) ----
  const drawFrame = () => {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.3);
    doc.rect(3.4, 3, 203.2, 289, 'S');
  };
  const drawFooter = (pageNum: number, totalPages: number) => {
    rule(9.8, 248.8, 200.4, 248.8, 0.3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...hinovBlue);
    doc.text(cleanPdfText(` ${companyName} au capital de ${capital} FCFA`), 105, 250.9, { align: 'center' });
    doc.text(cleanPdfText(`Siège social: ${address} - ${phone}`), 105, 254, { align: 'center' });
    doc.text(cleanPdfText(`${email} ; N° RCCM : ${rccm}`), 105, 257.2, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    setBlack();
    doc.text(`Page ${pageNum} de ${totalPages}`, 192.7, 290.9, { align: 'right' });
  };

  // ---- Colonnes du tableau (mm, relevé du modèle) ----
  const CX = [9.57, 48.5, 135.5, 147.4, 166.4, 177.8, 200.4];
  const drawTableHead = (top: number): number => {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.4);
    doc.rect(CX[0], top, CX[6] - CX[0], 9, 'S');
    for (let i = 1; i < 6; i++) doc.line(CX[i], top, CX[i], top + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    setBlack();
    const ty = top + 6;
    doc.text('Référence', (CX[0] + CX[1]) / 2, ty, { align: 'center' });
    doc.text('Désignation', (CX[1] + CX[2]) / 2, ty, { align: 'center' });
    doc.text('Qté', (CX[2] + CX[3]) / 2, ty, { align: 'center' });
    doc.text('P. Unitaire', CX[4] - 1.5, ty, { align: 'right' });
    doc.text('Remise', (CX[4] + CX[5]) / 2, ty, { align: 'center' });
    doc.text('Montant H.T.', CX[6] - 1.5, ty, { align: 'right' });
    return top + 9;
  };

  const drawRow = (ln: { ref: string; desc: string; qty: number; unitPrice: number; disc: number; total: number }, top: number, h: number, singleDesignation: boolean) => {
    doc.setDrawColor(...black);
    doc.setLineWidth(0.25);
    for (let i = 0; i < 7; i++) doc.line(CX[i], top, CX[i], top + h);
    doc.line(CX[0], top + h, CX[6], top + h);
    const baseY = top + 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setBlack();
    if (ln.ref) doc.text(cleanPdfText(ln.ref), (CX[0] + CX[1]) / 2, baseY, { align: 'center' });
    if (singleDesignation) {
      doc.setFont('times', 'bold');
      doc.setFontSize(12.5);
      setBlack();
      doc.text(ln.desc, (CX[1] + CX[2]) / 2, baseY + 2, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    } else {
      const wrapped = doc.splitTextToSize(ln.desc, CX[2] - CX[1] - 3) as string[];
      wrapped.slice(0, 3).forEach((wl, i) => doc.text(wl, CX[1] + 1.5, baseY + i * 4.2));
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    setBlack();
    doc.text(String(ln.qty), (CX[2] + CX[3]) / 2, baseY, { align: 'center' });
    doc.text(formatMontant(ln.unitPrice), CX[4] - 1.5, baseY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    setBlack();
    doc.text(String(ln.disc || 0), (CX[4] + CX[5]) / 2, baseY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    setBlack();
    doc.text(formatMontant(ln.total), CX[6] - 1.5, baseY, { align: 'right' });
  };

  // ============================ PAGE 1 : fixe ============================
  drawFrame();
  // Bannière pleine largeur (asset extrait du modèle)
  if (devisPdfAssets.banner) {
    try {
      doc.addImage(devisPdfAssets.banner, 'JPEG', -7, 3, 223.7, 55.5);
    } catch { /* sans bannière si illisible */ }
  }
  // Titre à gauche, client à droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setBlack();
  doc.text(cleanPdfText(`DEVIS ${quote.subject || ''}`.trim()), 32.4, 73);
  drawAutoText(doc, clientName.toUpperCase(), 200.2, 76, 52, 22, 'right');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setBlack();

  // Bandeau Date / Client / Devis + valeurs
  doc.setDrawColor(...black);
  doc.setLineWidth(0.4);
  doc.rect(4.7, 75.8, 200.9, 5.6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setBlack();
  doc.text('Date', 55.2, 79.6);
  doc.text('Client', 74.1, 79.6);
  doc.text('Devis', 95.5, 79.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setBlack();
  doc.text(cleanPdfText(dateFr), 51.3, 85.4);
  doc.text(cleanPdfText(clientName), 73.8, 85.4);
  doc.text(cleanPdfText(quote.quoteNumber), 92, 85.4);

  // Désignation centrée (devis à 1 ligne, comme le modèle)
  const singleLine = lines.length === 1;
  if (singleLine) {
    doc.setFont('times', 'bold');
    doc.setFontSize(12.5);
    setBlack();
    doc.text(lines[0].desc, 105, 110.7, { align: 'center' });
  }

  // Tableau : en-tête + lignes (pagination si long)
  let y = drawTableHead(91.3);
  const rowLimit = 232;
  const newTablePage = () => {
    doc.addPage();
    drawFrame();
    y = drawTableHead(14);
  };
  lines.forEach((ln) => {
    const h = singleLine ? 17.7 : 10;
    if (y + h > rowLimit) newTablePage();
    drawRow(ln, y, h, singleLine);
    y += h;
  });
  if (lines.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    setBlack();
    doc.text('Aucune prestation spécifiée dans ce devis.', CX[0] + 3, y + 6);
    y += 10;
    rule(CX[0], y, CX[6], y);
  }

  // ---- Totaux (droite) + montant en lettres (gauche) ----
  // La zone basse est en positions absolues dès 137.5 : les totaux doivent finir avant.
  if (y + 18 > 137.5) {
    doc.addPage();
    drawFrame();
    y = 95;
  }
  y += 5;
  const totX = 147.7;
  const totW = 52.5;
  const totValX = totX + totW - 1;
  let ty = y + 4.5;
  const totRow = (label: string, value: string, size = 7.5) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setBlack();
    doc.text(label, totX + 1, ty);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    setBlack();
    doc.text(value, totValX, ty, { align: 'right' });
    ty += 5.2;
  };
  totRow('Total H.T. :', formatMontant(netHt));
  if (hasDiscount) totRow(`Remise globale (${discountPercent}%) :`, `-${formatMontant(discountAmount)}`);
  totRow('TVA 18% :', formatMontant(tva));
  totRow('Total TTC :', formatMontant(ttc), 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setBlack();
  const wordsTitle = doc.splitTextToSize('Soit le présent devis arrêté à la somme de :', 125) as string[];
  doc.text(wordsTitle, 9.8, y + 4.5);
  const words = doc.splitTextToSize(`${nombreEnLettres(ttc)} FRANCS CFA`, 125) as string[];
  doc.text(words, 9.8, y + 4.5 + wordsTitle.length * 4.2);

  // ---- Zone basse (positions absolues du modèle, dernière page) ----
  // Cadre signature
  doc.setDrawColor(...black);
  doc.setLineWidth(0.4);
  doc.rect(25.3, 137.5, 63, 29.8, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  setBlack();
  doc.text(cleanPdfText(`Signature ${companyName}`), 38.6, 141.7);
  // Cachet : paramètre entreprise, sinon celui du modèle
  const stampSrc = settings.companyStampBase64 || devisPdfAssets.cachet;
  if (stampSrc) {
    try {
      const fmt = stampSrc.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(stampSrc, fmt, 43.3, 145.5, 22.3, 19.8);
    } catch {
      try { doc.addImage(stampSrc, 'JPEG', 43.3, 145.5, 22.3, 19.8); } catch { /* sans cachet */ }
    }
  }

  // Bandeau Échéance / Montant / CGV / Banque
  doc.setDrawColor(...black);
  doc.setLineWidth(0.4);
  doc.rect(9.8, 171.9, 190.6, 5, 'S');
  doc.rect(9.8, 176.9, 190.6, 15.1, 'S');
  [25, 48.5, 147.7].forEach(x => doc.line(x, 171.9, x, 192));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setBlack();
  doc.text('Échéance', 11.3, 175.4);
  doc.text('Montant', 31.8, 175.4);
  doc.text('Conditions générales de vente', 78.4, 175.4);
  doc.text('Coordonnées bancaires', 158.4, 175.4);
  // Corps
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setBlack();
  doc.text(cleanPdfText(validUntilFr || '-'), 11.3, 181.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setBlack();
  doc.text(formatMontant(ttc), 47.5, 185.2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  setBlack();
  const cgvLines: string[] = [cleanPdfText(validityText)];
  if (quote.paymentTerms) cgvLines.push(cleanPdfText(`Paiement : ${quote.paymentTerms}`));
  if (quote.notes) cgvLines.push(cleanPdfText(quote.notes));
  const cgvWrapped: string[] = [];
  cgvLines.forEach(l => (doc.splitTextToSize(l, 94) as string[]).slice(0, 3 - cgvWrapped.length).forEach(w => cgvWrapped.push(w)));
  cgvWrapped.slice(0, 3).forEach((wl, i) => doc.text(wl, 50, 181.5 + i * 4));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  setBlack();
  doc.text(cleanPdfText(`IBAN: ${iban1}`.trim()), 149, 183.4);
  if (iban2) doc.text(cleanPdfText(iban2), 149, 187.2);

  // ---- Pied de page + numérotation (toutes pages) ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
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

export function generateInvoicePdf(
  invoice: Invoice,
  client: Client | undefined,
  quote: Quote | undefined,
  settings: AppSettings,
  payments: InvoicePayment[] = []
): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2; // 178 mm
  const accent: [number, number, number] = [2, 132, 199]; // Bleu Facture #0284C7
  const accentLight = mixWithWhite(accent, 0.92);
  const accentSoft = mixWithWhite(accent, 0.75);
  const dark: [number, number, number] = [30, 34, 42];
  const muted: [number, number, number] = [100, 112, 125];
  const neutralLight: [number, number, number] = [246, 248, 250];
  const neutralBorder: [number, number, number] = [222, 226, 230];
  const companyName = settings.companyName || 'HINOV';
  const dateFr = formatDateFr(invoice.issueDate);
  const dueDateFr = formatDateFr(invoice.dueDate);
  const deliveryDateFr = invoice.deliveryDate ? formatDateFr(invoice.deliveryDate) : '-';
  let y = 0;

  // 1. EN-TÊTE
  if (settings.headerLogoBase64) {
    const bannerH = 34;
    let rendered = false;
    try {
      const isPng = settings.headerLogoBase64.includes('image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      doc.addImage(settings.headerLogoBase64, format, 0, 0, pageW, bannerH);
      rendered = true;
    } catch {
      try {
        doc.addImage(settings.headerLogoBase64, 'JPEG', 0, 0, pageW, bannerH);
        rendered = true;
      } catch {}
    }
    if (!rendered) {
      doc.setFillColor(...accent);
      doc.rect(0, 0, pageW, 36, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(companyName.toUpperCase(), margin, 18);
    }
    y = bannerH + 14;
  } else {
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(...mixWithWhite(accent, 0.2));
    doc.rect(0, 38, pageW, 1.5, 'F');

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

    // Droite : Facture
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('FACTURE', pageW - margin, 15, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`N° ${invoice.invoiceNumber}`, pageW - margin, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(230, 242, 245);
    doc.text(`Date : ${dateFr}`, pageW - margin, 27, { align: 'right' });
    doc.text(`Échéance : ${dueDateFr}`, pageW - margin, 32, { align: 'right' });
    y = 52;
  }

  // 2. ENCADRÉS CLIENT & FACTURE
  const cardGap = 8;
  const cardW = (contentW - cardGap) / 2;
  const cardH = 36;
  const cardLeftX = margin;
  const cardRightX = margin + cardW + cardGap;
  const cardY = y;

  // Gauche : CLIENT
  doc.setFillColor(...neutralLight);
  doc.roundedRect(cardLeftX, cardY, cardW, cardH, 2, 2, 'F');
  doc.setDrawColor(...neutralBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardLeftX, cardY, cardW, cardH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accent);
  doc.text('FACTURÉ À (CLIENT)', cardLeftX + 5, cardY + 6.5);

  const clientName = client?.company || client?.name || 'Client';
  const clientContact = client?.contact ? `Attn : ${client.contact}` : '';
  const clientPhone = client?.phone ? `Tél : ${client.phone}` : (client?.email ? `Email : ${client.email}` : '');
  const clientAddr = client?.address || '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...dark);
  const clientNameWrapped = doc.splitTextToSize(clientName, cardW - 10) as string[];
  doc.text(clientNameWrapped[0], cardLeftX + 5, cardY + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let cOffsetY = cardY + 19.5;
  if (clientContact) {
    doc.text(clientContact, cardLeftX + 5, cOffsetY);
    cOffsetY += 5.5;
  }
  if (clientPhone) {
    doc.text(clientPhone, cardLeftX + 5, cOffsetY);
    cOffsetY += 5.5;
  } else if (clientAddr) {
    doc.text(clientAddr, cardLeftX + 5, cOffsetY);
  }

  // Droite : DÉTAILS FACTURE
  doc.setFillColor(...neutralLight);
  doc.roundedRect(cardRightX, cardY, cardW, cardH, 2, 2, 'F');
  doc.setDrawColor(...neutralBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardRightX, cardY, cardW, cardH, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...accent);
  doc.text(`FACTURE N° ${invoice.invoiceNumber}`, cardRightX + 5, cardY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...dark);
  doc.text(`Date d'émission : ${dateFr}`, cardRightX + 5, cardY + 13.5);
  doc.text(`Date de livraison : ${deliveryDateFr}`, cardRightX + 5, cardY + 19);
  doc.text(`Date d'échéance : ${dueDateFr} (${invoice.paymentTerms || '30 jours'})`, cardRightX + 5, cardY + 24.5);
  if (quote?.quoteNumber || invoice.quoteId) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Réf. Devis : ${quote?.quoteNumber || invoice.quoteId}`, cardRightX + 5, cardY + 30);
  }

  y += cardH + 9;

  // 3. TABLEAU DES LIGNES DE FACTURE
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
    doc.setFillColor(...accent);
    doc.rect(tableX, y, contentW, thH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    doc.text('DÉSIGNATION', tableX + 3, y + 5.5);
    doc.text('QTÉ', tableX + colW.desc + colW.qty / 2, y + 5.5, { align: 'center' });
    doc.text('P.U. (FCFA)', tableX + colW.desc + colW.qty + colW.unitPrice - 3, y + 5.5, { align: 'right' });
    doc.text('REMISE', tableX + colW.desc + colW.qty + colW.unitPrice + colW.discount / 2, y + 5.5, { align: 'center' });
    doc.text('TOTAL (FCFA)', tableX + contentW - 3, y + 5.5, { align: 'right' });

    y += thH;
  };

  drawTableHeader();

  const lines = invoice.items || [];
  if (lines.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Prestations facturées selon devis validé.', tableX + 3, y + 6);
    y += 10;
    doc.setDrawColor(...neutralBorder);
    doc.setLineWidth(0.2);
    doc.line(tableX, y, tableX + contentW, y);
  } else {
    lines.forEach((line, idx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const descClean = cleanPdfText(line.description) || 'Prestation';
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unitPrice || 0);
      const discountPercent = Number(line.discountPercent || 0);
      const totalVal = Number(line.total || qty * unitPrice);

      const descLines = doc.splitTextToSize(descClean, colW.desc - 6) as string[];
      const rowH = Math.max(7.5, descLines.length * 4.2 + 3.5);

      if (y + rowH > pageH - 45) {
        doc.addPage();
        y = margin + 4;
        drawTableHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(...accentLight);
        doc.rect(tableX, y, contentW, rowH, 'F');
      }

      doc.setTextColor(...dark);
      descLines.forEach((dLine, dIdx) => {
        doc.text(dLine, tableX + 3, y + 4.8 + dIdx * 4.2);
      });

      doc.text(String(qty), tableX + colW.desc + colW.qty / 2, y + 4.8, { align: 'center' });
      doc.text(formatAmount(unitPrice), tableX + colW.desc + colW.qty + colW.unitPrice - 3, y + 4.8, { align: 'right' });

      const discountText = discountPercent > 0 ? `-${discountPercent}%` : '-';
      doc.setTextColor(...(discountPercent > 0 ? accent : muted));
      doc.text(discountText, tableX + colW.desc + colW.qty + colW.unitPrice + colW.discount / 2, y + 4.8, { align: 'center' });

      doc.setTextColor(...dark);
      doc.setFont('helvetica', 'bold');
      doc.text(formatAmount(totalVal), tableX + contentW - 3, y + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += rowH;

      doc.setDrawColor(...neutralBorder);
      doc.setLineWidth(0.2);
      doc.line(tableX, y, tableX + contentW, y);
    });
  }

  y += 5;

  // 4. TOTAUX & ÉTAT DE PAIEMENT
  if (y > pageH - 68) {
    doc.addPage();
    y = margin + 4;
  }

  const totalsW = 76;
  const totalsX = pageW - margin - totalsW;
  const notesW = contentW - totalsW - 8;
  const notesX = margin;

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (invoice.totalAmount || 0) - totalPaid);

  // Bloc gauche : Historique paiements / Notes
  doc.setFillColor(...neutralLight);
  doc.roundedRect(notesX, y, notesW, 36, 1.5, 1.5, 'F');
  doc.setDrawColor(...neutralBorder);
  doc.setLineWidth(0.2);
  doc.roundedRect(notesX, y, notesW, 36, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text('RÈGLEMENT & ACOMPTES ENCAISSÉS', notesX + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...dark);
  let pOffsetY = y + 11;

  if (payments.length > 0) {
    payments.slice(0, 3).forEach(p => {
      doc.text(`• ${formatDateFr(p.paymentDate)} : ${formatAmount(p.amount)} (${p.paymentMethod || 'Espèces'})`, notesX + 4, pOffsetY);
      pOffsetY += 4.5;
    });
    if (payments.length > 3) {
      doc.text(`(+ ${payments.length - 3} autre(s) paiement(s))`, notesX + 4, pOffsetY);
    }
  } else {
    doc.text('Aucun paiement enregistré pour cette facture.', notesX + 4, pOffsetY);
    pOffsetY += 5;
    if (invoice.notes) {
      doc.text(cleanPdfText(invoice.notes), notesX + 4, pOffsetY);
    }
  }

  // Bloc droit : Totaux
  const totBoxH = 36;
  doc.setFillColor(...accentLight);
  doc.roundedRect(totalsX, y, totalsW, totBoxH, 2, 2, 'F');
  doc.setDrawColor(...accentSoft);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsX, y, totalsW, totBoxH, 2, 2, 'S');

  let totY = y + 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  doc.text('Montant Total TTC :', totalsX + 4, totY);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text(formatAmount(invoice.totalAmount || 0), pageW - margin - 4, totY, { align: 'right' });
  totY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.text('Total Déjà Payé :', totalsX + 4, totY);
  doc.setTextColor(22, 163, 74); // Vert
  doc.setFont('helvetica', 'bold');
  doc.text(formatAmount(totalPaid), pageW - margin - 4, totY, { align: 'right' });
  totY += 7;

  // Ligne NET RESTANT À PAYER
  const totalBannerH = 9.5;
  const bannerColor: [number, number, number] = remaining === 0 ? [22, 163, 74] : accent;
  doc.setFillColor(...bannerColor);
  doc.roundedRect(totalsX, y + totBoxH - totalBannerH, totalsW, totalBannerH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(remaining === 0 ? 'FACTURE PAYÉE' : 'RESTE À PAYER', totalsX + 4, y + totBoxH - 3.2);
  doc.text(formatAmount(remaining), pageW - margin - 4, y + totBoxH - 3.2, { align: 'right' });

  y += totBoxH + 6;

  // 5. MENTIONS & SIGNATURES
  if (y > pageH - 42) {
    doc.addPage();
    y = margin + 4;
  }

  const condH = 6;
  doc.setFillColor(...neutralLight);
  doc.rect(margin, y, contentW, condH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text('CONDITIONS DE PAIEMENT & MENTIONS LÉGALES', margin + 4, y + 4.2);
  y += condH + 3.5;

  const conditionsList = [
    `- Date limite de règlement : ${dueDateFr} (${invoice.paymentTerms || '30 jours'}).`,
    `- En cas de retard de paiement, des pénalités d'un taux égal au taux d'intérêt légal seront exigibles de plein droit.`,
    settings.defaultTerms ? `- ${cleanPdfText(settings.defaultTerms)}` : `- Merci pour votre confiance !`
  ];

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

  // Signature / Cachet
  const sigW = 85;
  const sigH = 22;
  const sigX = pageW - margin - sigW;
  doc.setDrawColor(...neutralBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(sigX, y, sigW, sigH, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text('Pour l\'entreprise - Cachet & Signature', sigX + 4, y + 5);

  if (settings.companyStampBase64) {
    try {
      doc.addImage(settings.companyStampBase64, 'PNG', sigX + sigW - 32, y + 2, 28, 18);
    } catch {}
  }

  return doc.output('blob');
}