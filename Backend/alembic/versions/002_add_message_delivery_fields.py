"""Add delivery metadata to messages.

Revision ID: 002
Revises: 001
Create Date: 2026-06-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("external_message_id", sa.String(), nullable=True))
    op.add_column("messages", sa.Column("delivery_status", sa.String(), nullable=True))
    op.add_column(
        "messages",
        sa.Column("external_raw_response", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "external_raw_response")
    op.drop_column("messages", "delivery_status")
    op.drop_column("messages", "external_message_id")
