from fastapi import APIRouter

from app.api.v1.routes import (
    ai,
    bootstrap,
    bot,
    conversations,
    customer_profiles,
    demo_channels,
    integrations,
    knowledge,
    tenants,
    users,
    webhooks,
    ws,
)

api_router = APIRouter()
api_router.include_router(bootstrap.router, prefix="/bootstrap", tags=["bootstrap"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(
    customer_profiles.router,
    prefix="/customer-profiles",
    tags=["customer-profiles"],
)
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(bot.router, prefix="/bot", tags=["bot"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(demo_channels.router, prefix="/demo/channels", tags=["demo"])
api_router.include_router(ws.router, tags=["realtime"])
