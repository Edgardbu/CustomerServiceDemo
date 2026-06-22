from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import Settings
from app.domain.models.conversation import Channel
from app.domain.ports.ai_provider import AIProvider
from app.domain.ports.ai_approval_repository import AIApprovalRepository
from app.domain.ports.ai_settings_repository import AISettingsRepository
from app.domain.ports.channel_provider import ChannelProvider
from app.domain.ports.conversation_ai_notes_repository import ConversationAINotesRepository
from app.domain.ports.conversation_repository import ConversationRepository
from app.domain.ports.customer_profile_repository import CustomerProfileRepository
from app.domain.ports.bot_flow_repository import BotFlowRepository
from app.domain.ports.bot_flow_session_repository import BotFlowSessionRepository
from app.domain.ports.knowledge_chunk_repository import KnowledgeChunkRepository
from app.domain.ports.knowledge_document_repository import KnowledgeDocumentRepository
from app.domain.ports.realtime import RealtimePublisher
from app.domain.ports.user_repository import UserRepository

from app.infrastructure.ai.mock_provider import MockAIProvider
from app.infrastructure.ai.openai_provider import OpenAIProvider
from app.infrastructure.channels.instagram.instagram_provider import InstagramProvider
from app.infrastructure.channels.messenger.messenger_provider import MessengerProvider
from app.infrastructure.channels.whatsapp.whatsapp_provider import WhatsAppProvider
from app.infrastructure.channels.sms.sms_provider import DemoSMSProvider
from app.infrastructure.channels.email.email_provider import SmtpEmailProvider
from app.infrastructure.database.memory.ai_approval_repository import InMemoryAIApprovalRepository
from app.infrastructure.database.memory.ai_settings_repository import InMemoryAISettingsRepository
from app.infrastructure.database.memory.conversation_ai_notes_repository import (
    InMemoryConversationAINotesRepository,
)
from app.infrastructure.database.memory.conversation_repository import InMemoryConversationRepository
from app.infrastructure.database.memory.customer_profile_repository import (
    InMemoryCustomerProfileRepository,
)
from app.infrastructure.database.memory.bot_flow_repository import (
    InMemoryBotFlowRepository,
    InMemoryBotFlowSessionRepository,
)
from app.infrastructure.database.memory.user_repository import InMemoryUserRepository
from app.infrastructure.database.memory.knowledge_repository import (
    InMemoryKnowledgeChunkRepository,
    InMemoryKnowledgeDocumentRepository,
)
from app.infrastructure.database.postgres.ai_approval_repository import PostgresAIApprovalRepository
from app.infrastructure.database.postgres.ai_settings_repository import PostgresAISettingsRepository
from app.infrastructure.database.postgres.conversation_ai_notes_repository import (
    PostgresConversationAINotesRepository,
)
from app.infrastructure.database.postgres.conversation_repository import PostgresConversationRepository
from app.infrastructure.database.postgres.customer_profile_repository import (
    PostgresCustomerProfileRepository,
)
from app.infrastructure.database.postgres.bot_flow_repository import PostgresBotFlowRepository
from app.infrastructure.database.postgres.bot_flow_session_repository import (
    PostgresBotFlowSessionRepository,
)
from app.infrastructure.database.postgres.user_repository import PostgresUserRepository
from app.infrastructure.database.postgres.knowledge_chunk_repository import (
    PostgresKnowledgeChunkRepository,
)
from app.infrastructure.database.postgres.knowledge_document_repository import (
    PostgresKnowledgeDocumentRepository,
)
from app.infrastructure.database.postgres.session import (
    create_async_session_factory,
    verify_connection,
)
from app.services.flow_engine import FlowEngine
from app.services.knowledge import KnowledgeService
from app.services.bot_orchestrator import BotOrchestrator
from app.services.bot_runtime import BotRuntimeService
from app.services.realtime import RealtimeService, WebSocketManager


@dataclass(slots=True)
class AppContainer:
    conversation_repository: ConversationRepository
    customer_profile_repository: CustomerProfileRepository
    ai_settings_repository: AISettingsRepository
    conversation_ai_notes_repository: ConversationAINotesRepository
    ai_approval_repository: AIApprovalRepository
    user_repository: UserRepository
    realtime: RealtimePublisher
    ai: AIProvider
    knowledge_document_repository: KnowledgeDocumentRepository
    knowledge_chunk_repository: KnowledgeChunkRepository
    knowledge_service: KnowledgeService
    bot_flow_repository: BotFlowRepository
    bot_flow_session_repository: BotFlowSessionRepository
    flow_engine: FlowEngine
    bot_orchestrator: BotOrchestrator
    bot_runtime: BotRuntimeService
    websocket_manager: WebSocketManager
    channels: dict[Channel, ChannelProvider] = field(default_factory=dict)
    _db_engine: AsyncEngine | None = field(default=None, repr=False)
    _channel_providers: list[ChannelProvider] = field(default_factory=list, repr=False)

    async def shutdown(self) -> None:
        for provider in self._channel_providers:
            close = getattr(provider, "close", None)
            if close is not None:
                await close()

        if self._db_engine is not None:
            await self._db_engine.dispose()

    async def verify_database(self) -> None:
        if self._db_engine is not None:
            await verify_connection(self._db_engine)


def _build_channels(settings: Settings) -> tuple[dict[Channel, ChannelProvider], list[ChannelProvider]]:
    channels: dict[Channel, ChannelProvider] = {}
    providers: list[ChannelProvider] = []

    if settings.instagram_access_token or settings.instagram_verify_token:
        account_id = settings.instagram_account_id or settings.instagram_business_account_id
        instagram = InstagramProvider(
            instagram_access_token=settings.instagram_access_token,
            instagram_account_id=account_id,
            instagram_api_base_url=settings.instagram_api_base_url,
            instagram_api_version=settings.instagram_api_version,
            meta_page_access_token=settings.meta_page_access_token,
            meta_graph_api_base_url=settings.meta_graph_api_base_url,
            meta_graph_api_version=settings.meta_graph_api_version,
        )
        channels[Channel.instagram] = instagram
        providers.append(instagram)

    if (
        settings.meta_page_access_token
        or settings.meta_page_id
        or settings.meta_webhook_verify_token
    ):
        messenger = MessengerProvider(
            meta_page_access_token=settings.meta_page_access_token,
            meta_page_id=settings.meta_page_id,
            meta_graph_api_base_url=settings.meta_graph_api_base_url,
            meta_graph_api_version=settings.meta_graph_api_version,
        )
        channels[Channel.facebook] = messenger
        providers.append(messenger)

    if (
        settings.whatsapp_access_token
        or settings.whatsapp_phone_number_id
        or settings.whatsapp_business_account_id
        or settings.whatsapp_verify_token
    ):
        whatsapp = WhatsAppProvider(
            whatsapp_access_token=settings.whatsapp_access_token,
            whatsapp_business_account_id=settings.whatsapp_business_account_id,
            whatsapp_phone_number_id=settings.whatsapp_phone_number_id,
            meta_graph_api_base_url=settings.meta_graph_api_base_url,
            meta_graph_api_version=settings.meta_graph_api_version,
        )
        channels[Channel.whatsapp] = whatsapp
        providers.append(whatsapp)

    if settings.sms_provider == "demo":
        sms = DemoSMSProvider()
        channels[Channel.sms] = sms
        providers.append(sms)

    if settings.email_provider == "smtp_demo":
        email = SmtpEmailProvider(
            smtp_host=settings.smtp_host,
            smtp_port=settings.smtp_port,
            smtp_username=settings.smtp_username,
            smtp_password=settings.smtp_password,
            smtp_from_email=settings.smtp_from_email,
            smtp_from_name=settings.smtp_from_name,
            smtp_use_tls=settings.smtp_use_tls,
            smtp_use_ssl=settings.smtp_use_ssl,
        )
        channels[Channel.email] = email
        providers.append(email)

    return channels, providers


def build_container(settings: Settings) -> AppContainer:
    db_engine: AsyncEngine | None = None

    if settings.database_provider == "memory":
        conversation_repository = InMemoryConversationRepository()
        customer_profile_repository = InMemoryCustomerProfileRepository()
        ai_settings_repository = InMemoryAISettingsRepository()
        conversation_ai_notes_repository = InMemoryConversationAINotesRepository()
        ai_approval_repository = InMemoryAIApprovalRepository()
        user_repository = InMemoryUserRepository()
        knowledge_document_repository = InMemoryKnowledgeDocumentRepository()
        knowledge_chunk_repository = InMemoryKnowledgeChunkRepository(knowledge_document_repository)
        bot_flow_repository = InMemoryBotFlowRepository()
        bot_flow_session_repository = InMemoryBotFlowSessionRepository()
    elif settings.database_provider == "postgres":
        if not settings.database_url:
            raise ValueError("DATABASE_URL is required when DATABASE_PROVIDER=postgres")

        db_engine, session_factory = create_async_session_factory(
            settings.database_url,
            use_null_pool=settings.app_env == "local",
        )
        conversation_repository = PostgresConversationRepository(session_factory)
        customer_profile_repository = PostgresCustomerProfileRepository(session_factory)
        ai_settings_repository = PostgresAISettingsRepository(session_factory)
        conversation_ai_notes_repository = PostgresConversationAINotesRepository(session_factory)
        ai_approval_repository = PostgresAIApprovalRepository(session_factory)
        user_repository = PostgresUserRepository(session_factory)
        knowledge_document_repository = PostgresKnowledgeDocumentRepository(session_factory)
        knowledge_chunk_repository = PostgresKnowledgeChunkRepository(session_factory)
        bot_flow_repository = PostgresBotFlowRepository(session_factory)
        bot_flow_session_repository = PostgresBotFlowSessionRepository(session_factory)
    else:
        raise NotImplementedError(f"Database provider not implemented yet: {settings.database_provider}")

    if settings.realtime_provider == "memory":
        websocket_manager = WebSocketManager()
        realtime = RealtimeService(websocket_manager)
    else:
        raise NotImplementedError(f"Realtime provider not implemented yet: {settings.realtime_provider}")

    if settings.ai_provider == "mock":
        ai: AIProvider = MockAIProvider()
    elif settings.ai_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when AI_PROVIDER=openai")
        ai = OpenAIProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
    else:
        raise ValueError(
            f"Invalid AI_PROVIDER: {settings.ai_provider!r}. Supported values: mock, openai"
        )

    channels, channel_providers = _build_channels(settings)
    knowledge_service = KnowledgeService(
        document_repository=knowledge_document_repository,
        chunk_repository=knowledge_chunk_repository,
    )
    bot_orchestrator = BotOrchestrator(ai_provider=ai)
    flow_engine = FlowEngine(
        flow_repository=bot_flow_repository,
        session_repository=bot_flow_session_repository,
        ai_provider=ai,
    )
    bot_runtime = BotRuntimeService(
        conversation_repository=conversation_repository,
        ai_settings_repository=ai_settings_repository,
        conversation_ai_notes_repository=conversation_ai_notes_repository,
        customer_profile_repository=customer_profile_repository,
        ai_approval_repository=ai_approval_repository,
        user_repository=user_repository,
        bot_flow_repository=bot_flow_repository,
        bot_flow_session_repository=bot_flow_session_repository,
        flow_engine=flow_engine,
        bot_orchestrator=bot_orchestrator,
        knowledge_service=knowledge_service,
        ai_provider=ai,
        channels=channels,
        realtime=realtime,
    )

    return AppContainer(
        conversation_repository=conversation_repository,
        customer_profile_repository=customer_profile_repository,
        ai_settings_repository=ai_settings_repository,
        conversation_ai_notes_repository=conversation_ai_notes_repository,
        ai_approval_repository=ai_approval_repository,
        user_repository=user_repository,
        realtime=realtime,
        ai=ai,
        knowledge_document_repository=knowledge_document_repository,
        knowledge_chunk_repository=knowledge_chunk_repository,
        knowledge_service=knowledge_service,
        bot_flow_repository=bot_flow_repository,
        bot_flow_session_repository=bot_flow_session_repository,
        flow_engine=flow_engine,
        bot_orchestrator=bot_orchestrator,
        bot_runtime=bot_runtime,
        websocket_manager=websocket_manager,
        channels=channels,
        _db_engine=db_engine,
        _channel_providers=channel_providers,
    )
