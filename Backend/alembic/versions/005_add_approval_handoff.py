"""Add approval handoff message setting and message metadata.

Revision ID: 005
Revises: 004
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_HANDOFF = (
    "רגע, אני מעביר את זה לבדיקה של נציג אנושי כדי לוודא שאתה מקבל תשובה מדויקת."
)


def upgrade() -> None:
    op.add_column(
        "ai_settings",
        sa.Column(
            "approval_handoff_message",
            sa.Text(),
            nullable=False,
            server_default=DEFAULT_HANDOFF,
        ),
    )
    op.add_column(
        "messages",
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "ai_approval_requests",
        sa.Column(
            "customer_notified_handoff",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("ai_approval_requests", "customer_notified_handoff")
    op.drop_column("messages", "metadata")
    op.drop_column("ai_settings", "approval_handoff_message")
