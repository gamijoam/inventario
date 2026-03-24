import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def send_reset_password_email(email_to: str, token: str, reset_link_base: str = None):
    """
    Sends a password reset email using SMTP.
    reset_link_base: base URL del tenant (ej. https://prueba.miinventariofacil.com)
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        error_msg = "SMTP_HOST and SMTP_USER must be configured for password recovery."
        logger.error(f"❌ {error_msg}")
        raise ValueError(error_msg)

    base = reset_link_base or settings.FRONTEND_URL
    reset_link = f"{base}/#/reset-password?token={token}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
                <p>Hola,</p>
                <p>Has solicitado restablecer tu contraseña para <strong>{settings.EMAILS_FROM_NAME}</strong>.</p>
                <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">
                        Restablecer Contraseña
                    </a>
                </div>
                <p>O copia y pega este enlace en tu navegador:</p>
                <p style="word-break: break-all; color: #2563eb;">{reset_link}</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="font-size: 0.875rem; color: #6b7280;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                <p style="font-size: 0.875rem; color: #6b7280;">El enlace expirará en 1 hora.</p>
            </div>
        </body>
    </html>
    """

    subject = f"Recuperación de Contraseña - {settings.EMAILS_FROM_NAME}"

    message = MIMEMultipart()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    try:
        # Usamos el puerto y host definido en settings
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_TLS:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            server.send_message(message)
            logger.info(f"✅ Reset email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"❌ Failed to send email to {email_to}. Detail: {str(e)}")
        raise e


def send_welcome_email(
    email_to: str,
    company_name: str,
    admin_password: str,
    tenant_url: str,
    plan_label: str = "Demo Gratuita",
    cc_emails: list = None
):
    """
    Sends a welcome email to the new tenant admin with their credentials.
    If SMTP is not configured, logs a warning and returns without raising.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("⚠️ SMTP not configured — skipping welcome email.")
        return

    html_content = f"""
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:40px 40px 32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Invensoft</h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Sistema de Gestión Empresarial</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 40px 24px;">
        <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:600;">¡Bienvenido/a a Invensoft! 🎉</h2>
        <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">Tu empresa <strong style="color:#111827;">{company_name}</strong> ya está lista. Aquí tienes tus credenciales de acceso:</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Email</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1e293b;font-weight:500;">{email_to}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Contraseña temporal</p>
              <p style="margin:4px 0 0;font-size:18px;color:#1e293b;font-weight:700;font-family:monospace;letter-spacing:1px;">{admin_password}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Plan</p>
              <p style="margin:4px 0 0;font-size:15px;color:#1e293b;font-weight:500;">{plan_label}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 40px;text-align:center;">
        <a href="{tenant_url}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
          Ingresar a mi Sistema →
        </a>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">O copia este enlace: <a href="{tenant_url}" style="color:#3b82f6;text-decoration:none;">{tenant_url}</a></p>
      </td>
    </tr>
    <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0;"/></td></tr>
    <tr>
      <td style="padding:32px 40px;">
        <p style="margin:0 0 16px;color:#374151;font-size:14px;font-weight:600;">¿Necesitas ayuda?</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 16px 8px 0;">
              <a href="mailto:soporte@miinventariofacil.com" style="display:inline-flex;align-items:center;color:#374151;text-decoration:none;font-size:14px;">
                <span style="display:inline-block;width:32px;height:32px;background-color:#eff6ff;border-radius:50%;text-align:center;line-height:32px;margin-right:10px;font-size:16px;">✉️</span>
                soporte@miinventariofacil.com
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 16px 8px 0;">
              <a href="https://wa.me/584227410094" style="display:inline-flex;align-items:center;color:#374151;text-decoration:none;font-size:14px;">
                <span style="display:inline-block;width:32px;height:32px;background-color:#f0fdf4;border-radius:50%;text-align:center;line-height:32px;margin-right:10px;font-size:16px;">💬</span>
                WhatsApp: +58 422 741 0094
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Invensoft · Mi Inventario Fácil</p>
        <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">Si no solicitaste esta cuenta, ignora este correo.</p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
"""

    subject = f"¡Bienvenido/a a Invensoft! Tu empresa {company_name} ya está lista"

    valid_cc = [e.strip() for e in (cc_emails or []) if e and e.strip() and e.strip() != email_to]

    message = MIMEMultipart()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    if valid_cc:
        message["Cc"] = ", ".join(valid_cc)
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    all_recipients = [email_to] + valid_cc

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_TLS:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, all_recipients, message.as_string())
            logger.info(f"✅ Welcome email sent to {email_to}" + (f" + CC: {valid_cc}" if valid_cc else ""))
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email to {email_to}. Detail: {str(e)}")


def send_expiry_warning_email(
    email_to: str,
    company_name: str,
    days_remaining: int,
    expiry_date: str,
    tenant_url: str
):
    """
    Sends a subscription expiry warning email.
    expiry_date: formatted string like "25/03/2026"
    If SMTP not configured, logs a warning only — does not raise.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("⚠️ SMTP not configured — skipping expiry warning email.")
        return

    html_content = f"""
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:40px 40px 32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Invensoft</h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Sistema de Gestión Empresarial</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 40px 24px;">
        <h2 style="margin:0 0 12px;color:#111827;font-size:22px;font-weight:600;">⏳ Tu suscripción vence pronto</h2>
        <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">
          Hola, tu empresa <strong style="color:#111827;">{company_name}</strong> tiene
          <strong style="color:#111827;">{days_remaining} días</strong> restantes de suscripción.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #f59e0b;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Fecha de vencimiento</p>
              <p style="margin:8px 0 0;font-size:22px;color:#78350f;font-weight:700;">{expiry_date}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;">
        <p style="margin:0 0 16px;color:#374151;font-size:14px;font-weight:600;">Para renovar tu suscripción, contáctanos:</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 16px 8px 0;">
              <a href="mailto:soporte@miinventariofacil.com" style="display:inline-flex;align-items:center;color:#374151;text-decoration:none;font-size:14px;">
                <span style="display:inline-block;width:32px;height:32px;background-color:#eff6ff;border-radius:50%;text-align:center;line-height:32px;margin-right:10px;font-size:16px;">✉️</span>
                soporte@miinventariofacil.com
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 16px 8px 0;">
              <a href="https://wa.me/584227410094" style="display:inline-flex;align-items:center;color:#374151;text-decoration:none;font-size:14px;">
                <span style="display:inline-block;width:32px;height:32px;background-color:#f0fdf4;border-radius:50%;text-align:center;line-height:32px;margin-right:10px;font-size:16px;">💬</span>
                WhatsApp: +58 422 741 0094
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 40px;text-align:center;">
        <a href="{tenant_url}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
          Ir a mi sistema →
        </a>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">O copia este enlace: <a href="{tenant_url}" style="color:#3b82f6;text-decoration:none;">{tenant_url}</a></p>
      </td>
    </tr>
    <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #f1f5f9;margin:0;"/></td></tr>
    <tr>
      <td style="padding:20px 40px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Invensoft · Mi Inventario Fácil</p>
        <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">Si no solicitaste esta cuenta, ignora este correo.</p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
"""

    subject = f"⚠️ Tu suscripción de {company_name} vence en {days_remaining} días"

    message = MIMEMultipart()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_TLS:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
            logger.info(f"✅ Expiry warning email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"❌ Failed to send expiry warning email to {email_to}. Detail: {str(e)}")
