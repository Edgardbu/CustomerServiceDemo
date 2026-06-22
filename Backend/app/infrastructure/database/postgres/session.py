from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool


def create_async_session_factory(
    database_url: str,
    *,
    use_null_pool: bool = False,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    engine_kwargs: dict = {"echo": False}
    if use_null_pool:
        # Avoids hung reloads when using uvicorn --reload with PostgreSQL.
        engine_kwargs["poolclass"] = NullPool

    engine = create_async_engine(database_url, **engine_kwargs)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


async def verify_connection(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
