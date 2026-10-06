"""add_vendor_approval_and_stall_photo

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('is_approved', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        batch_op.add_column(sa.Column('stall_photo_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('stall_photo_url')
        batch_op.drop_column('is_approved')
