import logging

import httpx

from app.domain.errors import ChannelSendError
from app.domain.models.channel import InboundChannelMessage
from app.domain.models.conversation import Channel
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.messenger import MessengerUserProfile

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000

MESSENGER_SUBSCRIBED_FIELDS = (
    "messages",
    "messaging_postbacks",
    "messaging_optins",
    "messaging_referrals",
    "message_deliveries",
    "message_reads",
)


class MessengerProvider:
    def __init__(
        self,
        *,
        meta_page_access_token: str | None = None,
        meta_page_id: str | None = None,
        meta_graph_api_base_url: str = "https://graph.facebook.com",
        meta_graph_api_version: str = "v25.0",
    ) -> None:
        self._meta_page_access_token = meta_page_access_token
        self._meta_page_id = meta_page_id
        self._meta_graph_api_base_url = meta_graph_api_base_url.rstrip("/")
        self._meta_graph_api_version = meta_graph_api_version
        self._client = httpx.AsyncClient(timeout=30.0)

    @property
    def provider_name(self) -> str:
        return "facebook"

    @property
    def channel(self) -> Channel:
        return Channel.facebook

    async def close(self) -> None:
        await self._client.aclose()

    def _auth_headers(self) -> dict[str, str]:
        if not self._meta_page_access_token:
            raise ChannelSendError("META_PAGE_ACCESS_TOKEN is not configured")
        return {
            "Authorization": f"Bearer {self._meta_page_access_token}",
            "Content-Type": "application/json",
        }

    def _graph_url(self, path: str) -> str:
        return f"{self._meta_graph_api_base_url}/{self._meta_graph_api_version}/{path.lstrip('/')}"

    def _safe_response_json(self, response: httpx.Response) -> dict:
        try:
            payload = response.json()
        except ValueError:
            return {"error": response.text or "Invalid JSON response"}
        return payload if isinstance(payload, dict) else {"data": payload}

    async def get_user_profile(self, user_id: str) -> MessengerUserProfile:
        if not self._meta_page_access_token:
            return MessengerUserProfile(
                external_id=user_id,
                display_name=user_id,
                raw_profile={"error": "META_PAGE_ACCESS_TOKEN is not configured"},
            )

        response = await self._client.get(
            self._graph_url(user_id),
            params={
                "fields": "first_name,last_name,profile_pic",
                "access_token": self._meta_page_access_token,
            },
        )
        raw_profile = self._safe_response_json(response)

        if response.status_code == 200 and isinstance(raw_profile, dict):
            first_name = raw_profile.get("first_name") or ""
            last_name = raw_profile.get("last_name") or ""
            display_name = f"{first_name} {last_name}".strip() or user_id
            logger.info("[messenger:profile] fetched profile user_id=%s", user_id)
            return MessengerUserProfile(
                external_id=user_id,
                display_name=display_name,
                username=None,
                profile_picture_url=raw_profile.get("profile_pic"),
                raw_profile=raw_profile,
            )

        logger.info(
            "[messenger:profile] lookup failed user_id=%s status=%s",
            user_id,
            response.status_code,
        )
        return MessengerUserProfile(
            external_id=user_id,
            display_name=user_id,
            raw_profile=raw_profile if isinstance(raw_profile, dict) else {"status": response.status_code},
        )

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
    ) -> ChannelSendResult:
        del tenant_id  # Reserved for per-tenant credentials in production.

        if not self._meta_page_access_token:
            raise ChannelSendError(
                "META_PAGE_ACCESS_TOKEN is required to send Messenger messages"
            )

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")
        if len(normalized_text) > MAX_MESSAGE_LENGTH:
            raise ChannelSendError(
                f"Message text exceeds maximum length of {MAX_MESSAGE_LENGTH} characters"
            )

        body = {
            "recipient": {"id": recipient_id},
            "message": {"text": normalized_text},
            "messaging_type": "RESPONSE",
        }

        if self._meta_page_id:
            url = self._graph_url(f"{self._meta_page_id}/messages")
        else:
            url = self._graph_url("me/messages")

        response = await self._client.post(
            url,
            headers=self._auth_headers(),
            json=body,
        )

        if response.status_code >= 400:
            self._raise_send_error(response)

        raw_response = response.json()
        external_message_id = raw_response.get("message_id")
        if external_message_id is not None:
            external_message_id = str(external_message_id)

        logger.info("[messenger:send] sent message to %s", recipient_id)

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient_id,
            raw_response=raw_response,
        )

    async def subscribe_page(self) -> dict:
        if not self._meta_page_access_token:
            raise ChannelSendError("META_PAGE_ACCESS_TOKEN is not configured")
        if not self._meta_page_id:
            raise ChannelSendError("META_PAGE_ID is not configured")

        response = await self._client.post(
            self._graph_url(f"{self._meta_page_id}/subscribed_apps"),
            params={
                "subscribed_fields": ",".join(MESSENGER_SUBSCRIBED_FIELDS),
                "access_token": self._meta_page_access_token,
            },
        )
        if response.status_code >= 400:
            self._raise_send_error(response)
        return response.json()

    async def get_subscribed_apps(self) -> dict:
        if not self._meta_page_access_token:
            raise ChannelSendError("META_PAGE_ACCESS_TOKEN is not configured")
        if not self._meta_page_id:
            raise ChannelSendError("META_PAGE_ID is not configured")

        response = await self._client.get(
            self._graph_url(f"{self._meta_page_id}/subscribed_apps"),
            params={"access_token": self._meta_page_access_token},
        )
        if response.status_code >= 400:
            self._raise_send_error(response)
        return response.json()

    def _raise_send_error(self, response: httpx.Response) -> None:
        try:
            payload = response.json()
        except ValueError:
            payload = {}

        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            message = error.get("message", "Unknown Messenger API error")
            code = error.get("code")
            subcode = error.get("error_subcode")
            fbtrace_id = error.get("fbtrace_id")
            logger.warning(
                "[messenger:send] failed status=%s code=%s subcode=%s fbtrace_id=%s error=%s",
                response.status_code,
                code,
                subcode,
                fbtrace_id,
                message,
            )
        else:
            message = response.text or "Unknown Messenger API error"
            logger.warning(
                "[messenger:send] failed status=%s error=%s",
                response.status_code,
                message,
            )

        raise ChannelSendError(
            message,
            status_code=response.status_code,
            raw_response=payload if isinstance(payload, dict) else {},
        )

    def _is_outbound_echo(
        self,
        *,
        sender_id: str,
        message: dict,
        entry_id: str | None = None,
    ) -> bool:
        if message.get("is_echo") is True:
            logger.info("[messenger:webhook] ignored echo")
            return True

        sender = str(sender_id)
        if self._meta_page_id and sender == str(self._meta_page_id):
            logger.debug(
                "[messenger:webhook] ignored message from page id=%s",
                sender,
            )
            return True

        if entry_id and sender == str(entry_id):
            logger.debug(
                "[messenger:webhook] ignored message from entry page id=%s",
                sender,
            )
            return True

        return False

    def _content_from_attachments(self, attachments: list) -> str | None:
        parts: list[str] = []
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            attachment_type = attachment.get("type") or "attachment"
            payload = attachment.get("payload")
            if isinstance(payload, dict) and payload.get("url"):
                parts.append(f"[{attachment_type}: {payload['url']}]")
            else:
                parts.append(f"[{attachment_type}]")
        if not parts:
            return None
        return " ".join(parts)

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        del tenant_id  # Reserved for per-tenant routing in production.
        messages: list[InboundChannelMessage] = []

        if not isinstance(payload, dict):
            logger.warning("[messenger:webhook] payload is not a JSON object")
            return messages

        if payload.get("object") not in {None, "page"}:
            logger.debug(
                "[messenger:webhook] ignoring non-page object=%s",
                payload.get("object"),
            )
            return messages

        entries = payload.get("entry")
        if not isinstance(entries, list):
            logger.debug("[messenger:webhook] no entry list in payload")
            return messages

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            entry_id = str(entry["id"]) if entry.get("id") is not None else None

            messaging_events = entry.get("messaging")
            if not isinstance(messaging_events, list):
                continue

            for event in messaging_events:
                parsed = self._parse_messaging_event(event, payload, entry_id=entry_id)
                if parsed is not None:
                    messages.append(parsed)

        return messages

    def _parse_messaging_event(
        self,
        event: object,
        raw_payload: dict,
        *,
        entry_id: str | None = None,
    ) -> InboundChannelMessage | None:
        if not isinstance(event, dict):
            return None

        if event.get("delivery") or event.get("read"):
            return None

        sender = event.get("sender")
        if not isinstance(sender, dict) or not sender.get("id"):
            return None

        sender_id = str(sender["id"])
        recipient = event.get("recipient")
        recipient_id = None
        if isinstance(recipient, dict) and recipient.get("id"):
            recipient_id = str(recipient["id"])

        message = event.get("message")
        if isinstance(message, dict):
            if self._is_outbound_echo(
                sender_id=sender_id,
                message=message,
                entry_id=entry_id,
            ):
                return None

            text = message.get("text")
            if not isinstance(text, str) or not text.strip():
                attachments = message.get("attachments")
                if isinstance(attachments, list):
                    text = self._content_from_attachments(attachments)
                if not text:
                    return None
            else:
                text = text.strip()

            external_message_id = str(message["mid"]) if message.get("mid") else None
            logger.info("[messenger:webhook] inbound message from %s", sender_id)

            return InboundChannelMessage(
                external_message_id=external_message_id,
                external_conversation_id=recipient_id,
                sender_external_id=sender_id,
                recipient_external_id=recipient_id,
                text=text,
                channel=Channel.facebook,
                raw_payload=raw_payload,
            )

        postback = event.get("postback")
        if isinstance(postback, dict):
            text = postback.get("title") or postback.get("payload")
            if not isinstance(text, str) or not text.strip():
                return None

            logger.info("[messenger:webhook] inbound postback from %s", sender_id)

            return InboundChannelMessage(
                external_message_id=None,
                external_conversation_id=recipient_id,
                sender_external_id=sender_id,
                recipient_external_id=recipient_id,
                text=text.strip(),
                channel=Channel.facebook,
                raw_payload=raw_payload,
            )

        return None
