from datetime import datetime
from pathlib import Path
import shutil

BASE = Path(__file__).resolve().parent
DB = BASE / "salespilot.db"
BACKUPS = BASE / "backups"
BACKUPS.mkdir(exist_ok=True)

target = BACKUPS / f"salespilot-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.db"
shutil.copy2(DB, target)
print(f"Backup created: {target}")
