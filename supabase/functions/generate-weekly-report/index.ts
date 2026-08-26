// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { chatHistory, userName, period, userApiKey } = await req.json();

    if (!chatHistory) {
      throw new Error("Historique de conversation manquant.");
    }

    // @ts-ignore
    const apiKey = userApiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Clé API Gemini non configurée.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using a fast model

    const prompt = `
Tu es un assistant expert en rédaction de rapports d'activité professionnels.
Voici l'historique de la conversation avec le collaborateur "${userName}" pour la période du "${period}".

Historique de la conversation :
${chatHistory}

Instructions :
1. Analyser la conversation pour extraire toutes les activités réalisées.
2. Regrouper les tâches par pertinence et reformuler professionnellement.
3. Reformuler professionnellement.
4. Produire une synthèse.
5. Conserver fidèlement les informations.
6. Ne rien inventer. Ne pas ajouter de résultats qui n'ont pas été mentionnés.

Génère le rapport au format JSON structuré exactement selon ce schéma (pas de markdown, juste le JSON brut valide) :
{
  "introduction": "Résumé général de la semaine.",
  "activities": "Synthèse des différentes tâches effectuées du lundi au vendredi.",
  "achievements": "Les réalisations importantes identifiées dans les activités (format liste à puces en texte brut ou paragraphe).",
  "difficulties": "Uniquement les difficultés mentionnées par l'utilisateur (ou 'Aucune difficulté mentionnée').",
  "summary": "Bilan professionnel de la semaine.",
  "perspectives": "Les prochaines actions mentionnées par l'utilisateur (sans invention)."
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Nettoyer la réponse pour s'assurer qu'elle est bien du JSON (enlever les blocs markdown ```json si présents)
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reportData = JSON.parse(cleanedText);

    return new Response(
      JSON.stringify(reportData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
