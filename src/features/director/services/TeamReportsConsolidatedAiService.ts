import { getUserGeminiKey } from '../../../lib/geminiKey';
import type { V2WeeklyReport, User, Service } from '../../../context/AppContext';

export interface ConsolidatedSynthesisResult {
  weekStart: string;
  totalReportsCount: number;
  executiveSummary: string;
  majorAchievements: string[];
  criticalRoadblocks: string[];
  strategicObjectives: string[];
  departmentBreakdown: { department: string; summary: string; alertLevel: 'low' | 'medium' | 'high' }[];
}

/**
 * Génère une synthèse consolidée des rapports d'activité hebdomadaires de l'équipe pour la Direction
 */
export async function generateTeamExecutiveBriefing(params: {
  reports: V2WeeklyReport[];
  users: User[];
  services: Service[];
  weekStart: string;
  userId?: string;
}): Promise<ConsolidatedSynthesisResult> {
  const { reports, users, services, weekStart, userId } = params;

  if (reports.length === 0) {
    return {
      weekStart,
      totalReportsCount: 0,
      executiveSummary: "Aucun rapport d'activité n'a été soumis par l'équipe pour cette semaine.",
      majorAchievements: [],
      criticalRoadblocks: [],
      strategicObjectives: [],
      departmentBreakdown: []
    };
  }

  // Formatage des rapports pour le prompt
  let formattedData = `SEMAINE DU : ${weekStart}\nNOMBRE DE RAPPORTS SOUMIS : ${reports.length}\n\n`;

  reports.forEach((r, idx) => {
    const author = users.find(u => u.id === r.authorId);
    const srv = services.find(s => s.id === author?.serviceId)?.name || 'Général';
    formattedData += `--- RAPPORT #${idx + 1} : ${author?.name || 'Collaborateur'} (${author?.role || 'Agent'} - Dép: ${srv}) ---\n`;
    formattedData += `Objectifs : ${r.weeklyObjectives || 'Non spécifiés'}\n`;
    formattedData += `Réalisations / Succès : ${r.achievements || r.summary || 'R.A.S'}\n`;
    formattedData += `Difficultés / Blocages : ${r.difficulties || 'Aucun blocage signalé'}\n`;
    formattedData += `Objectifs N+1 : ${r.nextWeekObjectives || 'Non renseignés'}\n\n`;
  });

  const prompt = `
Tu es le Conseiller Exécutif auprès du Directeur Général de HINOV GROUP.
Voici les comptes-rendus d'activité hebdomadaires de l'ensemble des collaborateurs et équipes pour la semaine du "${weekStart}" :

${formattedData}

MISSION :
Rédige un Briefing Exécutif clair, concis et structuré pour la Direction Générale.

Génère UNIQUEMENT un objet JSON valide (sans formatage markdown) avec cette structure :
{
  "executiveSummary": "Synthèse exécutive globale en 3 à 4 phrases valorisantes sur l'état d'avancement général.",
  "majorAchievements": [
    "Victoire ou réalisation concrète majeure 1",
    "Victoire ou réalisation concrète majeure 2",
    "Victoire ou réalisation concrète majeure 3"
  ],
  "criticalRoadblocks": [
    "Point de friction ou difficulté nécessitant l'arbitrage ou l'intervention du Directeur",
    "Autre blocage opérationnel ou commercial"
  ],
  "strategicObjectives": [
    "Priorité stratégique numéro 1 pour la semaine prochaine",
    "Priorité stratégique numéro 2",
    "Priorité stratégique numéro 3"
  ],
  "departmentBreakdown": [
    {
      "department": "Nom du pôle ou département",
      "summary": "Résumé de l'activité du pôle en 1 phrase",
      "alertLevel": "low"
    }
  ]
}
`;

  const userApiKey = getUserGeminiKey(userId);

  if (userApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(userApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);

          return {
            weekStart,
            totalReportsCount: reports.length,
            executiveSummary: parsed.executiveSummary || "Synthèse consolidée des activités de l'équipe.",
            majorAchievements: Array.isArray(parsed.majorAchievements) ? parsed.majorAchievements : [],
            criticalRoadblocks: Array.isArray(parsed.criticalRoadblocks) ? parsed.criticalRoadblocks : [],
            strategicObjectives: Array.isArray(parsed.strategicObjectives) ? parsed.strategicObjectives : [],
            departmentBreakdown: Array.isArray(parsed.departmentBreakdown) ? parsed.departmentBreakdown : []
          };
        }
      }
    } catch (err) {
      console.warn('Erreur génération synthèse exécutive Gemini:', err);
    }
  }

  // Fallback local
  return {
    weekStart,
    totalReportsCount: reports.length,
    executiveSummary: `${reports.length} rapport(s) d'activité soumis pour la semaine du ${weekStart}. Les activités commerciales et opérationnelles ont été enregistrées.`,
    majorAchievements: reports.map(r => r.achievements || r.summary || '').filter(Boolean).slice(0, 4),
    criticalRoadblocks: reports.map(r => r.difficulties || '').filter(d => d && !d.toLowerCase().includes('aucun')).slice(0, 3),
    strategicObjectives: reports.map(r => r.nextWeekObjectives || '').filter(Boolean).slice(0, 3),
    departmentBreakdown: []
  };
}
