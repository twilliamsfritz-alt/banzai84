@echo off
call .venv\Scripts\activate
py backup_db.py
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
py migrate.py
echo Update complete.
pause
