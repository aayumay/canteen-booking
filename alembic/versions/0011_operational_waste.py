"""add_operational_waste_and_flash_discounts
 
Revision ID: 0011
Revises: 0010
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.add_column(sa.Column('is_flash_discount', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        batch_op.add_column(sa.Column('flash_discount_percent', sa.Integer(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.drop_column('flash_discount_percent')
        batch_op.drop_column('is_flash_discount')
