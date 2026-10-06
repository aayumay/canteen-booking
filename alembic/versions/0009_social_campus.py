"""add_social_campus_fields

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('hostel_block', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('department', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('leaderboard_opt_in', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('leaderboard_opt_in')
        batch_op.drop_column('department')
        batch_op.drop_column('hostel_block')
