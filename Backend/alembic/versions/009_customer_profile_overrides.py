"""Add agent-editable customer profile override fields.

Revision ID: 009
Revises: 008
Create Date: 2026-06-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customer_profiles", sa.Column("agent_label", sa.String(), nullable=True))
    op.add_column("customer_profiles", sa.Column("agent_notes", sa.Text(), nullable=True))
    op.add_column(
        "customer_profiles",
        sa.Column(
            "profile_overridden",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("updated_by_user_id", sa.String(), nullable=True),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_profiles", "last_synced_at")
    op.drop_column("customer_profiles", "updated_by_user_id")
    op.drop_column("customer_profiles", "profile_overridden")
    op.drop_column("customer_profiles", "agent_notes")
    op.drop_column("customer_profiles", "agent_label")
