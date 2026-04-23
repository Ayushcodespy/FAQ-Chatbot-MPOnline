import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.config import get_settings


def _build_html_email(title: str, intro: str, detail_rows: list[tuple[str, str]], footer: str) -> str:
    details_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:14px;width:160px;">{label}</td>
          <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">{value}</td>
        </tr>
        """
        for label, value in detail_rows
    )
    return f"""
    <div style="margin:0;padding:24px;background:#f7f3ea;font-family:Segoe UI,Trebuchet MS,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #eadfcb;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(79,50,16,0.10);">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#b45309,#7c2d12);color:#fffaf3;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;">MPOnline FAQ Chatbot</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">{title}</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">{intro}</p>
          <div style="padding:18px 20px;border-radius:18px;background:#fff8ec;border:1px solid #efd9b0;">
            <table style="width:100%;border-collapse:collapse;">
              {details_html}
            </table>
          </div>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#6b7280;">{footer}</p>
        </div>
      </div>
    </div>
    """


def _require_email_config() -> tuple[str, int, str | None, str | None, str, str, bool, bool]:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured. Please update SMTP settings in the environment.",
        )
    return (
        settings.smtp_host,
        settings.smtp_port,
        settings.smtp_username,
        settings.smtp_password,
        settings.smtp_from_email,
        settings.smtp_from_name,
        settings.smtp_use_tls,
        settings.smtp_use_ssl,
    )


def send_email(
    subject: str,
    recipient: str,
    body: str,
    *,
    html_body: str | None = None,
    strict: bool = False,
) -> bool:
    try:
        host, port, username, password, from_email, from_name, use_tls, use_ssl = _require_email_config()
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = recipient
        message.set_content(body)
        if html_body:
            message.add_alternative(html_body, subtype="html")

        smtp_client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_client(host, port, timeout=20) as server:
            if use_tls:
                server.starttls()
            if username:
                server.login(username, password or "")
            server.send_message(message)
        return True
    except HTTPException:
        if strict:
            raise
        return False
    except Exception:
        if strict:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to send email right now. Please try again later.",
            )
        return False


def send_registration_otp_email(email: str, username: str, otp: str, expiry_minutes: int) -> None:
    body = (
        f"Hello {username},\n\n"
        f"Your OTP for MPOnline account verification is: {otp}\n"
        f"This OTP will expire in {expiry_minutes} minutes.\n\n"
        "If you did not request this, please ignore this email."
    )
    send_email(
        "Verify your MPOnline account",
        email,
        body,
        html_body=_build_html_email(
            "Verify Your Account",
            f"Hello {username}, use the OTP below to verify your MPOnline account.",
            [("OTP", otp), ("Valid For", f"{expiry_minutes} minutes")],
            "If you did not request this, you can safely ignore this email.",
        ),
        strict=True,
    )


def send_login_otp_email(email: str, otp: str, expiry_minutes: int) -> None:
    body = (
        "Hello,\n\n"
        f"Your OTP for MPOnline login is: {otp}\n"
        f"This OTP will expire in {expiry_minutes} minutes.\n\n"
        "If you did not request this, please ignore this email."
    )
    send_email(
        "Your MPOnline login OTP",
        email,
        body,
        html_body=_build_html_email(
            "Login OTP",
            "Use the following OTP to sign in to your MPOnline account.",
            [("OTP", otp), ("Valid For", f"{expiry_minutes} minutes")],
            "If you did not request this login OTP, you can ignore this email.",
        ),
        strict=True,
    )


def send_grievance_submission_email(email: str, username: str, grievance_id: int) -> bool:
    body = (
        f"Hello {username},\n\n"
        "Your grievance has been submitted successfully.\n"
        f"Ticket Number: #{grievance_id}\n"
        "Status: open\n\n"
        "You can log in to track updates and reply to the grievance thread."
    )
    return send_email(
        f"Grievance #{grievance_id} submitted successfully",
        email,
        body,
        html_body=_build_html_email(
            "Grievance Submitted Successfully",
            f"Hello {username}, your grievance has been received and recorded successfully.",
            [("Ticket Number", f"#{grievance_id}"), ("Current Status", "Open")],
            "You can log in at any time to track updates, reply to the thread, and view the latest progress.",
        ),
    )


def send_grievance_status_email(email: str, username: str, grievance_id: int, status_value: str) -> bool:
    body = (
        f"Hello {username},\n\n"
        f"There is an update on your grievance #{grievance_id}.\n"
        f"Current Status: {status_value}\n\n"
        "Please log in to review the latest details."
    )
    return send_email(
        f"Update on grievance #{grievance_id}",
        email,
        body,
        html_body=_build_html_email(
            "Grievance Status Updated",
            f"Hello {username}, there is a new status update on your grievance.",
            [("Ticket Number", f"#{grievance_id}"), ("New Status", status_value.title())],
            "Please log in to review the latest details and continue the conversation if needed.",
        ),
    )


def send_grievance_comment_email(email: str, username: str, grievance_id: int, author_name: str) -> bool:
    body = (
        f"Hello {username},\n\n"
        f"{author_name} added a new reply to your grievance #{grievance_id}.\n\n"
        "Please log in to read the update and continue the conversation."
    )
    return send_email(
        f"New reply on grievance #{grievance_id}",
        email,
        body,
        html_body=_build_html_email(
            "New Reply On Your Grievance",
            f"Hello {username}, a new reply has been added to your grievance thread.",
            [("Ticket Number", f"#{grievance_id}"), ("Updated By", author_name)],
            "Please log in to read the new message and respond if needed.",
        ),
    )
