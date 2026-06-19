import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def get_site_public_url() -> str:
    explicit = os.getenv("SITE_PUBLIC_URL", "").strip().rstrip("/")
    if explicit:
        return explicit

    vercel_url = os.getenv("VERCEL_URL", "").strip()
    if vercel_url:
        return f"https://{vercel_url}"

    return "http://localhost:4200"


def _smtp_configured() -> bool:
    return bool(
        os.getenv("SMTP_HOST", "").strip()
        and os.getenv("SMTP_USER", "").strip()
        and os.getenv("SMTP_PASSWORD", "").strip()
    )


def send_password_reset_email(*, to_email: str, user_name: str, reset_url: str) -> None:
    subject = "Redefinição de senha — Starke Academy"
    body_text = (
        f"Olá, {user_name}!\n\n"
        "Recebemos uma solicitação para redefinir a senha da sua conta Starke Academy.\n"
        f"Acesse o link abaixo para criar uma nova senha (válido por 30 minutos):\n\n"
        f"{reset_url}\n\n"
        "Se você não solicitou esta alteração, ignore este e-mail.\n"
    )
    body_html = f"""
    <p>Olá, <strong>{user_name}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta Starke Academy.</p>
    <p><a href="{reset_url}">Clique aqui para criar uma nova senha</a> (válido por 30 minutos).</p>
    <p>Se você não solicitou esta alteração, ignore este e-mail.</p>
  """

    if not _smtp_configured():
        logger.warning(
            "SMTP não configurado. Link de redefinição para %s: %s",
            to_email,
            reset_url,
        )
        return

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("EMAIL_FROM", smtp_user).strip()

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email
    message.attach(MIMEText(body_text, "plain", "utf-8"))
    message.attach(MIMEText(body_html, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        if os.getenv("SMTP_USE_TLS", "true").lower() != "false":
            server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [to_email], message.as_string())
