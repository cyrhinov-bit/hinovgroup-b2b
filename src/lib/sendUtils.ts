import type { Client, AppSettings, Quote } from '../context/AppContext';

export interface SendOption {
  type: 'email' | 'whatsapp';
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteNumber: string;
  companyName: string;
  subject?: string;
  total: number;
}

/**
 * Format phone number cleanly for WhatsApp link
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned.startsWith('+')) {
    // Si aucun indicatif international n'est saisi (+), on utilise le format standard
    // (ex: +225 pour Côte d'Ivoire si numéro local à 10 chiffres)
    if (cleaned.length === 10) {
      cleaned = '+225' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned.replace('+', '');
}

/**
 * Generates email content for mailto link or email client
 */
export function generateEmailContent(quote: Quote, client?: Client, settings?: AppSettings) {
  const company = settings?.companyName || 'Notre Entreprise';
  const clientName = client?.contact || client?.name || 'Client';

  const emailSubject = `Devis N° ${quote.quoteNumber} - ${quote.subject || company}`;
  const emailBody = `Bonjour ${clientName},\n\n` +
    `Veuillez trouver ci-joint votre devis N° ${quote.quoteNumber} d'un montant de ${quote.total.toLocaleString('fr-FR')} FCFA.\n\n` +
    `N'hésitez pas à nous contacter pour toute question.\n\n` +
    `Cordialement,\n` +
    `${company}`;

  return {
    subject: emailSubject,
    body: emailBody,
    mailto: `mailto:${encodeURIComponent(client?.email || '')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
  };
}

/**
 * Generates WhatsApp link
 */
export function generateWhatsAppLink(quote: Quote, client?: Client, settings?: AppSettings): { link: string; error?: string } {
  if (!client || !client.phone) {
    return { link: '', error: "Ce client n'a pas de numéro de téléphone enregistré." };
  }

  const company = settings?.companyName || 'Notre Entreprise';
  const clientName = client?.contact || client?.name || 'Client';

  const message = `Bonjour ${clientName},\n\nVeuillez trouver ci-joint votre devis N° ${quote.quoteNumber} d'un montant de ${quote.total.toLocaleString('fr-FR')} FCFA.\n\nMerci de votre confiance.\n\n${company}`;
  
  const phoneFormatted = formatWhatsAppPhone(client.phone);
  const waLink = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(message)}`;

  return { link: waLink };
}
