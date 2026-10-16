// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Taille maximale totale des pièces jointes (base64) : 8 Mo.
const MAX_ATTACHMENTS_BASE64 = 8 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- Authentification obligatoire (l'anon key seule est un JWT valide, on vérifie l'utilisateur) ----
    const authHeader = req.headers.get('Authorization') ?? '';
    // @ts-ignore
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return json({ ok: false, code: 'UNAUTHENTICATED', error: 'Non authentifié.' }, 401);
    }

    // ---- Configuration SMTP (secrets serveur, jamais exposés au client) ----
    const host = Deno.env.get('SMTP_HOST');
    const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
    const secure = (Deno.env.get('SMTP_SECURE') ?? 'true').toLowerCase() !== 'false';
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromName = Deno.env.get('SMTP_FROM_NAME') ?? '';

    if (!host || !smtpUser || !smtpPass) {
      return json({
        ok: false,
        code: 'NOT_CONFIGURED',
        error: "L'envoi par e-mail n'est pas configuré côté serveur (secrets SMTP manquants).",
      });
    }

    const { to, cc, bcc, subject, html, text, attachments } = await req.json();

    const recipients = (Array.isArray(to) ? to : [to]).map((v: string) => String(v || '').trim()).filter(Boolean);
    if (recipients.length === 0) {
      return json({ ok: false, code: 'NO_RECIPIENT', error: 'Aucun destinataire.' });
    }

    const atts = (Array.isArray(attachments) ? attachments : []).filter((a: any) => a && a.base64);
    const totalBase64 = atts.reduce((sum: number, a: any) => sum + String(a.base64).length, 0);
    if (totalBase64 > MAX_ATTACHMENTS_BASE64) {
      return json({ ok: false, code: 'TOO_LARGE', error: 'Pièce jointe trop volumineuse pour l’envoi serveur.' });
    }

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: secure,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    try {
      await client.send({
        from: fromName ? `${fromName} <${smtpUser}>` : smtpUser,
        to: recipients,
        cc: Array.isArray(cc) ? cc : cc ? [cc] : undefined,
        bcc: Array.isArray(bcc) ? bcc : bcc ? [bcc] : undefined,
        subject: String(subject ?? ''),
        content: html ? 'auto' : 'text',
        html: html || undefined,
        text: text || (html ? undefined : ''),
        attachments: atts.map((a: any) => ({
          filename: a.filename || 'piece-jointe.pdf',
          content: String(a.base64),
          encoding: 'base64',
          contentType: a.mimeType || 'application/octet-stream',
        })),
      });
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }

    return json({ ok: true });
  } catch (err: any) {
    const message = err?.message || "Erreur lors de l'envoi de l'e-mail.";
    const code = /auth/i.test(message) ? 'SMTP_AUTH' : 'SMTP';
    return json({ ok: false, code, error: message });
  }
});
