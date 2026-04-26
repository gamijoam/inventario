#!/usr/bin/env python3
import psycopg2
conn = psycopg2.connect(host="db_qa", port=5432, database="invensoft_qa", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute("SELECT id, status FROM restaurante.cash_sessions WHERE status = 'OPEN'")
rows = cur.fetchall()
print("Open cash sessions:", len(rows))
for r in rows:
    print("  - ID:", r[0], "status:", r[1])
conn.close()