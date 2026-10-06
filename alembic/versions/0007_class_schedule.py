"""add_class_schedule

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'class_schedule_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('class_name', sa.String(length=100), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('location', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_class_schedule_entries_id'), 'class_schedule_entries', ['id'], unique=False)
    op.create_index(op.f('ix_class_schedule_entries_student_id'), 'class_schedule_entries', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_class_schedule_entries_student_id'), table_name='class_schedule_entries')
    op.drop_index(op.f('ix_class_schedule_entries_id'), table_name='class_schedule_entries')
    op.drop_table('class_schedule_entries')
