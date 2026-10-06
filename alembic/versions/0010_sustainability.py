"""add_sustainability_fields
 
Revision ID: 0010
Revises: 0009
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('cutlery_needed', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        batch_op.add_column(sa.Column('reusable_container', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        batch_op.add_column(sa.Column('container_discount', sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text('0.0')))


def downgrade() -> None:
    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('container_discount')
        batch_op.drop_column('reusable_container')
        batch_op.drop_column('cutlery_needed')
