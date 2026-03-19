import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def send_reset_password_email(email_to: str, token: str):
    """
    Sends a password reset email using SMTP.
    Enforces real connection; simulation mode is removed.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        error_msg = "SMTP_HOST and SMTP_USER must be configured for password recovery."
        logger.error(f"❌ {error_msg}")
        raise ValueError(error_msg)

    # Aseguramos que el link use FRONTEND_URL configurado y respete el HashRouter
    reset_link = f"{settings.FRONTEND_URL}/#/reset-password?token={token}"
    
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
