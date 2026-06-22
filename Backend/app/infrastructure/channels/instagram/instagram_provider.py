import logging

import httpx

from app.domain.errors import ChannelSendError
from app.domain.models.channel import InboundChannelMessage
from app.domain.models.conversation import Channel
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.instagram import InstagramUserProfile

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000


class InstagramProvider:
    def __init__(
        self,
        *,
        instagram_access_token: str | None = None,
        instagram_account_id: str | None = None,
        instagram_api_base_url: str = "https://graph.instagram.com",
        instagram_api_version: str = "v25.0",
        meta_page_access_token: str | None = None,
        meta_graph_api_base_url: str = "https://graph.facebook.com",
        meta_graph_api_version: str = "v25.0",
    ) -> None:
        self._instagram_access_token = instagram_access_token
        self._instagram_account_id = instagram_account_id
        self._instagram_api_base_url = instagram_api_base_url.rstrip("/")
        self._instagram_api_version = instagram_api_version
        self._meta_page_access_token = meta_page_access_token
        self._meta_graph_api_base_url = meta_graph_api_base_url.rstrip("/")
        self._meta_graph_api_version = meta_graph_api_version
        self._client = httpx.AsyncClient(timeout=30.0)

    @property
    def provider_name(self) -> str:
        return "instagram"

    @property
    def channel(self) -> Channel:
        return Channel.instagram

    async def close(self) -> None:
        await self._client.aclose()

    async def get_profile(self) -> dict:
        if not self._instagram_access_token:
            raise ChannelSendError("INSTAGRAM_ACCESS_TOKEN is not configured")

        response = await self._client.get(
            f"{self._instagram_api_base_url}/me",
            params={
                "fields": "id,username",
                "access_token": self._instagram_access_token,
            },
        )
        response.raise_for_status()
        return response.json()

    async def get_user_profile(self, user_id: str) -> InstagramUserProfile:
        if self._meta_page_access_token:
            url = f"{self._meta_graph_api_base_url}/{self._meta_graph_api_version}/{user_id}"
            response = await self._client.get(
                url,
                params={
                    "fields": "name,username,profile_pic",
                    "access_token": self._meta_page_access_token,
                },
            )
            raw_profile = self._safe_response_json(response)
            if response.status_code == 200 and isinstance(raw_profile, dict):
                return InstagramUserProfile(
                    external_id=user_id,
                    display_name=raw_profile.get("name") or user_id,
                    username=raw_profile.get("username"),
                    profile_picture_url=raw_profile.get("profile_pic"),
                    raw_profile=raw_profile,
                )
            logger.info(
                "[instagram] page profile lookup failed user_id=%s status=%s",
                user_id,
                response.status_code,
            )
            return InstagramUserProfile(
                external_id=user_id,
                display_name=user_id,
                raw_profile=raw_profile if isinstance(raw_profile, dict) else {"status": response.status_code},
            )

        if self._instagram_access_token:
            response = await self._client.get(
                f"{self._instagram_api_base_url}/{self._instagram_api_version}/{user_id}",
                params={
                    "fields": "name,username,profile_picture_url",
                    "access_token": self._instagram_access_token,
                },
            )
            raw_profile = self._safe_response_json(response)
            if response.status_code == 200 and isinstance(raw_profile, dict):
                return InstagramUserProfile(
                    external_id=user_id,
                    display_name=raw_profile.get("name") or user_id,
                    username=raw_profile.get("username"),
                    profile_picture_url=raw_profile.get("profile_picture_url"),
                    raw_profile=raw_profile,
                )
            return InstagramUserProfile(
                external_id=user_id,
                display_name=user_id,
                raw_profile=raw_profile if isinstance(raw_profile, dict) else {"status": response.status_code},
            )

        return InstagramUserProfile(
            external_id=user_id,
            display_name=user_id,
            raw_profile={"error": "No Meta/Instagram access token configured for profile lookup"},
        )

    def _safe_response_json(self, response: httpx.Response) -> dict:
        try:
            payload = response.json()
        except ValueError:
            return {"error": response.text or "Invalid JSON response"}
        return payload if isinstance(payload, dict) else {"data": payload}

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
    ) -> ChannelSendResult:
        del tenant_id  # Reserved for per-tenant credentials in production.

        if not self._instagram_access_token:
            raise ChannelSendError(
                "INSTAGRAM_ACCESS_TOKEN is required to send Instagram messages"
            )
        if not self._instagram_account_id:
            raise ChannelSendError(
                "INSTAGRAM_ACCOUNT_ID is required to send Instagram messages "
                "(your Instagram professional account ID, e.g. 17841416293732352)"
            )

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")
        if len(normalized_text) > MAX_MESSAGE_LENGTH:
            raise ChannelSendError(
                f"Message text exceeds maximum length of {MAX_MESSAGE_LENGTH} characters"
            )

        url = (
            f"{self._instagram_api_base_url}/{self._instagram_api_version}/"
            f"{self._instagram_account_id}/messages"
        )
        body = {
            "recipient": {"id": recipient_id},
            "messaging_type": "RESPONSE",
            "message": {"text": normalized_text},
        }

        response = await self._client.post(
            url,
            params={"access_token": self._instagram_access_token},
            json=body,
        )

        if response.status_code >= 400:
            self._raise_send_error(response)

        raw_response = response.json()
        external_message_id = raw_response.get("message_id")
        if external_message_id is not None:
            external_message_id = str(external_message_id)

        logger.info(
            "[instagram] sent message recipient_id=%s external_message_id=%s",
            recipient_id,
            external_message_id,
        )

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient_id,
            raw_response=raw_response,
        )

    def _raise_send_error(self, response: httpx.Response) -> None:
        try:
            payload = response.json()
        except ValueError:
            payload = {}

        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            message = error.get("message", "Unknown Instagram API error")
            code = error.get("code")
            subcode = error.get("error_subcode")
            fbtrace_id = error.get("fbtrace_id")
            logger.warning(
                "[instagram] send failed status=%s code=%s subcode=%s fbtrace_id=%s error=%s",
                response.status_code,
                code,
                subcode,
                fbtrace_id,
                message,
            )
        else:
            message = response.text or "Unknown Instagram API error"
            logger.warning(
                "[instagram] send failed status=%s error=%s",
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
        """Ignore webhooks for messages sent by our own Instagram account."""
        if message.get("is_echo") is True:
            logger.debug("[instagram] ignoring echo webhook message")
            return True

        sender = str(sender_id)
        if self._instagram_account_id and sender == str(self._instagram_account_id):
            logger.debug(
                "[instagram] ignoring webhook from own account id=%s",
                sender,
            )
            return True

        if entry_id and sender == str(entry_id):
            logger.debug(
                "[instagram] ignoring webhook from entry account id=%s",
                sender,
            )
            return True

        return False

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        del tenant_id  # Reserved for per-tenant routing in production.
        messages: list[InboundChannelMessage] = []

        if not isinstance(payload, dict):
            logger.warning("Instagram webhook payload is not a JSON object")
            return messages

        entries = payload.get("entry")
        if not isinstance(entries, list):
            logger.debug("Instagram webhook has no entry list: object=%s", payload.get("object"))
            return messages

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            entry_id = str(entry["id"]) if entry.get("id") is not None else None

            messaging_events = entry.get("messaging")
            if isinstance(messaging_events, list):
                for event in messaging_events:
                    parsed = self._parse_messaging_event(event, payload, entry_id=entry_id)
                    if parsed is not None:
                        messages.append(parsed)

            changes = entry.get("changes")
            if isinstance(changes, list):
                for change in changes:
                    parsed = self._parse_change_event(change, payload, entry_id=entry_id)
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

        message = event.get("message")
        if not isinstance(message, dict):
            return None

        text = message.get("text")
        if not isinstance(text, str) or not text.strip():
            return None

        sender = event.get("sender")
        if not isinstance(sender, dict):
            return None

        sender_id = sender.get("id")
        if not sender_id:
            return None

        if self._is_outbound_echo(
            sender_id=str(sender_id),
            message=message,
            entry_id=entry_id,
        ):
            return None

        recipient = event.get("recipient")
        recipient_id = None
        if isinstance(recipient, dict) and recipient.get("id"):
            recipient_id = str(recipient["id"])

        return InboundChannelMessage(
            external_message_id=str(message["mid"]) if message.get("mid") else None,
            external_conversation_id=recipient_id,
            sender_external_id=str(sender_id),
            recipient_external_id=recipient_id,
            text=text.strip(),
            channel=Channel.instagram,
            raw_payload=raw_payload,
        )

    def _parse_change_event(
        self,
        change: object,
        raw_payload: dict,
        *,
        entry_id: str | None = None,
    ) -> InboundChannelMessage | None:
        if not isinstance(change, dict):
            return None

        value = change.get("value")
        if not isinstance(value, dict):
            return None

        message = value.get("message")
        if not isinstance(message, dict):
            return None

        text = message.get("text")
        if not isinstance(text, str) or not text.strip():
            return None

        sender = value.get("sender")
        if not isinstance(sender, dict) or not sender.get("id"):
            return None

        if self._is_outbound_echo(
            sender_id=str(sender["id"]),
            message=message,
            entry_id=entry_id,
        ):
            return None

        recipient = value.get("recipient")
        recipient_id = None
        if isinstance(recipient, dict) and recipient.get("id"):
            recipient_id = str(recipient["id"])

        return InboundChannelMessage(
            external_message_id=str(message["mid"]) if message.get("mid") else None,
            external_conversation_id=recipient_id,
            sender_external_id=str(sender["id"]),
            recipient_external_id=recipient_id,
            text=text.strip(),
            channel=Channel.instagram,
            raw_payload=raw_payload,
        )
