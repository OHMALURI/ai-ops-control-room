"""
migrate.py — One-shot schema migration for app.db.
Run once after a git pull that adds new model columns:
    python migrate.py
"""

import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.db")

MIGRATIONS = [
    # (table, column, definition)
    ("users",    "force_password_reset", "INTEGER NOT NULL DEFAULT 0"),
    ("services", "base_url",             "TEXT"),          # added alongside force_password_reset
]

def existing_columns(cur, table):
    return {row[1] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()}

def run():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    applied = []
    skipped = []

    for table, col, definition in MIGRATIONS:
        cols = existing_columns(cur, table)
        if col not in cols:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
            applied.append(f"{table}.{col}")
        else:
            skipped.append(f"{table}.{col}")

    con.commit()
    con.close()

    if applied:
        print("[OK] Applied migrations:")
        for m in applied:
            print(f"    + {m}")
    if skipped:
        print("[SKIP] Already present (skipped):")
        for m in skipped:
            print(f"    - {m}")
    print("Done.")

if __name__ == "__main__":
    run()
