import { getUserGeminiKey } from '../../../lib/geminiKey';
import type { PosProduct, PosTransaction, PosCashSession, PosReturn, User } from '../../../context/AppContext';
import type { PosMagasin, PosStockTransfer } from '../../../types/posMagasins';
import { DEFAULT_MAGASIN } from '../../pos/services/PosMagasinService';

export type AnomalyType =
  | 'CASH_DISCREPANCY'
  | 'LOSS_SALE'
  | 'HIGH_DISCOUNT'
  | 'VOIDED_TX'
  | 'UNJUSTIFIED_RETURN'
  | 'STOCK_VARIANCE'
  | 'INTER_STORE_STOCK_IMBALANCE'
  | 'STORE_CASH_LEAK_DISPROPORTION'
  | 'SUSPICIOUS_TRANSFER_PENDING';

export interface AuditAnomaly {
  id: string;
  type: AnomalyType;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  amount?: number;
  date: string;
  responsibleName?: string;
  reference?: string;
  recommendedAction: string;
  magasinId?: string;
  magasinNom?: string;
}

export interface StoreAuditMetric {
  magasinId: string;
  magasinNom: string;
  healthScore: number;
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITIQUE';
  totalRevenue: number;
  totalTransactions: number;
  totalCashDiscrepancy: number;
  totalLossRisk: number;
  totalHighDiscounts: number;
  anomalyCount: number;
  criticalCount: number;
  warningCount: number;
}

export interface AuditReportResult {
  healthScore: number; // 0 à 100 (consolidé réseau ou spécifique magasin)
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITIQUE';
  summary: string;
  totalRevenue: number;
  totalLossRisk: number;
  totalCashDiscrepancy: number;
  totalHighDiscounts: number;
  anomalies: AuditAnomaly[];
  storeMetrics: StoreAuditMetric[];
  selectedMagasinId?: string; // 'ALL' ou id spécifique
  selectedMagasinNom?: string;
  aiAnalysisText?: string;
}

/**
 * Analyse l'ensemble des données POS pour détecter les anomalies financières,
 * les fraudes potentielles et les déséquilibres multi-magasins.
 */
export function runFinancialAudit(params: {
  posTransactions: PosTransaction[];
  posCashSessions: PosCashSession[];
  posProducts: PosProduct[];
  posReturns?: PosReturn[];
  users: User[];
  posMagasins?: PosMagasin[];
  stockTransfers?: PosStockTransfer[];
  selectedMagasinId?: string;
}): AuditReportResult {
  const {
    posTransactions,
    posCashSessions,
    posProducts,
    users,
    posMagasins = [DEFAULT_MAGASIN],
    stockTransfers = [],
    selectedMagasinId = 'ALL'
  } = params;

  const anomalies: AuditAnomaly[] = [];

  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Caissier / Collaborateur inconnu';

  const getMagasinName = (magId?: string) => {
    if (!magId) return DEFAULT_MAGASIN.nom;
    const found = posMagasins.find(m => m.id === magId);
    return found ? found.nom : DEFAULT_MAGASIN.nom;
  };

  const resolveMagasinId = (itemMagId?: string, sessionMagId?: string) => {
    return itemMagId || sessionMagId || DEFAULT_MAGASIN.id;
  };

  // 1. Audit des Sessions de Caisse (Écarts de caisse par magasin)
  posCashSessions.forEach(session => {
    if (session.status === 'Fermée' && typeof session.difference === 'number' && Math.abs(session.difference) > 0) {
      const diff = session.difference;
      const isNegative = diff < 0;
      const magId = resolveMagasinId(session.magasinId);
      const magNom = getMagasinName(magId);

      anomalies.push({
        id: `cash-${session.id}`,
        type: 'CASH_DISCREPANCY',
        severity: Math.abs(diff) >= 5000 ? 'CRITICAL' : 'WARNING',
        title: isNegative ? `Manquant de caisse : -${Math.abs(diff).toLocaleString()} FCFA` : `Surplus inexpliqué : +${diff.toLocaleString()} FCFA`,
        description: `Session fermée le ${new Date(session.closedAt || session.openedAt).toLocaleDateString('fr-FR')} par ${getUserName(session.cashierId)} [${magNom}]. Montant théorique : ${(session.expectedAmount || 0).toLocaleString()} FCFA, compté : ${(session.finalAmount || 0).toLocaleString()} FCFA.`,
        amount: Math.abs(diff),
        date: session.closedAt || session.openedAt,
        responsibleName: getUserName(session.cashierId),
        reference: `Session #${session.id.slice(0, 8)}`,
        magasinId: magId,
        magasinNom: magNom,
        recommendedAction: isNegative
          ? `Exiger une justification écrite du caissier à ${magNom} et contrôler les tickets d'annulation du jour.`
          : `Enregistrer le surplus en compte de régularisation à ${magNom} et vérifier les encaissements non saisis.`
      });
    }
  });

  // 2. Audit des Transactions POS (Ventes à perte & Remises anormales par magasin)
  posTransactions.forEach(tx => {
    // Si la session associée a un magasinId, l'utiliser si tx n'en a pas
    const associatedSession = tx.sessionId ? posCashSessions.find(s => s.id === tx.sessionId) : undefined;
    const magId = resolveMagasinId(tx.magasinId, associatedSession?.magasinId);
    const magNom = getMagasinName(magId);

    // Détection remises excessives (> 20% ou remise > 15 000 FCFA)
    if (tx.discountAmount > 0 && tx.subtotal > 0) {
      const discountRate = (tx.discountAmount / tx.subtotal) * 100;
      if (discountRate >= 20 || tx.discountAmount >= 15000) {
        anomalies.push({
          id: `disc-${tx.id}`,
          type: 'HIGH_DISCOUNT',
          severity: discountRate >= 35 ? 'CRITICAL' : 'WARNING',
          title: `Remise exceptionnelle de ${discountRate.toFixed(1)}% (${tx.discountAmount.toLocaleString()} FCFA)`,
          description: `Transaction ${tx.transactionNumber} effectuée à [${magNom}] par ${getUserName(tx.cashierId)}. Total payé : ${tx.total.toLocaleString()} FCFA (Sous-total : ${tx.subtotal.toLocaleString()} FCFA).`,
          amount: tx.discountAmount,
          date: tx.date,
          responsibleName: getUserName(tx.cashierId),
          reference: tx.transactionNumber,
          magasinId: magId,
          magasinNom: magNom,
          recommendedAction: `Vérifier si cette remise exceptionnelle accordée à ${magNom} a fait l'objet d'une validation préalable de la Direction.`
        });
      }
    }

    // Détection des ventes à perte par ligne d'article
    (tx.lines || []).forEach(line => {
      const prod = posProducts.find(p => p.id === line.productId);
      if (prod && prod.purchasePrice > 0) {
        const netLineUnitPrice = line.quantity > 0 ? line.total / line.quantity : line.unitPrice;
        if (netLineUnitPrice < prod.purchasePrice) {
          const lossPerUnit = prod.purchasePrice - netLineUnitPrice;
          const totalLineLoss = lossPerUnit * line.quantity;

          anomalies.push({
            id: `loss-${tx.id}-${line.id}`,
            type: 'LOSS_SALE',
            severity: 'CRITICAL',
            title: `Vente à perte détectée : ${line.description}`,
            description: `Article vendu à ${Math.round(netLineUnitPrice).toLocaleString()} FCFA / unité à [${magNom}] alors que le coût d'achat fournisseur est de ${prod.purchasePrice.toLocaleString()} FCFA. Perte nette : -${Math.round(totalLineLoss).toLocaleString()} FCFA.`,
            amount: totalLineLoss,
            date: tx.date,
            responsibleName: getUserName(tx.cashierId),
            reference: tx.transactionNumber,
            magasinId: magId,
            magasinNom: magNom,
            recommendedAction: `Alerter le responsable de ${magNom} et verrouiller immédiatement les seuils de prix de vente sur cet article.`
          });
        }
      }
    });

    // Détection des transactions annulées
    if (tx.status === 'Annulée') {
      anomalies.push({
        id: `void-${tx.id}`,
        type: 'VOIDED_TX',
        severity: 'WARNING',
        title: `Ticket annulé : ${tx.transactionNumber} (${tx.total.toLocaleString()} FCFA)`,
        description: `Vente annulée enregistrée à [${magNom}] par ${getUserName(tx.cashierId)} pour un montant de ${tx.total.toLocaleString()} FCFA.`,
        amount: tx.total,
        date: tx.date,
        responsibleName: getUserName(tx.cashierId),
        reference: tx.transactionNumber,
        magasinId: magId,
        magasinNom: magNom,
        recommendedAction: `Vérifier la concordance physique entre les articles remis en rayon à ${magNom} et le ticket annulé.`
      });
    }
  });

  // 3. Audit Inter-Magasins : Transferts de stock en souffrance
  stockTransfers.forEach(transfer => {
    if (transfer.status === 'Expédié' && transfer.shippedAt) {
      const elapsedDays = Math.floor((Date.now() - new Date(transfer.shippedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (elapsedDays >= 3) {
        const sourceNom = getMagasinName(transfer.magasinSourceId);
        const destNom = getMagasinName(transfer.magasinDestId);
        const totalUnits = (transfer.lines || []).reduce((s, l) => s + (l.quantity || 0), 0);

        anomalies.push({
          id: `transfer-${transfer.id}`,
          type: 'SUSPICIOUS_TRANSFER_PENDING',
          severity: elapsedDays >= 7 ? 'CRITICAL' : 'WARNING',
          title: `Transfert en transit prolongé (${elapsedDays} jours) : ${transfer.transferNumber}`,
          description: `Transfert de ${totalUnits} unité(s) expédié depuis le ${new Date(transfer.shippedAt).toLocaleDateString('fr-FR')} de [${sourceNom}] vers [${destNom}] toujours non réceptionné. Risque d'égarement ou de fuite en transit.`,
          amount: 0,
          date: transfer.shippedAt,
          responsibleName: transfer.shippedBy ? getUserName(transfer.shippedBy) : 'Magasinier expéditeur',
          reference: transfer.transferNumber,
          magasinId: transfer.magasinDestId,
          magasinNom: destNom,
          recommendedAction: `Contacter le responsable de ${destNom} pour exiger la validation immédiate de la réception physique des articles.`
        });
      }
    }
  });

  // 4. Audit Multi-Magasins : Concentration disproportionnée des écarts de caisse
  const totalNetworkDiscrepancy = anomalies
    .filter(a => a.type === 'CASH_DISCREPANCY')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  if (totalNetworkDiscrepancy >= 5000 && posMagasins.length > 1) {
    const discrepancyByMag = new Map<string, number>();
    anomalies
      .filter(a => a.type === 'CASH_DISCREPANCY')
      .forEach(a => {
        const mid = a.magasinId || DEFAULT_MAGASIN.id;
        discrepancyByMag.set(mid, (discrepancyByMag.get(mid) || 0) + (a.amount || 0));
      });

    for (const [mid, magDisc] of discrepancyByMag.entries()) {
      const ratio = magDisc / totalNetworkDiscrepancy;
      if (ratio >= 0.60 && magDisc >= 5000) {
        const magNom = getMagasinName(mid);
        anomalies.push({
          id: `leak-disproportion-${mid}`,
          type: 'STORE_CASH_LEAK_DISPROPORTION',
          severity: 'CRITICAL',
          title: `Concentration critique des écarts à ${magNom} (${Math.round(ratio * 100)}% du réseau)`,
          description: `Le magasin ${magNom} concentre à lui seul ${magDisc.toLocaleString()} FCFA sur les ${totalNetworkDiscrepancy.toLocaleString()} FCFA d'écarts de caisse cumulés de tout le réseau.`,
          amount: magDisc,
          date: new Date().toISOString(),
          reference: `Audit Réseau ${new Date().toLocaleDateString('fr-FR')}`,
          magasinId: mid,
          magasinNom: magNom,
          recommendedAction: `Diligentier un contrôle inopiné de caisse sur place à ${magNom} et réaliser un recomptage contradictoire quotidien.`
        });
      }
    }
  }

  // 5. Calcul des Métriques Détaillées par Magasin (StoreAuditMetric)
  const storeMetrics: StoreAuditMetric[] = posMagasins.map(mag => {
    const magTxs = posTransactions.filter(tx => {
      const s = tx.sessionId ? posCashSessions.find(cs => cs.id === tx.sessionId) : undefined;
      return resolveMagasinId(tx.magasinId, s?.magasinId) === mag.id;
    });

    const magValidTxs = magTxs.filter(t => t.status === 'Validée');
    const totalRevenue = magValidTxs.reduce((sum, t) => sum + (t.total || 0), 0);

    const magAnomalies = anomalies.filter(a => a.magasinId === mag.id);
    const criticalCount = magAnomalies.filter(a => a.severity === 'CRITICAL').length;
    const warningCount = magAnomalies.filter(a => a.severity === 'WARNING').length;

    const magCashDiscrepancy = magAnomalies
      .filter(a => a.type === 'CASH_DISCREPANCY')
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const magLossRisk = magAnomalies
      .filter(a => a.type === 'LOSS_SALE')
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const magHighDiscounts = magAnomalies
      .filter(a => a.type === 'HIGH_DISCOUNT')
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    let penalty = criticalCount * 15 + warningCount * 6;
    const healthScore = Math.max(20, Math.min(100, Math.round(100 - penalty)));
    let status: 'OPTIMAL' | 'ATTENTION' | 'CRITIQUE' = 'OPTIMAL';
    if (healthScore < 60) status = 'CRITIQUE';
    else if (healthScore < 85) status = 'ATTENTION';

    return {
      magasinId: mag.id,
      magasinNom: mag.nom,
      healthScore,
      status,
      totalRevenue,
      totalTransactions: magValidTxs.length,
      totalCashDiscrepancy: magCashDiscrepancy,
      totalLossRisk: magLossRisk,
      totalHighDiscounts: magHighDiscounts,
      anomalyCount: magAnomalies.length,
      criticalCount,
      warningCount
    };
  });

  // Filtrage selon le magasin sélectionné si demandé
  const isFilteringSpecificStore = selectedMagasinId && selectedMagasinId !== 'ALL';
  const effectiveAnomalies = isFilteringSpecificStore
    ? anomalies.filter(a => a.magasinId === selectedMagasinId)
    : anomalies;

  const totalCashDiscrepancy = effectiveAnomalies
    .filter(a => a.type === 'CASH_DISCREPANCY')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  const totalLossRisk = effectiveAnomalies
    .filter(a => a.type === 'LOSS_SALE')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  const totalHighDiscounts = effectiveAnomalies
    .filter(a => a.type === 'HIGH_DISCOUNT')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  const relevantTxs = isFilteringSpecificStore
    ? posTransactions.filter(tx => {
        const s = tx.sessionId ? posCashSessions.find(cs => cs.id === tx.sessionId) : undefined;
        return resolveMagasinId(tx.magasinId, s?.magasinId) === selectedMagasinId && tx.status === 'Validée';
      })
    : posTransactions.filter(tx => tx.status === 'Validée');

  const totalRevenue = relevantTxs.reduce((sum, t) => sum + (t.total || 0), 0);

  // Score de santé consolidé ou du magasin sélectionné
  let penalty = 0;
  effectiveAnomalies.forEach(a => {
    if (a.severity === 'CRITICAL') penalty += 15;
    else if (a.severity === 'WARNING') penalty += 6;
    else penalty += 2;
  });

  const healthScore = Math.max(20, Math.min(100, Math.round(100 - penalty)));
  let status: 'OPTIMAL' | 'ATTENTION' | 'CRITIQUE' = 'OPTIMAL';
  if (healthScore < 60) status = 'CRITIQUE';
  else if (healthScore < 85) status = 'ATTENTION';

  const criticalCount = effectiveAnomalies.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = effectiveAnomalies.filter(a => a.severity === 'WARNING').length;

  const currentStoreNom = isFilteringSpecificStore ? getMagasinName(selectedMagasinId) : 'Réseau Consolidé (Tous magasins)';

  let summary = `[${currentStoreNom}] Score de conformité de ${healthScore}/100. `;
  if (effectiveAnomalies.length === 0) {
    summary += "Aucune anomalie financière ou opérationnelle détectée. Les flux de caisse, marges et transferts sont parfaitement conformes.";
  } else {
    summary += `${effectiveAnomalies.length} point(s) d'attention relevé(s) (${criticalCount} critique(s), ${warningCount} avertissement(s)). Écarts cumulés : ${totalCashDiscrepancy.toLocaleString()} FCFA.`;
  }

  return {
    healthScore,
    status,
    summary,
    totalRevenue,
    totalLossRisk,
    totalCashDiscrepancy,
    totalHighDiscounts,
    anomalies: effectiveAnomalies.sort((a, b) => (a.severity === 'CRITICAL' ? -1 : 1)),
    storeMetrics,
    selectedMagasinId,
    selectedMagasinNom: currentStoreNom
  };
}

/**
 * Génère une analyse narrative approfondie par Gemini pour la Direction
 * prenant en compte l'ensemble des magasins du réseau.
 */
export async function generateAiAuditDiagnostic(
  audit: AuditReportResult,
  userId?: string
): Promise<string> {
  const userApiKey = getUserGeminiKey(userId);
  if (!userApiKey) {
    return audit.summary;
  }

  const multiStoreSummary = audit.storeMetrics.map(m =>
    `- **${m.magasinNom}** : Score ${m.healthScore}/100 (${m.status}), CA : ${m.totalRevenue.toLocaleString()} FCFA, Écarts : ${m.totalCashDiscrepancy.toLocaleString()} FCFA, Anomalies : ${m.anomalyCount}`
  ).join('\n');

  const prompt = `
Tu es l'Auditeur Financier et Conseiller de Gestion Senior en Chef du Réseau de Magasins & Librairies de HINOV GROUP.
Voici les résultats de l'audit automatique multi-magasins des caisses, stocks, remises et marges :

PÉRIMÈTRE AUDITÉ : ${audit.selectedMagasinNom || 'Tous les magasins (Consolidé)'}
Score global de santé financière : ${audit.healthScore}/100 (${audit.status})
Chiffre d'affaires audité : ${audit.totalRevenue.toLocaleString()} FCFA
Écarts de caisse cumulés : ${audit.totalCashDiscrepancy.toLocaleString()} FCFA
Pertes potentielles sur ventes à perte : ${audit.totalLossRisk.toLocaleString()} FCFA
Total des remises exceptionnelles : ${audit.totalHighDiscounts.toLocaleString()} FCFA

ÉTAT COMPARATIF DES MAGASINS DU RÉSEAU :
${multiStoreSummary}

Liste des anomalies constatées (échantillon prioritaire) :
${JSON.stringify(audit.anomalies.slice(0, 15), null, 2)}

INSTRUCTIONS DE RÉDACTION :
1. Rédige un diagnostic d'audit exécutif percutant, chiffré et direct pour le Directeur Général.
2. Évalue clairement le niveau de risque financier, les disparités de performance entre magasins et les fuites de trésorerie.
3. Compare explicitement les librairies/magasins (qui est vertueux vs qui présente des risques de caisse ou de stock).
4. INCLURE OBLIGATOIREMENT : "### 💡 Recommandations & Plan d'Action pour la Direction" avec 4 à 5 directives précises :
   - Mesures correctives par magasin (contrôle de caisse ciblé, recomptage contradictoire).
   - Recommandations sur les transferts de stock et les rééquilibrages inter-magasins.
   - Plafonnement strict des remises en caisse et verrouillage des prix de vente.
   - Entretiens de recadrage avec le personnel concerné.
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(userApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
  } catch (err) {
    console.warn('Erreur Gemini Diagnostic Audit Multi-Magasins:', err);
  }

  return audit.summary;
}
