import { getUserGeminiKey } from '../../../lib/geminiKey';
import type { PosProduct, PosTransaction, PosCashSession, Sale, Client, User, V2WeeklyReport } from '../../../context/AppContext';

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  highlights?: string[];
  tables?: { headers: string[]; rows: string[][] };
  suggestedFollowUps?: string[];
}

export interface CopilotContextData {
  posProducts: PosProduct[];
  posTransactions: PosTransaction[];
  posCashSessions: PosCashSession[];
  sales: Sale[];
  clients: Client[];
  users: User[];
  v2WeeklyReports: V2WeeklyReport[];
  currentUserName?: string;
  userId?: string;
}

/**
 * Prépare un condensé des métriques clés de l'entreprise pour le prompt IA
 */
function buildCompanySummary(context: CopilotContextData) {
  const { posProducts, posTransactions, posCashSessions, sales, clients, users, v2WeeklyReports } = context;

  // Calculs POS
  const validTransactions = posTransactions.filter(t => t.status === 'Validée');
  const totalPosRevenue = validTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalPosDiscounts = validTransactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
  
  // Ventes par mode de paiement
  let cashRevenue = 0;
  let mobileRevenue = 0;
  validTransactions.forEach(t => {
    (t.payments || []).forEach(p => {
      if (p.method === 'Espèces') cashRevenue += p.amount;
      if (p.method === 'Mobile Money') mobileRevenue += p.amount;
    });
  });

  // Calculs B2B CRM
  const totalSalesRevenue = sales.filter(s => s.status !== 'Annulée').reduce((sum, s) => sum + (s.total || 0), 0);
  const paidSales = sales.filter(s => s.status === 'Payée').reduce((sum, s) => sum + (s.total || 0), 0);
  const unpaidReceivables = sales.filter(s => s.status === 'Enregistrée').reduce((sum, s) => sum + (s.total || 0), 0);

  // Stocks & Produits
  const activeProducts = posProducts.filter(p => p.isActive !== false && p.status !== 'Inactive');
  const outOfStockCount = activeProducts.filter(p => p.quantity <= 0).length;
  const lowStockCount = activeProducts.filter(p => p.quantity > 0 && p.quantity <= (p.minStock || 5)).length;
  const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.purchasePrice || 0) * (p.quantity || 0), 0);
  const totalStockSellingValue = activeProducts.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.quantity || 0), 0);

  // Top 5 produits par vente
  const productSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
  validTransactions.forEach(tx => {
    (tx.lines || []).forEach(line => {
      const existing = productSalesMap.get(line.productId || line.description) || { name: line.description, qty: 0, revenue: 0 };
      existing.qty += line.quantity;
      existing.revenue += line.total;
      productSalesMap.set(line.productId || line.description, existing);
    });
  });
  const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Sessions de caisse & Écarts
  const closedSessions = posCashSessions.filter(s => s.status === 'Fermée');
  const totalCashDiscrepancies = closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0);

  // Rapports d'équipe récents
  const recentReportsSummary = v2WeeklyReports.slice(0, 10).map(r => {
    const author = users.find(u => u.id === r.authorId);
    return {
      author: author?.name || 'Inconnu',
      role: author?.role || 'Collaborateur',
      week: r.weekStart,
      difficulties: r.difficulties || 'Aucune',
      status: r.status
    };
  });

  return {
    kpis: {
      totalPosRevenue,
      totalPosDiscounts,
      cashRevenue,
      mobileRevenue,
      totalSalesRevenue,
      unpaidReceivables,
      activeProductsCount: activeProducts.length,
      outOfStockCount,
      lowStockCount,
      totalStockValue,
      totalStockSellingValue,
      totalCashDiscrepancies,
      usersCount: users.length,
      clientsCount: clients.length,
      closedSessionsCount: closedSessions.length
    },
    topProducts,
    recentReportsSummary
  };
}

/**
 * Interroge le Copilot Direction (Gemini) avec l'état temps réel de l'entreprise
 */
export async function askDirectorCopilot(
  userQuery: string,
  context: CopilotContextData,
  conversationHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
): Promise<{ replyText: string; suggestedFollowUps: string[] }> {
  const query = userQuery.trim();
  if (!query) {
    return {
      replyText: "Veuillez poser une question sur les ventes, stocks, caisses ou finances de l'entreprise.",
      suggestedFollowUps: ["Bilan financier global", "Articles en alerte de stock", "Derniers écarts de caisse"]
    };
  }

  const companyData = buildCompanySummary(context);
  const userApiKey = getUserGeminiKey(context.userId);

  const systemInstruction = `
Tu es le Copilote Stratégique & Conseiller Décisionnel de la Direction Générale de HINOV GROUP (Entreprise B2B, Papeterie, Librairie et Fournitures).
Tu t'adresses directement au Directeur Général (${context.currentUserName || 'Monsieur le Directeur'}).

DONNÉES EN TEMPS RÉEL DE L'ENTREPRISE :
${JSON.stringify(companyData, null, 2)}

RÈGLES DE RÉPONSE STRICTES :
1. Sois direct, professionnel, chiffré, rigoureux et stratégique.
2. Utilise la devise FCFA pour tous les montants.
3. Mets en valeur les chiffres clés en gras, et utilise des listes à puces ou tableaux simples quand c'est pertinent.
4. Identifie proactivement les points de vigilance (ex: créances impayées, stocks faibles, écarts de caisse).
5. Propose 2 à 3 questions de suivi pertinentes à la fin sous format JSON structuré si possible.
`;

  if (userApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(userApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...conversationHistory,
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nQUESTION DU DIRECTEUR :\n"${query}"` }]
              }
            ],
            generationConfig: {
              temperature: 0.2
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          // Extraire des suggestions automatiques
          const followUps = [
            "Quels sont nos 5 articles les plus rentables ?",
            "Y a-t-il des anomalies sur les clôtures de caisse ?",
            "Quel est le bilan des créances clients à recouvrer ?"
          ];
          return {
            replyText: reply,
            suggestedFollowUps: followUps
          };
        }
      }
    } catch (err) {
      console.warn('Erreur appel Copilot Direction :', err);
    }
  }

  // Réponse locale intelligente de secours
  const k = companyData.kpis;
  return {
    replyText: `**Synthèse Globale pour la Direction :**\n\n` +
      `• **Chiffre d'Affaires POS (Caisse)** : ${k.totalPosRevenue.toLocaleString()} FCFA\n` +
      `• **Chiffre d'Affaires B2B** : ${k.totalSalesRevenue.toLocaleString()} FCFA (Créances : ${k.unpaidReceivables.toLocaleString()} FCFA)\n` +
      `• **Valeur du Stock (Achat)** : ${k.totalStockValue.toLocaleString()} FCFA (${k.outOfStockCount} rupture(s), ${k.lowStockCount} stock(s) faible(s))\n` +
      `• **Écarts cumulés de caisse** : ${k.totalCashDiscrepancies > 0 ? '+' : ''}${k.totalCashDiscrepancies.toLocaleString()} FCFA sur ${k.closedSessionsCount} session(s)\n\n` +
      `*Pour une analyse plus détaillée en langage naturel, assurez-vous que votre clé API Gemini est configurée.*`,
    suggestedFollowUps: [
      "Quels produits sont en rupture de stock ?",
      "Détail des remises accordées",
      "Point sur les règlements clients"
    ]
  };
}
