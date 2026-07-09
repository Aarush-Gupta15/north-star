"""incidents table

Revision ID: 0002_incidents
Revises: 0001_initial
Create Date: 2026-07-07
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_incidents"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_label", sa.String(length=255)),
        sa.Column("site", sa.String(length=255)),
        sa.Column("action", sa.String(length=32), server_default="sent"),
        sa.Column("risk_score", sa.Float(), server_default="0"),
        sa.Column("risk_level", sa.String(length=16), server_default="low"),
        sa.Column("entity_count", sa.Integer(), server_default="0"),
        sa.Column("findings_summary", postgresql.JSONB(), server_default="[]"),
        sa.Column("masked_snippet", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_incidents_owner_id", "incidents", ["owner_id"])
    op.create_index("ix_incidents_site", "incidents", ["site"])


def downgrade() -> None:
    op.drop_table("incidents")
