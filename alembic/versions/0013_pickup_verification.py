"""add_pickup_verification_audit

Relaxes the global uniqueness of orders.pickup_token and records who confirmed
each handover. Pickup codes are now only unique among a given vendor's active
orders (placed/accepted/preparing/ready), so two vendors may hold the same code
and a code becomes reusable once every order carrying it is closed out.

Scope note: this project only runs Alembic against PostgreSQL. Revision 0001
emits a Postgres-only `DO $$ ... $$` block, so the chain cannot execute on
SQLite at all; local/dev SQLite databases are built by
`Base.metadata.create_all` + `app.db.auto_migrate.sync_sqlite_columns`, both of
which pick up the columns and the relaxed constraint automatically.

Uniqueness is now enforced in the application layer
(`app/crud/order.py::_generate_unique_pickup_token`) rather than by the
database, because "unique among a vendor's *active* orders" is not expressible
as a portable unique constraint. The composite index added below keeps that
lookup fast.

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None

# 0001 created an unnamed UniqueConstraint('pickup_token'), which PostgreSQL
# auto-names `<table>_<column>_key`.
PG_TOKEN_UNIQUE_CONSTRAINT = 'orders_pickup_token_key'


def upgrade() -> None:
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('picked_up_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('picked_up_confirmed_by', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_orders_picked_up_confirmed_by_users',
            'users',
            ['picked_up_confirmed_by'],
            ['id'],
        )

    # 0001 also created a separate UNIQUE index over the same column.
    op.drop_index(op.f('ix_orders_pickup_token'), table_name='orders')
    op.drop_constraint(PG_TOKEN_UNIQUE_CONSTRAINT, 'orders', type_='unique')

    # Supports the (vendor, token) and (vendor, token, status) lookups.
    op.create_index(
        'ix_orders_vendor_token_status',
        'orders',
        ['vendor_id', 'pickup_token', 'status'],
        unique=False,
    )
    op.create_index(
        op.f('ix_orders_picked_up_confirmed_by'),
        'orders',
        ['picked_up_confirmed_by'],
        unique=False,
    )


def downgrade() -> None:
    # Global uniqueness is no longer guaranteed once codes are shared, so
    # collapse duplicates (keeping the oldest row per code) first.
    op.execute(
        """
        DELETE FROM orders
        WHERE id NOT IN (SELECT MIN(id) FROM orders GROUP BY pickup_token)
        """
    )

    op.drop_index('ix_orders_vendor_token_status', table_name='orders')
    op.drop_index(op.f('ix_orders_picked_up_confirmed_by'), table_name='orders')

    op.create_index(op.f('ix_orders_pickup_token'), 'orders', ['pickup_token'], unique=True)
    op.create_unique_constraint(PG_TOKEN_UNIQUE_CONSTRAINT, 'orders', ['pickup_token'])

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_constraint('fk_orders_picked_up_confirmed_by_users', type_='foreignkey')
        batch_op.drop_column('picked_up_confirmed_by')
        batch_op.drop_column('picked_up_at')
