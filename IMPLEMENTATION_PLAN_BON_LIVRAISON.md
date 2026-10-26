# Module Bon de Livraison - Plan d'Implementation

## Overview
Création d'un module "Bon de Livraison" qui génère un PDF à partir d'un devis existant. Le bon de livraison est une version simplifiée du devis, axée sur les informations de livraison plutôt que sur les conditions de paiement.

## Architecture existante à réutiliser

### 1. Génération PDF existante (`src/lib/pdfUtils.ts`)
- `generateQuotePdf(quote, client, settings, prestations)` - Génère le PDF du devis actuel
- `ensureDevisPdfAssets()` - Précharge les assets (bannière, cachet)
- Styles HINOV modernes avec en-tête navy, badges, tableaux à 6 colonnes
- Signature et cachet en bas de page

### 2. Types de données (`src/context/AppContext.tsx` et `src/shared/types/index.ts`)
- `Quote` interface avec `lines: SharedQuoteLine[]`
- `SharedQuoteLine` : id, prestationId, description, quantity, unitPrice, total, discountPercent
- `Client` : id, name, email, phone, company, address
- `AppSettings` : companyName, companyAddress, companyPhone, companyEmail, companySiret, bankIban, defaultValidity

### 3. Composants de page
- `src/pages/Devis.tsx` - Page de gestion des devis
- `src/pages/QuoteCreation.tsx` - Création de devis
- `src/pages/QuotePreview.tsx` - Aperçu (si existe)

## Plan d'implementation

### Étape 1: Créer le composant BonLivraison

**Fichier :** `src/pages/BonLivraison.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateBonLivraisonPdf, downloadBlob } from '../lib/pdfUtils';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../components/ReportPdfPreview';

type BonLivraisonProps = {
  quoteId?: string;
};

export function BonLivraison({ quoteId }: BonLivraisonProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { quotes, clients, settings, prestations } = useAppContext();
  
  // Trouver le devis sélectionné
  const quote = quoteId ? quotes.find(q => q.id === quoteId) : null;
  const client = quote ? clients.find(c => c.id === quote.clientId) : null;
  
  // ... composant UI
}
```

### Étape 2: Créer la fonction de génération PDF `generateBonLivraisonPdf`

**Fichier :** `src/lib/pdfUtils.ts`

Le bon de livraison aura un design différent du devis :
- En-tête avec "BON DE LIVRAISON" au lieu de "DEVIS"
- Moins d'informations sur la TVA et les conditions de paiement
- Focus sur : références articles, quantités, descriptions
- Coordonnées client + entreprise
- Tableau des articles à livrer
- Signature en bas

**Différences clés avec generateQuotePdf :**
| Élément | Devis | Bon de Livraison |
|---------|-------|------------------|
| Titre | "DEVIS" | "BON DE LIVRAISON" |
| Validité | "Valable jusqu'au..." | Optionnel ou "À compter du..." |
| TVA | Affichée (18%) | Peut être omise ou simplifiée |
| Conditions règlement | Affichées | Généralement omises |
| Signature | Oui | Oui (simplifiée) |
| Design | Couleur navy/vert | Peut être allégé |

### Étape 3: Créer la page de route

**Fichier :** `src/pages/BonLivraison.tsx` (routeur)
```tsx
// Dans App.tsx
import { BonLivraison } from './pages/BonLivraison';

// Route
<Route path="bon-livraison" element={<BonLivraison />} />
// Ou avec ID de devis
<Route path="bon-livraison/:quoteId" element={<BonLivraison />} />
```

### Étape 4: Interface utilisateur

**Flux :**
1. Depuis la page Devis, bouton "Bon de Livraison"
2. Ou directement : `/bon-livraison?quoteId=xxxxx`
3. Aperçu PDF avant téléchargement
4. Options : Télécharger, Imprimer, Envoyer par email

**Composant UI :**
- En-tête "BON DE LIVRAISON N° {quoteNumber}"
- Infos client : Nom, adresse, contact
- Tableau des lignes :
  - Référence/Code
  - Désignation
  - Quantité
  - Unité
  - Prix unitaire
  - Montant
- Infos en bas : Adresse livraison, remarques, conditions

### Étape 5: Options d'export

1. **Télécharger PDF** - Fichier bon_livraison_{quoteNumber}.pdf
2. **Imprimer** - Ouvre l'aperçu en mode imprimante
3. **Envoyer par email** - Ouvre la messagerie avec PDF joint (optionnel, réutiliser sendQuoteByMail)

### Étape 6: RLS et permissions

- Directeur, Responsable, Commercial peuvent générer
- Vérifier les mêmes permissions que pour les devis
- S'assurer que seules les lignes du devis associé sont visibles

## Exemple de design Bon de Livraison

```
┌─────────────────────────────────────────────────────────────┐
│           BON DE LIVRAISON N° DV-2026-0015                │
├─────────────────────────────────────────────────────────────┤
│ Société HINOV GROUP                                       │
│ Siège: Yopougon Cite CI, Rue S259, Abidjan - CI            │
│ Tel: (225) 27 23 22 79 92 | hinovgroup@hinovgroup.com      │
├─────────────────────┬───────────────────────────────────────┤
│ CLIENT              │                                         │
│ Nom: ...            │                                         │
│ Adresse: ...        │                                         │
│ Téléphone: ...      │                                         │
├─────────────────────┼───────────────────────────────────────┤
│                     │   TABLEAU DES ARTICLES À LIVRER       │
│                     │ ──────────────────────────────────── │
│ Réf. | Désignation  | Qté | Unité | P.U. | Montant │
│------|----------------|-----|-------|------|---------│
│ 001  | Prestations X  |  5  | Jours | 50.000| 250.000 │
│ 002  | Prestations Y  | 10  | Jours | 30.000| 300.000 │
│                     │---------------------------------------│
│                     |           TOTAL: 550.000 FCFA         │
├─────────────────────┴───────────────────────────────────────┤
│ Livraison à : Adresse client                              │
│ Date de livraison: ...                                      │
│ Signatures:                                                 │
│  __________________     __________________                 │
│  Destinataire               | Responsable livraison                │
└─────────────────────────────────────────────────────────────┘
```

## Étapes suivantes après implementation

1. Tester la génération PDF avec des devis réels
2. Vérifier que les coûts unitaire de revient s'affichent correctement
3. Tester l'impression et le téléchargement
4. Vérifier la compatibilité mobile
5. Documenter la nouvelle fonctionnalité

## Fichiers à créer/modifier

1. **Nouveau :** `src/pages/BonLivraison.tsx` - Page composant
2. **Nouveau :** `src/lib/pdfUtils.ts` - Ajouter `generateBonLivraisonPdf()`
3. **Modifier :** `src/App.tsx` - Ajouter la route
4. **Modifier :** `src/pages/Devis.tsx` - Ajouter bouton d'action
5. **Optionnel :** `src/lib/mailUtils.ts` - Ajouter l'envoi email bon de livraison