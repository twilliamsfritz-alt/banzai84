from app import init_db

if __name__ == "__main__":
    init_db(force_reset=False)
    print("Migrations applied / schema ensured.")
