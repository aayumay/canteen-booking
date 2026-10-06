"""add_pickup_slots

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pickup_slots table
    op.create_table(
        'pickup_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('max_orders', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('current_order_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['vendor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pickup_slots_id'), 'pickup_slots', ['id'], unique=False)
    op.create_index(op.f('ix_pickup_slots_vendor_id'), 'pickup_slots', ['vendor_id'], unique=False)

    # Add pickup_slot_id to orders table
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('pickup_slot_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_orders_pickup_slot_id', 'pickup_slots', ['pickup_slot_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_constraint('fk_orders_pickup_slot_id', type_='foreignkey')
        batch_op.drop_column('pickup_slot_id')

    op.drop_index(op.f('ix_pickup_slots_vendor_id'), table_name='pickup_slots')
    op.drop_index(op.f('ix_pickup_slots_id'), table_name='pickup_slots')
    op.drop_table('pickup_slots')
