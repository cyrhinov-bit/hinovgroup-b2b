import { getUserGeminiKey } from '../../../lib/geminiKey';
import type { PosProduct, PosTransaction, PosCashSession, PosReturn, User } from '../../../context/AppContext';
import type { PosMagasin, PosStockTransfer } from '../../../types/posMagasins';
import { DEFAULT_MAGASIN } from '../../pos/services/PosMagasinService';

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
  posMagasins?: PosMagasin[];
  stockTransfers?: PosStockTransfer[];
  selectedMagasinId?: string; // 'ALL' ou id spécifique
  currentUserName?: string;
  userId?: string;
}

/**
 * Prépare un condensé multi-magasins des métriques clés du Point de Vente pour le prompt IA
 */
function buildPosSummary(context: CopilotContextData) {
  const {
    posProducts,
    posTransactions,
    posCashSessions,
    posReturns = [],
    users,
    posMagasins = [DEFAULT_MAGASIN],
    stockTransfers = [],
    selectedMagasinId = 'ALL'
  } = context;

  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Inconnu';
  const getMagasinName = (id?: string) => posMagasins.find(m => m.id === id)?.nom || DEFAULT_MAGASIN.nom;
  const resolveMagasinId = (mId?: string, sId?: string) => mId || sId || DEFAULT_MAGASIN.id;

  // Filtrer selon magasin sélectionné si pas 'ALL'
  const isFilteringSpecificStore = selectedMagasinId && selectedMagasinId !== 'ALL';

  const relevantTransactions = isFilteringSpecificStore
    ? posTransactions.filter(t => {
        const s = t.sessionId ? posCashSessions.find(cs => cs.id === t.sessionId) : undefined;
        return resolveMagasinId(t.magasinId, s?.magasinId) === selectedMagasinId;
      })
    : posTransactions;

  const validTransactions = relevantTransactions.filter(t => t.status === 'Validée');
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
  const relevantSessions = isFilteringSpecificStore
    ? posCashSessions.filter(s => resolveMagasinId(s.magasinId) === selectedMagasinId)
    : posCashSessions;

  const closedSessions = relevantSessions.filter(s => s.status === 'Fermée');
  const totalCashDiscrepancies = closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0);
  const sessionsWithDiscrepancy = closedSessions
    .filter(s => typeof s.difference === 'number' && Math.abs(s.difference) > 0)
    .map(s => {
      const cashier = getUserName(s.cashierId);
      const magNom = getMagasinName(s.magasinId);
      return {
        sessionDate: s.closedAt || s.openedAt,
        magasin: magNom,
        cashier,
        difference: s.difference,
        expected: s.expectedAmount,
        counted: s.finalAmount
      };
    });

  // Retours POS
  const totalReturnsAmount = posReturns.reduce((sum, r) => sum + (r.totalRefund || 0), 0);

  // SYNTHÈSE DÉTAILLÉE PAR MAGASIN (Multi-Magasins)
  const storeSummaries = posMagasins.map(mag => {
    const magTxs = posTransactions.filter(t => {
      const s = t.sessionId ? posCashSessions.find(cs => cs.id === t.sessionId) : undefined;
      return resolveMagasinId(t.magasinId, s?.magasinId) === mag.id && t.status === 'Validée';
    });
    const magRevenue = magTxs.reduce((sum, t) => sum + (t.total || 0), 0);
    const magDiscounts = magTxs.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
    const magAvgBasket = magTxs.length > 0 ? Math.round(magRevenue / magTxs.length) : 0;

    const magSessions = posCashSessions.filter(s => resolveMagasinId(s.magasinId) === mag.id && s.status === 'Fermée');
    const magDiscrepancies = magSessions.reduce((sum, s) => sum + (s.difference || 0), 0);

    return {
      id: mag.id,
      nom: mag.nom,
      ville: mag.ville || 'Abidjan',
      revenue: magRevenue,
      transactionCount: magTxs.length,
      averageBasket: magAvgBasket,
      discounts: magDiscounts,
      cashDiscrepancies: magDiscrepancies,
      closedSessionsCount: magSessions.length
    };
  });

  // Transferts de stock en cours
  const pendingTransfers = stockTransfers.filter(t => t.status === 'Expédié');

  return {
    scope: isFilteringSpecificStore ? `Magasin : ${getMagasinName(selectedMagasinId)}` : 'Réseau Consolidé (Tous les magasins)',
    totalStoresCount: posMagasins.length,
    storeSummaries,
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
      totalReturnsAmount,
      pendingTransfersCount: pendingTransfers.length
    },
    topProducts,
    outOfStockSample: outOfStock.slice(0, 8).map(p => ({ name: p.name, ref: p.reference })),
    lowStockSample: lowStock.slice(0, 8).map(p => ({ name: p.name, ref: p.reference, stock: p.quantity, min: p.minStock })),
    sessionsWithDiscrepancy: sessionsWithDiscrepancy.slice(0, 6),
    pendingTransfersSample: pendingTransfers.slice(0, 5).map(t => ({
      num: t.transferNumber,
      from: getMagasinName(t.magasinSourceId),
      to: getMagasinName(t.magasinDestId),
      itemsCount: (t.lines || []).reduce((s, l) => s + (l.quantity || 0), 0),
      shippedAt: t.shippedAt
    }))
  };
}

/**
 * Interroge le Copilot Direction POS Multi-Magasins (Gemini)
 */
export async function askDirectorCopilot(
  userQuery: string,
  context: CopilotContextData,
  conversationHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
): Promise<{ replyText: string; suggestedFollowUps: string[] }> {
  const query = userQuery.trim();
  if (!query) {
    return {
      replyText: "Veuillez poser une question sur les ventes, stocks, caisses, transferts ou performances de l'ensemble de vos magasins.",
      suggestedFollowUps: [
        "📊 Comparatif de rentabilité de tous les magasins",
        "🔄 Quels transferts de stock recommandez-vous ?",
        "💰 Contrôle des écarts de caisse par librairie",
        "📦 Articles en rupture dans le réseau"
      ]
    };
  }

  const posData = buildPosSummary(context);
  const userApiKey = getUserGeminiKey(context.userId);

  const systemInstruction = `
Tu es le Copilote Décisionnel et Conseiller Stratégique Senior de la Direction Générale du Réseau de Magasins & Librairies HINOV GROUP.
Tu t'adresses directement au Directeur (${context.currentUserName || 'Monsieur le Directeur'}).
Tu as sous ta responsabilité l'ensemble du réseau des magasins / librairies de l'entreprise.

PÉRIMÈTRE ANALYSÉ EN TEMPS RÉEL :
${posData.scope}

DONNÉES EN TEMPS RÉEL DU RÉSEAU (TOUS LES MAGASINS) :
${JSON.stringify(posData, null, 2)}

RÈGLES DE RÉPONSE STRICTES :
1. Prise en compte intégrale de TOUS LES MAGASINS : compare systématiquement les performances entre librairies quand la question porte sur le réseau.
2. Identifie les déséquilibres de stock et propose des transferts inter-magasins pertinents pour éviter les ruptures.
3. Sois direct, professionnel, chiffré, rigoureux et orienté décision stratégique pour le Directeur.
4. Utilise impérativement la devise FCFA pour tous les montants.
5. Présente les classements ou comparaisons sous forme de tableaux clairs Markdown ou listes ordonnées.
6. OBLIGATION DE CONSEIL : Tu DOIS SYSTÉMATIQUEMENT INCLURE UNE SECTION :
   "### 💡 Conseils & Directives Stratégiques de la Direction"
   avec 3 à 5 conseils concrets et actionnables adaptés à chaque magasin (ex: réapprovisionnement, formation caisse, vente croisée, transfert inter-magasins).
7. Ne fais AUCUNE mention du CRM ou des devis B2B car ton périmètre est exclusivement le Point de Vente et le Réseau de Magasins.
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
              temperature: 0.25
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
              "📊 Comparatif de rentabilité de tous les magasins",
              "🔄 Quels transferts de stock recommandez-vous ?",
              "💰 Quel magasin a le plus d'écarts de caisse ?"
            ]
          };
        }
      }
    } catch (err) {
      console.warn('Erreur appel Copilot Direction Multi-Magasins :', err);
    }
  }

  // Fallback intelligent en local avec analyse multi-magasins
  return generateLocalPosAnalysis(query, posData);
}

function generateLocalPosAnalysis(query: string, posData: ReturnType<typeof buildPosSummary>) {
  const q = query.toLowerCase();
  const { kpis, storeSummaries, topProducts, sessionsWithDiscrepancy, outOfStockSample, lowStockSample, pendingTransfersSample } = posData;

  // Question portant sur la comparaison ou l'ensemble des magasins
  if (q.includes('tous') || q.includes('magasin') || q.includes('librairie') || q.includes('comparati') || q.includes('classement') || q.includes('réseau')) {
    const rows = storeSummaries.map((s, idx) =>
      `| **#${idx + 1} ${s.nom}** (${s.ville}) | **${s.revenue.toLocaleString()} FCFA** | ${s.transactionCount} | **${s.averageBasket.toLocaleString()} FCFA** | ${s.cashDiscrepancies > 0 ? `-${s.cashDiscrepancies.toLocaleString()} FCFA ⚠️` : '0 FCFA ✅'} |`
    ).join('\n');

    const topStore = [...storeSummaries].sort((a, b) => b.revenue - a.revenue)[0];
    const bestCashStore = [...storeSummaries].sort((a, b) => a.cashDiscrepancies - b.cashDiscrepancies)[0];

    return {
      replyText: `### 🏪 Bilan Comparatif de l'Ensemble des Magasins (${storeSummaries.length} sites)\n\n` +
        `Voici les performances consolidées de votre réseau de librairies/points de vente :\n\n` +
        `| Magasin / Librairie | Chiffre d'Affaires | Ventes | Panier Moyen | Écarts de Caisse |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        `${rows}\n\n` +
        `**Totaux Réseau Consolidés :**\n` +
        `- Chiffre d'affaires global : **${kpis.totalPosRevenue.toLocaleString()} FCFA**\n` +
        `- Écarts cumulés de caisse : **${kpis.totalCashDiscrepancies.toLocaleString()} FCFA**\n` +
        `- Transferts en cours entre boutiques : **${kpis.pendingTransfersCount}**\n\n` +
        `### 💡 Conseils & Directives Stratégiques :\n` +
        `1. **Valoriser la locomotive réseau :** Féliciter l'équipe de **${topStore?.nom || 'la Librairie Principale'}** pour son leadership en chiffre d'affaires et formaliser ses bonnes pratiques commerciales.\n` +
        `2. **Assainir les caisses :** Concentrer les contrôles contradictoires sur les magasins enregistrant des écarts récurrents.\n` +
        `3. **Harmoniser les paniers moyens :** Déployer les techniques de vente croisée (cross-selling) dans les librairies dont le panier moyen est inférieur à la moyenne réseau (${kpis.averageTicket.toLocaleString()} FCFA).\n` +
        `4. **Fluidifier les transferts :** Traiter en priorité les **${kpis.pendingTransfersCount}** transfert(s) en transit pour réapprovisionner les rayons en tension.`,
      suggestedFollowUps: [
        "🔄 Quels transferts de stock réaliser en priorité ?",
        "💰 Détail des écarts de caisse par magasin",
        "📦 Quels sont les articles en rupture dans le réseau ?"
      ]
    };
  }

  // Question portant sur les transferts de stock
  if (q.includes('transfert') || q.includes('rééquilibrage') || q.includes('transit')) {
    const transferList = pendingTransfersSample.length > 0
      ? pendingTransfersSample.map(t => `- 🚚 **${t.num}** : ${t.itemsCount} article(s) de **${t.from}** ➔ **${t.to}** (Expédié le ${new Date(t.shippedAt || '').toLocaleDateString('fr-FR')})`).join('\n')
      : "✅ Aucun transfert de stock actuellement bloqué en transit.";

    return {
      replyText: `### 🔄 Gestion & Transferts de Stock Inter-Magasins\n\n` +
        `- **Transferts actuellement en cours d'acheminement :** ${kpis.pendingTransfersCount}\n\n` +
        `#### 🚚 Détail des transferts en transit :\n${transferList}\n\n` +
        `### 💡 Recommandations Logistiques Inter-Boutiques :\n` +
        `1. **Validation stricte à réception :** Exiger des gérants destinataires qu'ils effectuent le pointage contradictoire dès déchargement physique du colis.\n` +
        `2. **Dépannage d'urgence :** Si un produit phare est en rupture dans une librairie périphérique alors que le magasin central en détient plus de 10 unités, déclencher un bon de transfert immédiatement plutôt que d'attendre la livraison fournisseur.\n` +
        `3. **Déstockage croisé :** Réaffecter les stocks dormants vers les magasins à fort passage piéton.`,
      suggestedFollowUps: [
        "Quels sont les articles en rupture urgente ?",
        "Bilan comparatif de tous les magasins",
        "Contrôle des sessions de caisse"
      ]
    };
  }

  // Question portant sur les conseils stratégiques
  if (q.includes('conseil') || q.includes('recommandation') || q.includes('strategie') || q.includes('booster') || q.includes('ameliorer')) {
    return {
      replyText: `### 💡 Plan Stratégique & Conseils pour le Réseau de Magasins\n\n` +
        `Voici les 4 priorités directes recommandées pour piloter l'ensemble de vos points de vente :\n\n` +
        `1. **Dynamisation du Panier Moyen Réseau (${kpis.averageTicket.toLocaleString()} FCFA actuel) :**\n` +
        `   - Mettre en place des têtes de gondole et des articles d'impulsion au comptoir de chaque boutique.\n` +
        `   - Lancer une opération "pack rentrée / fournitures express" avec remise forfaitaire calculée.\n\n` +
        `2. **Contrôle Réseau & Bouclier Anti-Fraude :**\n` +
        `   - Écarts de caisse cumulés : **${kpis.totalCashDiscrepancies.toLocaleString()} FCFA** sur l'ensemble des sites.\n` +
        `   - Imposer la double signature du Z de caisse lors des clôtures journalières.\n\n` +
        `3. **Approvisionnement & Rééquilibrage Inter-Magasins :**\n` +
        `   - **${kpis.outOfStockCount}** articles en rupture totale dans le réseau.\n` +
        `   - Organiser des rotations de stock entre les librairies surstockées et celles en pénurie.\n\n` +
        `4. **Encadrement des Remises Exceptionnelles :**\n` +
        `   - Remises accordées : **${kpis.totalPosDiscounts.toLocaleString()} FCFA**. Bloquer toute remise supérieure à 10% sans code d'autorisation superviseur.`,
      suggestedFollowUps: [
        "📊 Comparatif de tous les magasins",
        "📦 Quels articles commander aux fournisseurs ?",
        "💰 Détail des écarts de caisse"
      ]
    };
  }

  // Question portant sur le bilan financier
  if (q.includes('bilan') || q.includes('chiffre') || q.includes('revenu') || q.includes('total') || q.includes('finance')) {
    return {
      replyText: `### 📊 Synthèse Financière Consolidée du Réseau\n\n` +
        `- **Périmètre :** ${posData.scope}\n` +
        `- **Chiffre d'affaires Global :** **${kpis.totalPosRevenue.toLocaleString()} FCFA** (${kpis.totalValidTransactions} ventes)\n` +
        `- **Panier moyen réseau :** **${kpis.averageTicket.toLocaleString()} FCFA**\n` +
        `- **Répartition des encaissements :**\n` +
        `  - 💵 Espèces : **${kpis.cashRevenue.toLocaleString()} FCFA**\n` +
        `  - 📱 Mobile Money : **${kpis.mobileRevenue.toLocaleString()} FCFA**\n` +
        `- **Total des remises accordées :** **${kpis.totalPosDiscounts.toLocaleString()} FCFA**\n` +
        `- **Valeur marchande du stock réseau :** **${kpis.totalStockSellingValue.toLocaleString()} FCFA** (Coût d'achat : **${kpis.totalStockPurchaseValue.toLocaleString()} FCFA**)\n` +
        `- **Marge brute théorique :** **${kpis.theoreticalProfitMargin.toLocaleString()} FCFA**\n\n` +
        `### 💡 Directives de la Direction :\n` +
        `- Accélérer l'adoption du paiement Mobile Money dans toutes les boutiques pour réduire le risque lié aux espèces.\n` +
        `- Suivre de près la rentabilité nette par boutique via le tableau de bord comparatif.`,
      suggestedFollowUps: [
        "📊 Classement des magasins par CA",
        "💡 Vos conseils pour augmenter les ventes",
        "Y a-t-il des écarts de caisse ?"
      ]
    };
  }

  // Question portant sur les stocks
  if (q.includes('stock') || q.includes('rupture') || q.includes('alerte') || q.includes('approvisionnement')) {
    const outList = outOfStockSample.length > 0
      ? outOfStockSample.map(p => `- ❌ **${p.name}** (Réf: ${p.ref || 'N/A'})`).join('\n')
      : "✅ Aucune rupture totale dans le réseau.";

    const lowList = lowStockSample.length > 0
      ? lowStockSample.map(p => `- ⚠️ **${p.name}** : **${p.stock}** restant(s) (Seuil min: ${p.min})`).join('\n')
      : "✅ Aucun stock sous le seuil critique.";

    return {
      replyText: `### 📦 État des Stocks du Réseau de Magasins\n\n` +
        `- **Articles au catalogue actif :** ${kpis.activeProductsCount}\n` +
        `- **Articles en rupture totale :** **${kpis.outOfStockCount}**\n` +
        `- **Articles en stock critique :** **${kpis.lowStockCount}**\n\n` +
        `#### ❌ Ruptures critiques prioritaires :\n${outList}\n\n` +
        `#### ⚠️ Alertes réapprovisionnement :\n${lowList}\n\n` +
        `### 💡 Conseils Logistiques :\n` +
        `- Vérifier si les magasins voisins disposent d'unités excédentaires pour opérer des transferts d'urgence.\n` +
        `- Grouper les commandes fournisseurs pour obtenir des tarifs de gros avantageux.`,
      suggestedFollowUps: [
        "🔄 Quels transferts de stock réaliser ?",
        "Quelle est la valeur marchande de notre stock ?",
        "Bilan comparatif des magasins"
      ]
    };
  }

  // Question sur les écarts et caisses
  if (q.includes('écart') || q.includes('caisse') || q.includes('clôture') || q.includes('session') || q.includes('manquant')) {
    const discList = sessionsWithDiscrepancy.length > 0
      ? sessionsWithDiscrepancy.map(s => {
          const diff = s.difference || 0;
          return `- **${s.magasin}** - ${s.cashier} (${new Date(s.sessionDate).toLocaleDateString('fr-FR')}) : **${diff < 0 ? '-' : '+'}${Math.abs(diff).toLocaleString()} FCFA**`;
        }).join('\n')
      : "✅ Aucun écart significatif enregistré sur les dernières sessions fermées.";

    return {
      replyText: `### 💰 Contrôle des Sessions de Caisse Multi-Magasins\n\n` +
        `- **Sessions clôturées analysées :** ${kpis.closedSessionsCount}\n` +
        `- **Cumul net des écarts de caisse réseau :** **${kpis.totalCashDiscrepancies.toLocaleString()} FCFA**\n\n` +
        `#### Détail des écarts récents par boutique :\n${discList}\n\n` +
        `### 💡 Plan de Sécurisation des Caisses :\n` +
        `- Exiger la mise en place d'un cahier d'écart signé par le caissier et le gérant du magasin.\n` +
        `- Bloquer la clôture en cas d'écart sans justification renseignée dans le système.`,
      suggestedFollowUps: [
        "📊 Comparatif des magasins",
        "Vérifier le bouclier anti-fraude",
        "💡 Comment former les caissiers ?"
      ]
    };
  }

  // Réponse générique
  return {
    replyText: `### 🏪 Point de Situation Réseau & Recommandations\n\n` +
      `- **Périmètre :** ${posData.scope}\n` +
      `- **Chiffre d'affaires POS :** **${kpis.totalPosRevenue.toLocaleString()} FCFA**\n` +
      `- **Magasins actifs :** ${storeSummaries.length}\n` +
      `- **Articles en rupture :** **${kpis.outOfStockCount}**\n` +
      `- **Écarts de caisse cumulés :** **${kpis.totalCashDiscrepancies.toLocaleString()} FCFA**\n\n` +
      `### 💡 Directive prioritaire de la Direction :\n` +
      `Consultez le comparatif de performance pour repérer les librairies motrices et transférer le stock disponible vers les points de vente en pénurie.`,
    suggestedFollowUps: [
      "📊 Comparatif de rentabilité de tous les magasins",
      "🔄 Quels transferts de stock recommandez-vous ?",
      "📦 Articles en rupture dans le réseau",
      "💰 Contrôle des écarts de caisse"
    ]
  };
}
