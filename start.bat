@echo off
py -m venv .venv
call .venv\Scripts\activate
py -m pip install -r requirements.txt
py migrate.py
py app.py
