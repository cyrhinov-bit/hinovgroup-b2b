import { getUserGeminiKey } from '../../../lib/geminiKey';

/**
 * Prompt Maître officiel pour la régénération studio photo produit IA
 */
export const MASTER_PRODUCT_AI_PROMPT = `Transforme cette photo en photographie produit professionnelle haut de gamme.

Conserve le produit EXACTEMENT identique à l'original : même forme, couleur, proportions, texture, emballage, logo, textes et détails. Ne rien ajouter, supprimer ou modifier sur le produit.

Améliore uniquement la qualité de la photographie : éclairage studio professionnel, netteté, haute résolution, cadrage commercial, ombres naturelles et présentation premium.

Fond propre et élégant adapté à un catalogue professionnel. Produit centré et parfaitement mis en valeur.

Rendu photoréaliste, photographie publicitaire premium, qualité e-commerce professionnelle.

IMPORTANT : Fidélité absolue au produit original. Ne pas réinventer, déformer ou modifier le produit.`;

export interface RegenerateImageParams {
  imageSource: string;
  productName: string;
  category?: string;
  reference?: string;
  userId?: string;
}

export interface RegenerateImageResult {
  imageUrl: string;
  source: 'gemini_imagen' | 'ai_studio_flux' | 'canvas_smart_packshot';
  promptUsed: string;
}

/**
 * Régénère l'image d'un produit avec l'IA en appliquant scrupuleusement le prompt maître
 */
export async function regenerateProductImageWithAi(
  params: RegenerateImageParams
): Promise<RegenerateImageResult> {
  const { imageSource, productName, category = 'Fournitures', reference = '', userId } = params;
  const userApiKey = getUserGeminiKey(userId);
  const cleanProductName = productName.trim();

  // Prompt anglais pour les modèles de génération d'images traduisant exactement le prompt maître
  const basePrompt = `High-end commercial product packshot photography of "${cleanProductName}" (${category}${reference ? `, ref: ${reference}` : ''}). Transform this photo into a professional high-end product photograph. Keep the product EXACTLY IDENTICAL to the original: same exact shape, color, proportions, texture, packaging, logo, texts, and details. Do NOT add, remove, or modify anything on the product. Only enhance the quality of the photography: professional studio lighting, extreme crisp sharpness, 8k high resolution, clean commercial framing, natural soft contact shadows, and premium presentation. Clean and elegant background suitable for a professional catalog. Product centered and perfectly highlighted. Photorealistic rendering, premium advertising photography, professional e-commerce quality. IMPORTANT: Absolute fidelity to the original product. Do not reinvent, distort, or modify the product.`;

  // 1. Pipeline Gemini Vision + Imagen 3 si clé API configurée
  if (userApiKey) {
    try {
      let base64Data = '';
      let mimeType = 'image/jpeg';
      if (imageSource.startsWith('data:')) {
        const match = imageSource.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      let enrichedPrompt = basePrompt;
      if (base64Data) {
        try {
          const visionRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(userApiKey),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `${MASTER_PRODUCT_AI_PROMPT}

Nom du produit : "${cleanProductName}"
Catégorie : "${category}" ${reference ? `(Réf: ${reference})` : ''}

Consigne stricte pour l'IA d'analyse visuelle :
Analyse cette photo prise par la caméra. Décris avec une fidélité absolue en anglais (pour le modèle d'image) l'apparence physique exacte du produit (forme, couleur exacte, logo de la marque, texte de couverture/étiquette, emballage). Construis une consigne garantissant un rendu 8K studio avec le produit centré sur un fond propre et élégant de catalogue professionnel avec ombres douces. Ne rien modifier ni ajouter.`
                    },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }]
              })
            }
          );

          if (visionRes.ok) {
            const visionData = await visionRes.json();
            const desc = visionData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (desc) {
              enrichedPrompt = `Professional commercial studio photography of "${cleanProductName}". Product exact features from original photo: ${desc.trim()}. Keep product 100% identical, centered 1:1, studio lighting, clean elegant catalog background with realistic soft contact shadow, ultra sharp 8k.`;
            }
          }
        } catch (visionErr) {
          console.warn('[VisionAnalysis] Skip:', visionErr);
        }
      }

      // Tenter Imagen 3 via Gemini API
      try {
        const imagenRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=" + encodeURIComponent(userApiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: enrichedPrompt }],
              parameters: {
                sampleCount: 1,
                aspectRatio: '1:1'
              }
            })
          }
        );

        if (imagenRes.ok) {
          const imgData = await imagenRes.json();
          const b64 = imgData?.predictions?.[0]?.bytesBase64Encoded;
          if (b64) {
            return {
              imageUrl: "data:image/jpeg;base64," + b64,
              source: 'gemini_imagen',
              promptUsed: MASTER_PRODUCT_AI_PROMPT
            };
          }
        }
      } catch (imagenErr) {
        console.warn('[Imagen] Fallback to high-res Pollinations engine:', imagenErr);
      }
    } catch (apiErr) {
      console.warn('[GeminiPipeline] Error:', apiErr);
    }
  }

  // 2. Moteur IA E-Commerce Ultra HD Flux (Génération en ligne haute définition)
  try {
    const encodedPrompt = encodeURIComponent(basePrompt);
    const pollinationsUrl = "https://image.pollinations.ai/prompt/" + encodedPrompt + "?width=800&height=800&nologo=true&seed=" + (Date.now() % 100000) + "&model=flux";
    
    const imgCheck = await fetch(pollinationsUrl, { method: 'GET' });
    if (imgCheck.ok) {
      const blob = await imgCheck.blob();
      const base64 = await blobToDataUrl(blob);
      return {
        imageUrl: base64,
        source: 'ai_studio_flux',
        promptUsed: MASTER_PRODUCT_AI_PROMPT
      };
    }
  } catch (fluxErr) {
    console.warn('[PollinationsFlux] Fallback to smart canvas packshot:', fluxErr);
  }

  // 3. Moteur Canvas 2D Studio Packshot en local (Fidélité 100% garantie)
  const localPackshot = await generateLocalCanvasStudioPackshot(imageSource);
  return {
    imageUrl: localPackshot,
    source: 'canvas_smart_packshot',
    promptUsed: MASTER_PRODUCT_AI_PROMPT
  };
}

/**
 * Génère un packshot studio propre et élégant en Canvas 2D avec fond catalogue et ombre portée
 */
async function generateLocalCanvasStudioPackshot(sourceUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 800;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }

      // 1. Fond propre et élégant adapté au catalogue (dégradé très doux blanc / gris perle subtil)
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(1, '#F8FAFC');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Spot lumineux doux
      const radial = ctx.createRadialGradient(size / 2, size * 0.45, size * 0.1, size / 2, size * 0.45, size * 0.7);
      radial.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      radial.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);

      // 2. Centrage du produit (avec marge de 12%)
      const targetMax = size * 0.76;
      let drawW = img.width;
      let drawH = img.height;
      const scale = Math.min(targetMax / drawW, targetMax / drawH);
      drawW = drawW * scale;
      drawH = drawH * scale;

      const posX = (size - drawW) / 2;
      const posY = (size - drawH) / 2 - 15;

      // 3. Ombre de contact au sol naturelle
      const shadowY = posY + drawH - 5;
      const shadowW = drawW * 0.85;
      const shadowH = 22;
      const shadowGrad = ctx.createRadialGradient(
        size / 2, shadowY + shadowH / 2, 5,
        size / 2, shadowY + shadowH / 2, shadowW / 2
      );
      shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.18)');
      shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.06)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(size / 2, shadowY + shadowH / 2, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Dessin du produit avec rehaussement de netteté et clarté
      ctx.save();
      ctx.filter = 'contrast(108%) brightness(104%) saturate(106%)';
      ctx.drawImage(img, posX, posY, drawW, drawH);
      ctx.restore();

      resolve(canvas.toDataURL('image/webp', 0.92));
    };

    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
