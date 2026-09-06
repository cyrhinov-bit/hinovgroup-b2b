import { getUserGeminiKey } from '../../../lib/geminiKey';
import type { PosProduct, PosTransaction, PosCashSession, PosReturn, User } from '../../../context/AppContext';

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
  posReturns?: PosReturn[];
  users: User[];
  currentUserName?: string;
  userId?: string;
}

/**
 * Prépare un condensé des métriques clés du Point de Vente (POS) pour le prompt IA
 */
function buildPosSummary(context: CopilotContextData) {
  const { posProducts, posTransactions, posCashSessions, posReturns = [], users } = context;

  // Calculs Ventes POS
  const validTransactions = posTransactions.filter(t => t.status === 'Validée');
  const totalPosRevenue = validTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalPosDiscounts = validTransactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
  const averageTicket = validTransactions.length > 0 ? Math.round(totalPosRevenue / validTransactions.length) : 0;
  
  // Ventes par mode de paiement
  let cashRevenue = 0;
  let mobileRevenue = 0;
  let otherRevenue = 0;
  validTransactions.forEach(t => {
    (t.payments || []).forEach(p => {
      if (p.method === 'Espèces') cashRevenue += p.amount;
      else if (p.method === 'Mobile Money') mobileRevenue += p.amount;
      else otherRevenue += p.amount;
    });
  });

  // Stocks & Produits Magasin
  const activeProducts = posProducts.filter(p => p.isActive !== false && p.status !== 'Inactive');
  const outOfStock = activeProducts.filter(p => p.quantity <= 0);
  const lowStock = activeProducts.filter(p => p.quantity > 0 && p.quantity <= (p.minStock || 5));
  const totalStockPurchaseValue = activeProducts.reduce((sum, p) => sum + (p.purchasePrice || 0) * (p.quantity || 0), 0);
  const totalStockSellingValue = activeProducts.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.quantity || 0), 0);
  const theoreticalProfitMargin = totalStockSellingValue - totalStockPurchaseValue;

  // Top 5 produits par chiffre d'affaires
  const productSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
  validTransactions.forEach(tx => {
    (tx.lines || []).forEach(line => {
      const key = line.productId || line.description;
      const existing = productSalesMap.get(key) || { name: line.description, qty: 0, revenue: 0 };
      existing.qty += line.quantity;
      existing.revenue += line.total;
      productSalesMap.set(key, existing);
    });
  });
  const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Sessions de caisse & Écarts
  const closedSessions = posCashSessions.filter(s => s.status === 'Fermée');
  const totalCashDiscrepancies = closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0);
  const sessionsWithDiscrepancy = closedSessions
    .filter(s => typeof s.difference === 'number' && Math.abs(s.difference) > 0)
    .map(s => {
      const cashier = users.find(u => u.id === s.cashierId)?.name || 'Inconnu';
      return {
        sessionDate: s.closedAt || s.openedAt,
        cashier,
        difference: s.difference,
        expected: s.expectedAmount,
        counted: s.finalAmount
      };
    });

  // Retours POS
  const totalReturnsAmount = posReturns.reduce((sum, r) => sum + (r.totalRefund || 0), 0);

  return {
    kpis: {
      totalPosRevenue,
      totalPosDiscounts,
      averageTicket,
      totalValidTransactions: validTransactions.length,
      cashRevenue,
      mobileRevenue,
      otherRevenue,
      activeProductsCount: activeProducts.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      totalStockPurchaseValue,
      totalStockSellingValue,
      theoreticalProfitMargin,
      totalCashDiscrepancies,
      closedSessionsCount: closedSessions.length,
      totalReturnsAmount
    },
    topProducts,
    outOfStockSample: outOfStock.slice(0, 8).map(p => ({ name: p.name, ref: p.reference })),
    lowStockSample: lowStock.slice(0, 8).map(p => ({ name: p.name, ref: p.reference, stock: p.quantity, min: p.minStock })),
    sessionsWithDiscrepancy: sessionsWithDiscrepancy.slice(0, 5)
  };
}

/**
 * Interroge le Copilot Direction POS (Gemini) avec l'état temps réel du Point de Vente
 */
export async function askDirectorCopilot(
  userQuery: string,
  context: CopilotContextData,
  conversationHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
): Promise<{ replyText: string; suggestedFollowUps: string[] }> {
  const query = userQuery.trim();
  if (!query) {
    return {
      replyText: "Veuillez poser une question sur les ventes, stocks, caisses ou finances du magasin.",
      suggestedFollowUps: ["Bilan financier du magasin", "Articles en alerte de stock", "Derniers écarts de caisse"]
    };
  }

  const posData = buildPosSummary(context);
  const userApiKey = getUserGeminiKey(context.userId);

  const systemInstruction = `
Tu es le Copilote Décisionnel et Conseiller Stratégique exclusif du Point de Vente (POS / Boutique / Caisse) de HINOV GROUP.
Tu t'adresses directement à la Direction du Point de Vente (${context.currentUserName || 'Monsieur le Directeur'}).
Tu es 100% focalisé sur la gestion du magasin, les ventes en caisse, les stocks de la boutique, les sessions de caisse, les prix, les remises et la rentabilité du point de vente.

DONNÉES EN TEMPS RÉEL DU POINT DE VENTE (POS) :
${JSON.stringify(posData, null, 2)}

RÈGLES DE RÉPONSE STRICTES :
1. Sois direct, professionnel, chiffré, rigoureux et orienté décision magasin.
2. Utilise impérativement la devise FCFA pour tous les montants.
3. Mets en valeur les chiffres clés en gras, et utilise des listes à puces ou tableaux simples pour la lisibilité.
4. Identifie proactivement les points de vigilance (ex: ruptures de stock, écarts de caisse, remises élevées, produits à faible marge).
5. Ne fais AUCUNE mention du CRM ou des devis B2B car ton périmètre est strictement le Point de Vente / Magasin.
6. Propose 2 à 3 questions de suivi pertinentes à la fin sous format JSON structuré si possible.
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
                parts: [{ text: `${systemInstruction}\n\nQUESTION DE LA DIRECTION :\n"${query}"` }]
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
          return {
            replyText: reply,
            suggestedFollowUps: [
              "Quels sont nos 5 articles les plus rentables ?",
              "Y a-t-il des anomalies sur les clôtures de caisse ?",
              "Articles à réapprovisionner en priorité"
            ]
          };
        }
      }
    } catch (err) {
      console.warn('Erreur appel Copilot Direction POS :', err);
    }
  }

  // Fallback intelligent en local
  const k = posData.kpis;
  return {
    replyText: `**Synthèse Point de Vente (POS) pour la Direction :**\n\n` +
      `• **Chiffre d'Affaires POS (Caisse)** : **${k.totalPosRevenue.toLocaleString()} FCFA** (${k.totalValidTransactions} ventes, panier moyen : **${k.averageTicket.toLocaleString()} FCFA**)\n` +
      `• **Encaissements** : Espèces **${k.cashRevenue.toLocaleString()} FCFA** | Mobile Money **${k.mobileRevenue.toLocaleString()} FCFA**\n` +
      `• **Valeur du Stock Magasin (Achat)** : **${k.totalStockPurchaseValue.toLocaleString()} FCFA** (Valeur de vente : **${k.totalStockSellingValue.toLocaleString()} FCFA**)\n` +
      `• **Alertes Stock** : **${k.outOfStockCount}** rupture(s) | **${k.lowStockCount}** article(s) sous le seuil\n` +
      `• **Écarts cumulés de caisse** : **${k.totalCashDiscrepancies > 0 ? '+' : ''}${k.totalCashDiscrepancies.toLocaleString()} FCFA** sur ${k.closedSessionsCount} session(s) fermée(s)\n\n` +
      `*Pour une analyse plus détaillée en langage naturel, assurez-vous que votre clé API Gemini est configurée dans Paramètres IA.*`,
    suggestedFollowUps: [
      "Quels articles sont en rupture de stock ?",
      "Détail des remises accordées en caisse",
      "Écarts de caisse par caissier"
    ]
  };
}
