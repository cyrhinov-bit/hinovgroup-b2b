# Envoi des devis par e-mail — Guide

L'application envoie un devis **avec le PDF joint**. Deux modèles possibles, essayés dans cet ordre :

1. **Votre boîte (SMTP local)** — si l'utilisateur renseigne sa propre boîte, les devis
   partent **de son adresse**. Configuration : une fois par utilisateur (son mot de passe).
2. **Envoi centralisé (serveur)** — fonction Edge `send-quote` : **une adresse d'entreprise**,
   aucune configuration pour les utilisateurs.
3. **Messagerie par défaut** — ouvre Outlook, PDF copié dans le presse-papiers (Ctrl+V).

> **Pourquoi pas Microsoft Graph / Outlook COM ?**
> La boîte `hinovgroup.com` est hébergée chez **LWS** en **IMAP/SMTP classique**, pas sur
> Microsoft 365. Graph et COM ne s'appliquent donc pas.

> **Point clé** : pour qu'un devis partît *au nom* d'une adresse, il faut **authentifier cette
> boîte** (son mot de passe). Mettre seulement un `From:` sans les identifiants est refusé par
> le serveur (anti-usurpation). C'est pourquoi « partir de l'adresse de chaque utilisateur »
> exige que chaque utilisateur saisisse **une fois** son mot de passe.

---

## A. Envoyer depuis l'adresse de chaque utilisateur (SMTP local)

Accessible à **tous les utilisateurs**, sans passer par la page Paramètres :

**Devis → onglet « Paramètres envoi devis par e-mail »**.

Chaque utilisateur fait ceci **une seule fois, sur son poste** :

1. **Paramètres → Envoi des devis par e-mail (SMTP)**.
2. L'application **pré-remplit automatiquement** :
   - *Votre adresse d'envoi* = l'e-mail de votre compte applicatif ;
   - *Serveur SMTP* = `mail.<votre-domaine>` ;
   - *Port* `465`, *Sécurité* `SSL/TLS`.
3. Saisissez uniquement **le mot de passe de votre boîte**.
4. **Enregistrer**, puis **Tester la connexion**.

✅ Dès lors, chaque devis envoyé par cet utilisateur part **de sa propre adresse** (le client
le voit comme expéditeur). Le mot de passe reste **chiffré sur son poste** (jamais en base).

> Si un utilisateur ne configure rien, l'application utilisera l'envoi centralisé (section B)
> ou, à défaut, ouvrira sa messagerie.

---

## B. Envoi centralisé (adresse unique de l'entreprise) — une fois pour tout

À faire par un administrateur, une seule fois.

### 1. Connexion Supabase

```powershell
cd C:\hinovapp
supabase login
```

### 2. Identifiants SMTP (secrets serveur)

```powershell
supabase secrets set --project-ref wnnoygyyodygxkksxvgr `
  SMTP_HOST=mail.hinovgroup.com `
  SMTP_PORT=465 `
  SMTP_SECURE=true `
  SMTP_USER=e.gnonskan@hinovgroup.com `
  SMTP_PASS="LE_MOT_DE_PASSE_DE_LA_BOITE" `
  SMTP_FROM_NAME="Hinov Group"
```

### 3. Déploiement

```powershell
supabase functions deploy send-quote --project-ref wnnoygyyodygxkksxvgr --use-api
```

### 4. Vérifier

**Paramètres → Envoi des devis par e-mail → « Envoi centralisé (serveur) » → Vérifier** :
doit afficher **« actif »**.

> Le mot de passe reste uniquement côté serveur (secret Supabase), jamais sur les postes.

---

## En cas de problème

| Message | Cause | Solution |
|---|---|---|
| **Non configuré** | Aucun secret serveur et pas de boîte locale | Refaire A ou B |
| **Identifiants refusés** | Mot de passe erroné | Vérifier le mot de passe de la boîte (webmail) |
| **Impossible de joindre le serveur** | Mauvais serveur/port | `mail.hinovgroup.com`, port 465 ou 587 |
| **Pièce jointe trop volumineuse** | PDF anormalement gros | Vérifier le modèle de devis |
| L'expéditeur n'est pas la bonne adresse | Boîte locale non configurée | Refaire la section A |

---

## Notes techniques

- **Client** : `src/lib/mailUtils.ts` (`composeQuoteMail`) — ordre : SMTP local → serveur → mailto.
- **SMTP local** : `electron/services/mail/SmtpMailService.ts` (`nodemailer`), config dans
  `userData/smtp-mail.json` (mot de passe chiffré via `safeStorage`).
- **Fonction Edge** : `supabase/functions/send-quote/index.ts` (Deno + `denomailer`),
  secrets `SMTP_*`, vérifie l'utilisateur connecté.
- **UI** : `src/components/MailSmtpSettings.tsx` (section Paramètres + diagnostic serveur).
