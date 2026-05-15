interface EmailAction {
  label: string;
  url: string;
}

interface EmailTemplateOptions {
  preheader: string;
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  action?: EmailAction;
  footerHtml?: string;
}

export function renderEmailTemplate({
  preheader,
  eyebrow = 'Geschenk',
  title,
  bodyHtml,
  action,
  footerHtml,
}: EmailTemplateOptions) {
  const escapedPreheader = escapeHtml(preheader);
  const actionHtml = action
    ? `<tr>
        <td style="padding: 8px 0 28px;">
          <a href="${escapeAttribute(action.url)}" style="display: inline-block; background: #1559b7; color: #ffffff; text-decoration: none; font-size: 16px; line-height: 20px; font-weight: 700; padding: 14px 20px; border-radius: 10px;">${escapeHtml(action.label)}</a>
        </td>
      </tr>`
    : '';
  const footer = footerHtml
    ? `<tr>
        <td style="padding-top: 24px; border-top: 1px solid #d8e5f7; color: #64748b; font-size: 12px; line-height: 18px;">
          ${footerHtml}
        </td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #eef5ff; color: #08245a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapedPreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #eef5ff; margin: 0; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 560px;">
            <tr>
              <td style="padding: 0 0 16px; font-size: 26px; line-height: 32px; font-weight: 800; color: #08245a;">
                Geschenk
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; border: 1px solid #cfe0f7; border-radius: 18px; padding: 32px; box-shadow: 0 18px 40px rgba(8, 36, 90, 0.10);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 0 0 10px; color: #1559b7; font-size: 13px; line-height: 18px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;">
                      ${escapeHtml(eyebrow)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 14px; color: #08245a; font-size: 30px; line-height: 36px; font-weight: 850;">
                      ${escapeHtml(title)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 22px; color: #40567a; font-size: 16px; line-height: 25px;">
                      ${bodyHtml}
                    </td>
                  </tr>
                  ${actionHtml}
                  ${footer}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
