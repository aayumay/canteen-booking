import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger("canteen.db.migrate")

SQLITE_COLUMNS_SPEC = {
    "users": [
        ("wallet_balance", "NUMERIC(10, 2) DEFAULT 0.0 NOT NULL"),
        ("low_balance_threshold", "NUMERIC(10, 2) DEFAULT 50.0 NOT NULL"),
        ("allergen_filters", "VARCHAR(500) NULL"),
        ("hostel_block", "VARCHAR(100) NULL"),
        ("department", "VARCHAR(100) NULL"),
        ("leaderboard_opt_in", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("shop_name", "VARCHAR(255) NULL"),
        ("is_shop_open", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("is_approved", "BOOLEAN DEFAULT 1 NOT NULL"),
        ("stall_photo_url", "VARCHAR(1000) NULL"),
    ],
    "orders": [
        ("pickup_slot_id", "INTEGER NULL"),
        ("rejection_reason", "VARCHAR(500) NULL"),
        ("cutlery_needed", "BOOLEAN DEFAULT 1 NOT NULL"),
        ("reusable_container", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("container_discount", "NUMERIC(10, 2) DEFAULT 0.0 NOT NULL"),
        ("picked_up_at", "DATETIME NULL"),
        ("picked_up_confirmed_by", "INTEGER NULL"),
    ],
    "menu_items": [
        ("calories", "INTEGER NULL"),
        ("protein_g", "NUMERIC(6, 1) NULL"),
        ("carbs_g", "NUMERIC(6, 1) NULL"),
        ("fat_g", "NUMERIC(6, 1) NULL"),
        ("allergens", "VARCHAR(500) NULL"),
        ("is_vegan", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("is_flash_discount", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("flash_discount_percent", "INTEGER DEFAULT 0 NOT NULL"),
    ],
}


def sync_sqlite_columns(engine: Engine) -> None:
    """
    Safely inspects existing SQLite tables and adds any newly introduced
    columns via ALTER TABLE to guarantee smooth local development without
    stale schema crashes.
    """
    if not str(engine.url).startswith("sqlite"):
        return

    with engine.connect() as conn:
        for table_name, columns in SQLITE_COLUMNS_SPEC.items():
            # Check if table exists
            table_check = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table"),
                {"table": table_name},
            ).scalar()

            if not table_check:
                continue

            # Fetch existing columns
            existing_cols_rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            existing_col_names = {row[1] for row in existing_cols_rows}

            for col_name, col_type_sql in columns:
                if col_name not in existing_col_names:
                    logger.info("Auto-migrating SQLite table '%s': adding column '%s'", table_name, col_name)
                    try:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type_sql}"))
                        conn.commit()
                    except Exception as e:
                        logger.warning("Could not auto-add column %s to %s: %s", col_name, table_name, e)
