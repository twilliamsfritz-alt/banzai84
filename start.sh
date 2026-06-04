#!/usr/bin/env bash
set -e
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python migrate.py
python app.py
