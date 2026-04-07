"""
migrate_add_dataset_type.py
Adds the dataset_type column to the evaluations table (idempotent).
"""
import sqlite3, os, sys

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # Check existing columns
    cur.execute("PRAGMA table_info(evaluations)")
    cols = {row[1] for row in cur.fetchall()}

    if "dataset_type" not in cols:
        cur.execute("ALTER TABLE evaluations ADD COLUMN dataset_type TEXT")
        print("[OK] Added column: dataset_type")
    else:
        print("[SKIP] Column dataset_type already exists")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
