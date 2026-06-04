#!/usr/bin/env bash
set -e
source .venv/bin/activate
python backup_db.py
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python migrate.py
echo "Update complete."
