"""Add customer_profiles table.

Revision ID: 003
Revises: 002
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("profile_picture_url", sa.String(), nullable=True),
        sa.Column("raw_profile", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "channel", "external_id", name="uq_customer_profiles_tenant_channel_external"),
    )
    op.create_index("ix_customer_profiles_tenant_id", "customer_profiles", ["tenant_id"])
    op.create_index("ix_customer_profiles_channel", "customer_profiles", ["channel"])
    op.create_index("ix_customer_profiles_external_id", "customer_profiles", ["external_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_profiles_external_id", table_name="customer_profiles")
    op.drop_index("ix_customer_profiles_channel", table_name="customer_profiles")
    op.drop_index("ix_customer_profiles_tenant_id", table_name="customer_profiles")
    op.drop_table("customer_profiles")
