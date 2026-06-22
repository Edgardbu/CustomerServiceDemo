import asyncio
import logging
from email.message import EmailMessage
from uuid import uuid4

from app.domain.errors import ChannelSendError
from app.domain.models.channel import InboundChannelMessage
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.conversation import Channel

logger = logging.getLogger(__name__)

try:
    import aiosmtplib
except ImportError:  # pragma: no cover
    aiosmtplib = None  # type: ignore[assignment]


class SmtpEmailProvider:
    def __init__(
        self,
        *,
        smtp_host: str | None = None,
        smtp_port: int = 587,
        smtp_username: str | None = None,
        smtp_password: str | None = None,
        smtp_from_email: str | None = None,
        smtp_from_name: str = "Support",
        smtp_use_tls: bool = True,
        smtp_use_ssl: bool = False,
    ) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._smtp_username = smtp_username
        self._smtp_password = smtp_password
        self._smtp_from_email = smtp_from_email
        self._smtp_from_name = smtp_from_name
        self._smtp_use_tls = smtp_use_tls
        self._smtp_use_ssl = smtp_use_ssl

    @property
    def provider_name(self) -> str:
        return "smtp_demo"

    @property
    def channel(self) -> Channel:
        return Channel.email

    async def close(self) -> None:
        return None

    def config_check(self) -> dict:
        host_configured = bool(self._smtp_host)
        from_configured = bool(self._smtp_from_email)
        return {
            "provider": "smtp_demo",
            "ready": host_configured and from_configured,
            "host_configured": host_configured,
            "from_configured": from_configured,
        }

    def _ensure_configured(self) -> None:
        if not self._smtp_host or not self._smtp_from_email:
            raise ChannelSendError("SMTP provider is not configured")

    def _build_message(
        self,
        *,
        recipient_id: str,
        text: str,
        subject: str,
    ) -> EmailMessage:
        message = EmailMessage()
        message["From"] = f"{self._smtp_from_name} <{self._smtp_from_email}>"
        message["To"] = recipient_id
        message["Subject"] = subject
        message.set_content(text)
        return message

    def _send_sync(self, message: EmailMessage) -> None:
        import smtplib

        if self._smtp_use_ssl:
            with smtplib.SMTP_SSL(self._smtp_host, self._smtp_port) as client:
                if self._smtp_username and self._smtp_password:
                    client.login(self._smtp_username, self._smtp_password)
                client.send_message(message)
            return

        with smtplib.SMTP(self._smtp_host, self._smtp_port) as client:
            if self._smtp_use_tls:
                client.starttls()
            if self._smtp_username and self._smtp_password:
                client.login(self._smtp_username, self._smtp_password)
            client.send_message(message)

    async def _send_via_aiosmtplib(self, message: EmailMessage) -> None:
        if aiosmtplib is None:
            raise ChannelSendError("aiosmtplib is not installed")

        kwargs: dict = {
            "hostname": self._smtp_host,
            "port": self._smtp_port,
            "username": self._smtp_username,
            "password": self._smtp_password,
        }
        if self._smtp_use_ssl:
            kwargs["use_tls"] = True
        elif self._smtp_use_tls:
            kwargs["start_tls"] = True

        await aiosmtplib.send(message, **kwargs)

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
        **kwargs: object,
    ) -> ChannelSendResult:
        del tenant_id

        self._ensure_configured()

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")

        subject = kwargs.get("subject")
        if not isinstance(subject, str) or not subject.strip():
            subject = "Support reply"
        else:
            subject = subject.strip()

        message = self._build_message(
            recipient_id=recipient_id,
            text=normalized_text,
            subject=subject,
        )

        try:
            if aiosmtplib is not None:
                await self._send_via_aiosmtplib(message)
            else:
                await asyncio.to_thread(self._send_sync, message)
        except ChannelSendError:
            raise
        except Exception as exc:
            logger.warning("[email:smtp] send failed recipient=%s", recipient_id)
            raise ChannelSendError(f"Failed to send email: {exc}") from exc

        external_message_id = f"smtp_{uuid4()}"
        logger.info("[email:smtp] sent message to %s", recipient_id)

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient_id,
            raw_response={
                "provider": "smtp_demo",
                "recipient_id": recipient_id,
                "subject": subject,
                "status": "sent",
            },
        )

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        del tenant_id, payload
        return []
