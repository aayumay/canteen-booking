"""add_wallet_and_ledger

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add wallet columns to users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('wallet_balance', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False))
        batch_op.add_column(sa.Column('low_balance_threshold', sa.Numeric(precision=10, scale=2), server_default='50.00', nullable=False))

    # Add payment_method to orders table
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('payment_method', sa.String(length=50), server_default='pay_at_counter', nullable=False))

    # Create wallet_transactions table
    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('type', sa.Enum('topup', 'order_payment', 'refund', 'admin_adjustment', 'meal_plan_purchase', name='wallettransactiontype'), nullable=False),
        sa.Column('related_order_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('balance_after', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['related_order_id'], ['orders.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wallet_transactions_id'), 'wallet_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_wallet_transactions_related_order_id'), 'wallet_transactions', ['related_order_id'], unique=False)
    op.create_index(op.f('ix_wallet_transactions_student_id'), 'wallet_transactions', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_wallet_transactions_student_id'), table_name='wallet_transactions')
    op.drop_index(op.f('ix_wallet_transactions_related_order_id'), table_name='wallet_transactions')
    op.drop_index(op.f('ix_wallet_transactions_id'), table_name='wallet_transactions')
    op.drop_table('wallet_transactions')

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('payment_method')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('low_balance_threshold')
        batch_op.drop_column('wallet_balance')
