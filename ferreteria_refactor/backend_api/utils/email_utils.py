import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def send_reset_password_email(email_to: str, token: str):
    """
    Sends a password reset email using SMTP.
    The link uses settings.FRONTEND_URL for environment compatibility.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(f"⚠️ SMTP not configured. Token for {email_to}: {token}")
        print(f"\n[EMAIL SIMULATION] To: {email_to}")
        print(f"[EMAIL SIMULATION] Link: {settings.FRONTEND_URL}/reset-password?token={token}\n")
        return

    subject = f"Recuperación de Contraseña - {settings.EMAILS_FROM_NAME}"
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    html_content = f"""
    <html>
        <body>
            <h2>Recuperación de Contraseña</h2>
            <p>Has solicitado restablecer tu contraseña para {settings.EMAILS_FROM_NAME}.</p>
            <p>Haz clic en el siguiente botón para continuar:</p>
            <a href="{reset_link}" style="display:inline-block;padding:10px 20px;background-color:#2563eb;color:white;text-decoration:none;border-radius:5px;">
                Restablecer Contraseña
            </a>
            <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
            <p>El enlace expirará en 1 hora.</p>
        </body>
    </html>
    """

    message = MIMEMultipart()
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email_to
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            server.send_message(message)
            logger.info(f"✅ Reset email sent to {email_to}")
    except Exception as e:
        logger.error(f"❌ Failed to send email to {email_to}: {e}")
        # Fallback to log for debugging
        print(f"\n[EMAIL ERROR] Could not send to {email_to}. Token: {token}\n")
        raise e
