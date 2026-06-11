import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? "Brabus Fit <onboarding@resend.dev>";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Envía emails de forma best-effort: si no hay RESEND_API_KEY configurada,
 * se loguea y se ignora (la app sigue funcionando sin email).
 */
async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.info(`[email omitido] Para: ${to} — ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from, to, subject, html });
  } catch (err) {
    console.error("[email] Error enviando:", err);
  }
}

function shell(title: string, body: string, ctaText: string, ctaHref: string) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h1 style="font-size:20px;margin:0 0 8px">Brabus Fit</h1>
    <h2 style="font-size:16px;margin:16px 0 8px">${title}</h2>
    <p style="font-size:14px;line-height:1.5;color:#444">${body}</p>
    <p style="margin:24px 0">
      <a href="${ctaHref}" style="background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;display:inline-block">${ctaText}</a>
    </p>
  </div>`;
}

/** Aviso a un usuario existente de que le compartieron una rutina. */
export async function sendRoutineSharedEmail(params: {
  to: string;
  coachName: string;
  routineName: string;
}) {
  const { to, coachName, routineName } = params;
  await send(
    to,
    `${coachName} te compartió una rutina`,
    shell(
      "Tenés una rutina nueva",
      `<strong>${coachName}</strong> te compartió la rutina <strong>${routineName}</strong>. Entrá para verla y empezar a entrenar.`,
      "Ver mis rutinas",
      `${siteUrl}/rutinas`,
    ),
  );
}

/** Invitación a alguien que todavía no tiene cuenta. */
export async function sendRoutineInviteEmail(params: {
  to: string;
  coachName: string;
  routineName: string;
}) {
  const { to, coachName, routineName } = params;
  await send(
    to,
    `${coachName} te invitó a Brabus Fit`,
    shell(
      "Te compartieron una rutina",
      `<strong>${coachName}</strong> te compartió la rutina <strong>${routineName}</strong> en Brabus Fit. Creá tu cuenta con este email y la vas a ver al ingresar.`,
      "Crear mi cuenta",
      `${siteUrl}/signup`,
    ),
  );
}
