type CoachWelcomeEmailInput = {
  fullName: string;
  email: string;
  password: string;
  slug: string;
  appBaseUrl: string;
};

function greetingName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  const first = trimmed.split(/\s+/)[0];
  return first || "there";
}

export function buildCoachWelcomeEmail(input: CoachWelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = greetingName(input.fullName);
  const loginUrl = `${input.appBaseUrl}/login`;
  const coachLink = `${input.appBaseUrl}/landing/a?coach=${encodeURIComponent(input.slug)}`;
  const subject = "Welcome to Profit Coach — your account is ready";

  const text = [
    `Hi ${name},`,
    "",
    "Great news — your Profit Coach account has been set up and you're ready to go.",
    "",
    "Here's how to sign in:",
    `Login page: ${loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.password}`,
    "",
    "We recommend changing your password after your first login (Account → Change password).",
    "",
    `Your personalised coach link: ${coachLink}`,
    "",
    "If you have any questions, just reply to this email — we're happy to help.",
    "",
    "Welcome aboard,",
    "The Profit Coach team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0284c7;">Profit Coach</p>
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;">Welcome aboard, ${name}!</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                  Your Profit Coach account is ready. Here are your login details so you can jump straight in.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Sign in</p>
                      <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#0f172a;"><strong>Email:</strong> ${input.email}</p>
                      <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#0f172a;"><strong>Temporary password:</strong> ${input.password}</p>
                      <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#0f172a;">
                        <a href="${loginUrl}" style="color:#0284c7;font-weight:600;text-decoration:none;">Open the login page →</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 20px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">
                  After your first login, we recommend updating your password in <strong>Account → Change password</strong>.
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
                  Your personalised coach link:<br />
                  <a href="${coachLink}" style="color:#0284c7;word-break:break-all;">${coachLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
                  Questions? Just reply to this email — we're here to help.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
