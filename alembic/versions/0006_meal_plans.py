"""add_meal_plans

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create meal_plans table
    op.create_table(
        'meal_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_meals', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('validity_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['vendor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_plans_id'), 'meal_plans', ['id'], unique=False)
    op.create_index(op.f('ix_meal_plans_vendor_id'), 'meal_plans', ['vendor_id'], unique=False)

    # Create meal_plan_subscriptions table
    op.create_table(
        'meal_plan_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('meal_plan_id', sa.Integer(), nullable=False),
        sa.Column('meals_remaining', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['meal_plan_id'], ['meal_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_plan_subscriptions_id'), 'meal_plan_subscriptions', ['id'], unique=False)
    op.create_index(op.f('ix_meal_plan_subscriptions_student_id'), 'meal_plan_subscriptions', ['student_id'], unique=False)
    op.create_index(op.f('ix_meal_plan_subscriptions_meal_plan_id'), 'meal_plan_subscriptions', ['meal_plan_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_meal_plan_subscriptions_meal_plan_id'), table_name='meal_plan_subscriptions')
    op.drop_index(op.f('ix_meal_plan_subscriptions_student_id'), table_name='meal_plan_subscriptions')
    op.drop_index(op.f('ix_meal_plan_subscriptions_id'), table_name='meal_plan_subscriptions')
    op.drop_table('meal_plan_subscriptions')

    op.drop_index(op.f('ix_meal_plans_vendor_id'), table_name='meal_plans')
    op.drop_index(op.f('ix_meal_plans_id'), table_name='meal_plans')
    op.drop_table('meal_plans')
