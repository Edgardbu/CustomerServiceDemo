import logging
from typing import Any

import httpx

from app.domain.errors import ChannelSendError
from app.domain.models.channel import InboundChannelMessage
from app.domain.models.conversation import Channel
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.whatsapp import (
    WhatsAppStatusUpdate,
    WhatsAppUserProfile,
)

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 4096

NON_TEXT_LABELS = {
    "image": "[WhatsApp image]",
    "document": "[WhatsApp document]",
    "audio": "[WhatsApp audio]",
    "video": "[WhatsApp video]",
}


class WhatsAppProvider:
    def __init__(
        self,
        *,
        whatsapp_access_token: str | None = None,
        whatsapp_business_account_id: str | None = None,
        whatsapp_phone_number_id: str | None = None,
        meta_graph_api_base_url: str = "https://graph.facebook.com",
        meta_graph_api_version: str = "v25.0",
    ) -> None:
        self._whatsapp_access_token = whatsapp_access_token
        self._whatsapp_business_account_id = whatsapp_business_account_id
        self._whatsapp_phone_number_id = whatsapp_phone_number_id
        self._meta_graph_api_base_url = meta_graph_api_base_url.rstrip("/")
        self._meta_graph_api_version = meta_graph_api_version
        self._client = httpx.AsyncClient(timeout=30.0)
        self._contact_names: dict[str, str] = {}

    @property
    def provider_name(self) -> str:
        return "whatsapp"

    @property
    def channel(self) -> Channel:
        return Channel.whatsapp

    async def close(self) -> None:
        await self._client.aclose()

    def _auth_headers(self) -> dict[str, str]:
        if not self._whatsapp_access_token:
            raise ChannelSendError("WHATSAPP_ACCESS_TOKEN is not configured")
        return {
            "Authorization": f"Bearer {self._whatsapp_access_token}",
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

    def remember_contact(self, wa_id: str, display_name: str | None) -> None:
        if display_name and display_name.strip():
            self._contact_names[str(wa_id)] = display_name.strip()

    def get_user_profile(self, user_id: str) -> WhatsAppUserProfile:
        display_name = self._contact_names.get(str(user_id)) or str(user_id)
        return WhatsAppUserProfile(
            external_id=str(user_id),
            display_name=display_name,
            username=None,
            profile_picture_url=None,
            raw_profile={"source": "webhook_cache", "wa_id": str(user_id)},
        )

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
    ) -> ChannelSendResult:
        del tenant_id  # Reserved for per-tenant credentials in production.

        if not self._whatsapp_access_token:
            raise ChannelSendError(
                "WHATSAPP_ACCESS_TOKEN is required to send WhatsApp messages"
            )
        if not self._whatsapp_phone_number_id:
            raise ChannelSendError(
                "WHATSAPP_PHONE_NUMBER_ID is required to send WhatsApp messages"
            )

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")
        if len(normalized_text) > MAX_MESSAGE_LENGTH:
            raise ChannelSendError(
                f"Message text exceeds maximum length of {MAX_MESSAGE_LENGTH} characters"
            )

        recipient = str(recipient_id).lstrip("+")
        body = {
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "text",
            "text": {"body": normalized_text},
        }

        response = await self._client.post(
            self._graph_url(f"{self._whatsapp_phone_number_id}/messages"),
            headers=self._auth_headers(),
            json=body,
        )

        if response.status_code >= 400:
            self._raise_send_error(response)

        raw_response = response.json()
        external_message_id = None
        messages = raw_response.get("messages")
        if isinstance(messages, list) and messages:
            first = messages[0]
            if isinstance(first, dict) and first.get("id"):
                external_message_id = str(first["id"])

        logger.info("[whatsapp:send] sent message to %s", recipient)

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient,
            raw_response=raw_response,
        )

    async def subscribe_waba(self) -> dict:
        if not self._whatsapp_access_token:
            raise ChannelSendError("WHATSAPP_ACCESS_TOKEN is not configured")
        if not self._whatsapp_business_account_id:
            raise ChannelSendError("WHATSAPP_BUSINESS_ACCOUNT_ID is not configured")

        response = await self._client.post(
            self._graph_url(f"{self._whatsapp_business_account_id}/subscribed_apps"),
            headers=self._auth_headers(),
        )
        if response.status_code >= 400:
            self._raise_send_error(response)

        logger.info("[whatsapp:subscribe] subscribed app to WABA")
        return response.json()

    async def get_subscribed_apps(self) -> dict:
        if not self._whatsapp_access_token:
            raise ChannelSendError("WHATSAPP_ACCESS_TOKEN is not configured")
        if not self._whatsapp_business_account_id:
            raise ChannelSendError("WHATSAPP_BUSINESS_ACCOUNT_ID is not configured")

        response = await self._client.get(
            self._graph_url(f"{self._whatsapp_business_account_id}/subscribed_apps"),
            headers=self._auth_headers(),
        )
        if response.status_code >= 400:
            self._raise_send_error(response)
        return response.json()

    def config_check(self) -> dict:
        return {
            "has_access_token": bool(self._whatsapp_access_token),
            "phone_number_id": self._whatsapp_phone_number_id,
            "waba_id": self._whatsapp_business_account_id,
            "graph_version": self._meta_graph_api_version,
        }

    def _raise_send_error(self, response: httpx.Response) -> None:
        payload = self._safe_response_json(response)
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            message = error.get("message", "Unknown WhatsApp API error")
            logger.warning(
                "[whatsapp:send] failed status=%s code=%s error=%s",
                response.status_code,
                error.get("code"),
                message,
            )
        else:
            message = response.text or "Unknown WhatsApp API error"
            logger.warning(
                "[whatsapp:send] failed status=%s error=%s",
                response.status_code,
                message,
            )

        raise ChannelSendError(
            message,
            status_code=response.status_code,
            raw_response=payload if isinstance(payload, dict) else {},
        )

    def _contacts_from_value(self, value: dict) -> dict[str, str]:
        contacts: dict[str, str] = {}
        for contact in value.get("contacts") or []:
            if not isinstance(contact, dict):
                continue
            wa_id = contact.get("wa_id")
            if not wa_id:
                continue
            profile = contact.get("profile")
            name = None
            if isinstance(profile, dict):
                name = profile.get("name")
            if isinstance(name, str) and name.strip():
                contacts[str(wa_id)] = name.strip()
                self.remember_contact(str(wa_id), name)
        return contacts

    def _parse_message_content(
        self,
        message: dict,
    ) -> tuple[str | None, list[str], dict | None]:
        message_type = message.get("type")
        if not isinstance(message_type, str):
            return None, [], None

        if message_type == "text":
            text_block = message.get("text")
            if isinstance(text_block, dict):
                body = text_block.get("body")
                if isinstance(body, str) and body.strip():
                    return body.strip(), [], None
            return None, [], None

        if message_type not in NON_TEXT_LABELS:
            logger.debug(
                "[whatsapp:webhook] unsupported inbound type %s",
                message_type,
            )
            return None, [], None

        label = NON_TEXT_LABELS[message_type]
        logger.info("[whatsapp:webhook] inbound non-text type %s", message_type)

        type_payload = message.get(message_type)
        attachments: list[str] = []
        metadata: dict[str, Any] = {"whatsapp_type": message_type}

        if isinstance(type_payload, dict):
            metadata["whatsapp_media"] = type_payload
            media_id = type_payload.get("id")
            mime_type = type_payload.get("mime_type")
            filename = type_payload.get("filename")
            if media_id:
                attachments.append(str(media_id))
            if mime_type:
                metadata["mime_type"] = mime_type
            if filename:
                metadata["filename"] = filename
                attachments.append(str(filename))

        return label, attachments, metadata

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        del tenant_id
        messages: list[InboundChannelMessage] = []

        if not isinstance(payload, dict):
            logger.warning("[whatsapp:webhook] payload is not a JSON object")
            return messages

        if payload.get("object") not in {None, "whatsapp_business_account"}:
            logger.debug(
                "[whatsapp:webhook] ignoring non-WABA object=%s",
                payload.get("object"),
            )
            return messages

        entries = payload.get("entry")
        if not isinstance(entries, list):
            return messages

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            changes = entry.get("changes")
            if not isinstance(changes, list):
                continue

            for change in changes:
                if not isinstance(change, dict):
                    continue
                if change.get("field") not in {None, "messages"}:
                    continue

                value = change.get("value")
                if not isinstance(value, dict):
                    continue

                contacts = self._contacts_from_value(value)
                inbound_list = value.get("messages")
                if not isinstance(inbound_list, list):
                    continue

                phone_number_id = None
                metadata_block = value.get("metadata")
                if isinstance(metadata_block, dict) and metadata_block.get("phone_number_id"):
                    phone_number_id = str(metadata_block["phone_number_id"])

                for message in inbound_list:
                    parsed = self._parse_inbound_message(
                        message,
                        raw_payload=payload,
                        contacts=contacts,
                        phone_number_id=phone_number_id,
                    )
                    if parsed is not None:
                        messages.append(parsed)

        return messages

    def _parse_inbound_message(
        self,
        message: object,
        *,
        raw_payload: dict,
        contacts: dict[str, str],
        phone_number_id: str | None,
    ) -> InboundChannelMessage | None:
        if not isinstance(message, dict):
            return None

        sender_id = message.get("from")
        if not sender_id:
            return None

        wa_id = str(sender_id)
        content, attachments, metadata = self._parse_message_content(message)
        if not content:
            return None

        if message.get("type") == "text":
            logger.info("[whatsapp:webhook] inbound text from %s", wa_id)

        external_message_id = str(message["id"]) if message.get("id") else None
        contact_name = contacts.get(wa_id)

        return InboundChannelMessage(
            external_message_id=external_message_id,
            external_conversation_id=phone_number_id,
            sender_external_id=wa_id,
            recipient_external_id=phone_number_id,
            text=content,
            channel=Channel.whatsapp,
            attachments=attachments,
            metadata=metadata,
            contact_display_name=contact_name,
            raw_payload=raw_payload,
        )

    def parse_status_updates(self, payload: dict) -> list[WhatsAppStatusUpdate]:
        updates: list[WhatsAppStatusUpdate] = []

        if not isinstance(payload, dict):
            return updates

        entries = payload.get("entry")
        if not isinstance(entries, list):
            return updates

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            changes = entry.get("changes")
            if not isinstance(changes, list):
                continue

            for change in changes:
                if not isinstance(change, dict):
                    continue

                value = change.get("value")
                if not isinstance(value, dict):
                    continue

                statuses = value.get("statuses")
                if not isinstance(statuses, list):
                    continue

                for status_item in statuses:
                    if not isinstance(status_item, dict):
                        continue

                    external_id = status_item.get("id")
                    status = status_item.get("status")
                    if not external_id or not isinstance(status, str):
                        continue

                    logger.info("[whatsapp:webhook] status update %s", status)

                    recipient_id = status_item.get("recipient_id")
                    updates.append(
                        WhatsAppStatusUpdate(
                            external_message_id=str(external_id),
                            status=status,
                            recipient_id=str(recipient_id) if recipient_id else None,
                            raw_status=status_item,
                        )
                    )

        return updates
