"""menu item ingredients, fiber and serving size

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-29 00:00:00.000000

Extends the nutrition block added in 0008. calories/protein_g/carbs_g/fat_g
already exist and are reused as-is; this adds only what is missing:

  - ingredients   free-text list as the vendor typed it (no ingredient master
                  table, deliberately)
  - serving_size  context for the macro numbers
  - fiber_g       the remaining common macro

All three are nullable, and no existing row gets a backfilled value: an item
with no vendor-entered nutrition data must keep showing no nutrition section
rather than start showing zeros that look measured.

macro_percentages is intentionally absent from this migration - it is derived
on read in the response schema, so there is nothing to store.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("menu_items") as batch_op:
        batch_op.add_column(sa.Column("ingredients", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("serving_size", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("fiber_g", sa.Numeric(precision=6, scale=1), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("menu_items") as batch_op:
        batch_op.drop_column("fiber_g")
        batch_op.drop_column("serving_size")
        batch_op.drop_column("ingredients")
