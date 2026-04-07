"""
One-time migration: add the 5 DeepEval metric columns to the evaluations table.
Run from the backend directory:  python migrate_add_metrics.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

NEW_COLUMNS = [
    ("accuracy",              "REAL"),
    ("relevance_score",       "REAL"),
    ("factuality_score",      "REAL"),
    ("toxicity_score",        "REAL"),
    ("instruction_following", "REAL"),
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # Get existing columns
    cur.execute("PRAGMA table_info(evaluations)")
    existing = {row[1] for row in cur.fetchall()}

    added = []
    for col_name, col_type in NEW_COLUMNS:
        if col_name not in existing:
            cur.execute(f"ALTER TABLE evaluations ADD COLUMN {col_name} {col_type}")
            added.append(col_name)
            print(f"  [+] Added column: {col_name}")
        else:
            print(f"  [-] Already exists: {col_name}")

    conn.commit()
    conn.close()
    print(f"\nMigration complete. {len(added)} column(s) added.")

if __name__ == "__main__":
    migrate()
