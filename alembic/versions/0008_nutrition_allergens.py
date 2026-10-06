"""add_nutrition_and_allergens

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nutrition columns to menu_items table
    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.add_column(sa.Column('calories', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('protein_g', sa.Numeric(precision=6, scale=1), nullable=True))
        batch_op.add_column(sa.Column('carbs_g', sa.Numeric(precision=6, scale=1), nullable=True))
        batch_op.add_column(sa.Column('fat_g', sa.Numeric(precision=6, scale=1), nullable=True))
        batch_op.add_column(sa.Column('allergens', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('is_vegan', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # Add allergen_filters to users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('allergen_filters', sa.String(length=500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('allergen_filters')

    with op.batch_alter_table('menu_items') as batch_op:
        batch_op.drop_column('is_vegan')
        batch_op.drop_column('allergens')
        batch_op.drop_column('fat_g')
        batch_op.drop_column('carbs_g')
        batch_op.drop_column('protein_g')
        batch_op.drop_column('calories')
