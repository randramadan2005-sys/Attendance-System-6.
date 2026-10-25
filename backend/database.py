
import sqlite3
from pathlib import Path

# Database file location
DATABASE_PATH = Path(__file__).parent / "attendance.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with get_connection() as connection:

        # Employees / users table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        connection.execute("""
            CREATE TABLE IF NOT EXISTS attendance_breaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attendance_id INTEGER NOT NULL,
                leave_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expected_return TEXT NOT NULL,
                actual_return TIMESTAMP,
                FOREIGN KEY (attendance_id)
                    REFERENCES attendance(id)
                    ON DELETE CASCADE
            )
        """)


        # Attendance records table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                check_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                check_out TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
    print(f"Database location: {DATABASE_PATH}")
