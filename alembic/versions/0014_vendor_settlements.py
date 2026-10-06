"""add_vendor_settlements

Adds the vendor settlement ledger: one row per wallet-paid order recording what
that vendor is owed, so a student paying by wallet no longer leaves a vendor
with no record of the amount owed to them.

Scope note: as in 0013, Alembic only runs against PostgreSQL here (0001 emits a
Postgres-only `DO $$ ... $$` block, so the chain cannot execute on SQLite).
Local/dev SQLite databases are built by `Base.metadata.create_all`, which picks
up this whole table automatically, so there is nothing to add to
`app/db/auto_migrate.py` - that module only backfills *columns* onto existing
tables and cannot create tables or enums.

`amount` is a snapshot of `orders.total_amount` taken at order time and is never
recalculated, because menu prices may change after the fact.

`status` carries three values rather than two. The spec named pending/settled,
but a rejected or cancelled order must not leave a phantom pending amount the
vendor is never actually owed. Deleting the row would have satisfied that but
destroyed the audit trail, so rejected rows are retained as `voided` with a
`voided_at` stamp instead.

`order_id` is UNIQUE across all three statuses (not just pending), so an order
can never accrue two settlement rows even if voiding and re-ordering paths are
ever added later.

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN CREATE TYPE settlementstatus AS ENUM "
        "('pending', 'settled', 'voided'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.create_table(
        'vendor_settlements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM(
                'pending', 'settled', 'voided',
                name='settlementstatus',
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('settled_by', sa.Integer(), nullable=True),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['settled_by'], ['users.id']),
        sa.ForeignKeyConstraint(['vendor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
    )

    op.create_index(
        op.f('ix_vendor_settlements_id'),
        'vendor_settlements',
        ['id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_vendor_settlements_order_id'),
        'vendor_settlements',
        ['order_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_vendor_settlements_settled_by'),
        'vendor_settlements',
        ['settled_by'],
        unique=False,
    )
    op.create_index(
        op.f('ix_vendor_settlements_status'),
        'vendor_settlements',
        ['status'],
        unique=False,
    )
    op.create_index(
        op.f('ix_vendor_settlements_vendor_id'),
        'vendor_settlements',
        ['vendor_id'],
        unique=False,
    )
    # Covers every vendor-summary aggregate, which always filters on
    # vendor_id + status and sums amount.
    op.create_index(
        'ix_vendor_settlements_vendor_status',
        'vendor_settlements',
        ['vendor_id', 'status'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_vendor_settlements_vendor_status', table_name='vendor_settlements')
    op.drop_index(op.f('ix_vendor_settlements_vendor_id'), table_name='vendor_settlements')
    op.drop_index(op.f('ix_vendor_settlements_status'), table_name='vendor_settlements')
    op.drop_index(op.f('ix_vendor_settlements_settled_by'), table_name='vendor_settlements')
    op.drop_index(op.f('ix_vendor_settlements_order_id'), table_name='vendor_settlements')
    op.drop_index(op.f('ix_vendor_settlements_id'), table_name='vendor_settlements')

    op.drop_table('vendor_settlements')
    op.execute('DROP TYPE IF EXISTS settlementstatus')
