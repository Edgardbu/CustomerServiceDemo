"""Add AI autoreply tables and conversation/message AI fields.

Revision ID: 004
Revises: 003
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("ai_auto_reply_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column("conversations", sa.Column("ai_status", sa.String(), nullable=True))

    op.add_column(
        "messages",
        sa.Column("ai_generated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("messages", sa.Column("ai_approval_request_id", sa.String(), nullable=True))

    op.create_table(
        "ai_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("auto_reply_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("business_context", sa.Text(), server_default="", nullable=False),
        sa.Column("ai_purpose", sa.Text(), server_default="", nullable=False),
        sa.Column("faq", sa.Text(), server_default="", nullable=False),
        sa.Column("approval_rules", sa.Text(), server_default="", nullable=False),
        sa.Column("tone_instructions", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", name="uq_ai_settings_tenant_id"),
    )
    op.create_index("ix_ai_settings_tenant_id", "ai_settings", ["tenant_id"])

    op.create_table(
        "conversation_ai_notes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "conversation_id", name="uq_conversation_ai_notes"),
    )
    op.create_index("ix_conversation_ai_notes_tenant_id", "conversation_ai_notes", ["tenant_id"])
    op.create_index("ix_conversation_ai_notes_conversation_id", "conversation_ai_notes", ["conversation_id"])

    op.create_table(
        "ai_approval_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("customer_message_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("customer_summary", sa.Text(), nullable=False),
        sa.Column("ai_reasoning_summary", sa.Text(), nullable=False),
        sa.Column("suggested_response", sa.Text(), nullable=False),
        sa.Column("suggested_action_type", sa.String(), nullable=False),
        sa.Column("risk_level", sa.String(), nullable=False),
        sa.Column("requires_approval", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("agent_edit", sa.Text(), nullable=True),
        sa.Column("final_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_approval_requests_tenant_id", "ai_approval_requests", ["tenant_id"])
    op.create_index("ix_ai_approval_requests_conversation_id", "ai_approval_requests", ["conversation_id"])
    op.create_index("ix_ai_approval_requests_status", "ai_approval_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ai_approval_requests_status", table_name="ai_approval_requests")
    op.drop_index("ix_ai_approval_requests_conversation_id", table_name="ai_approval_requests")
    op.drop_index("ix_ai_approval_requests_tenant_id", table_name="ai_approval_requests")
    op.drop_table("ai_approval_requests")
    op.drop_index("ix_conversation_ai_notes_conversation_id", table_name="conversation_ai_notes")
    op.drop_index("ix_conversation_ai_notes_tenant_id", table_name="conversation_ai_notes")
    op.drop_table("conversation_ai_notes")
    op.drop_index("ix_ai_settings_tenant_id", table_name="ai_settings")
    op.drop_table("ai_settings")
    op.drop_column("messages", "ai_approval_request_id")
    op.drop_column("messages", "ai_generated")
    op.drop_column("conversations", "ai_status")
    op.drop_column("conversations", "ai_auto_reply_enabled")
