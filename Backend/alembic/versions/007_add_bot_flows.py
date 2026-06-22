"""Add bot flow tables.

Revision ID: 007
Revises: 006
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bot_flows",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "trigger_intents",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "definition",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_flows_tenant_id", "bot_flows", ["tenant_id"])

    op.create_table(
        "bot_flow_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("flow_id", sa.String(), nullable=False),
        sa.Column("current_node_id", sa.String(), nullable=True),
        sa.Column("state", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("status", sa.String(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["flow_id"], ["bot_flows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_flow_sessions_tenant_id", "bot_flow_sessions", ["tenant_id"])
    op.create_index("ix_bot_flow_sessions_conversation_id", "bot_flow_sessions", ["conversation_id"])
    op.create_index("ix_bot_flow_sessions_flow_id", "bot_flow_sessions", ["flow_id"])


def downgrade() -> None:
    op.drop_index("ix_bot_flow_sessions_flow_id", table_name="bot_flow_sessions")
    op.drop_index("ix_bot_flow_sessions_conversation_id", table_name="bot_flow_sessions")
    op.drop_index("ix_bot_flow_sessions_tenant_id", table_name="bot_flow_sessions")
    op.drop_table("bot_flow_sessions")
    op.drop_index("ix_bot_flows_tenant_id", table_name="bot_flows")
    op.drop_table("bot_flows")
