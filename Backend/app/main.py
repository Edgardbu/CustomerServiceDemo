from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.v1.router import api_router
from app.core.config import get_settings, validate_bootstrap_settings
from app.core.container import build_container


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    validate_bootstrap_settings(settings)
    container = build_container(settings)

    if settings.database_provider == "postgres":
        try:
            await container.verify_database()
        except Exception as exc:
            await container.shutdown()
            raise RuntimeError(
                "PostgreSQL is not reachable. "
                "Run `docker compose up -d` then `alembic upgrade head`."
            ) from exc

    app.state.container = container

    from app.services.bootstrap import log_bootstrap_startup
    from app.services.user_seed import ensure_demo_users

    await log_bootstrap_startup(
        settings=settings,
        user_repository=container.user_repository,
    )
    await ensure_demo_users(container.user_repository, settings=settings)
    yield
    await container.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    validate_bootstrap_settings(settings)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    async def root():
        return RedirectResponse(url="/docs")

    @app.get("/health", tags=["system"])
    async def health(request: Request):
        db_status = "ok"
        db_detail: str | None = None

        if settings.database_provider == "postgres":
            try:
                await request.app.state.container.verify_database()
            except Exception as exc:
                db_status = "error"
                db_detail = str(exc)

        return {
            "status": "ok" if db_status == "ok" else "degraded",
            "env": settings.app_env,
            "database": settings.database_provider,
            "database_status": db_status,
            "database_detail": db_detail,
            "realtime": settings.realtime_provider,
            "ai": settings.ai_provider,
            "bootstrap_enabled": settings.bootstrap_enabled,
        }

    return app


app = create_app()
