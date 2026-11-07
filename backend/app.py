
import os
import json
import sqlite3
from datetime import timedelta

from dotenv import load_dotenv
from openai import OpenAI

from flask import Flask, jsonify, request
from flask_cors import CORS

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from werkzeug.security import generate_password_hash, check_password_hash

from database import get_connection, init_db


# =====================================
# 1. INITIALIZATION
# =====================================

load_dotenv()

app = Flask(__name__)

# CORS Configuration
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"]
)

# JWT Configuration
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    "dev-only-change-this-secret"
)

app.config["JWT_TOKEN_LOCATION"] = ["headers"]

app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

jwt = JWTManager(app)


# =====================================
# 2. HOME AND HEALTH
# =====================================

@app.route("/")
def home():
    return jsonify({
        "message": "Attendance System Backend is running!",
        "status": "success"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy"
    })


# =====================================
# 3. SIGN UP
# =====================================

@app.route("/api/signup", methods=["POST"])
def signup():

    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({
            "message": "Name, email and password are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "message": "Password must be at least 8 characters."
        }), 400

    password_hash = generate_password_hash(password)

    try:
        with get_connection() as connection:

            connection.execute(
                """
                INSERT INTO users (name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (name, email, password_hash)
            )

    except sqlite3.IntegrityError:

        return jsonify({
            "message": "This email is already registered."
        }), 409

    return jsonify({
        "message": "Account created successfully."
    }), 201


# =====================================
# 4. LOGIN
# =====================================

@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    with get_connection() as connection:

        user = connection.execute(
            """
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = ?
            """,
            (email,)
        ).fetchone()

    if user is None or not check_password_hash(
        user["password_hash"], password
    ):

        return jsonify({
            "message": "Invalid email or password."
        }), 401

    token = create_access_token(
        identity=str(user["id"])
    )

    return jsonify({
        "message": "Login successful.",
        "access_token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }), 200


# =====================================
# 5. CHECK IN
# =====================================

@app.route("/api/attendance/check-in", methods=["POST"])
@jwt_required()
def check_in():

    user_id = int(get_jwt_identity())

    with get_connection() as connection:

        today_record = connection.execute(
            """
            SELECT id
            FROM attendance
            WHERE user_id = ?
            AND date(check_in) = date('now', '+3 hours')
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        if today_record:

            return jsonify({
                "message": "You have already checked in today."
            }), 409

        cursor = connection.execute(
            """
            INSERT INTO attendance (user_id, check_in)
            VALUES (?, datetime('now', '+3 hours'))
            """,
            (user_id,)
        )

        record_id = cursor.lastrowid

        record = connection.execute(
            """
            SELECT *
            FROM attendance
            WHERE id = ?
            """,
            (record_id,)
        ).fetchone()

    return jsonify({
        "message": "Check-in successful.",
        "record": dict(record)
    }), 201


# =====================================
# 6. CHECK OUT
# =====================================

@app.route("/api/attendance/check-out", methods=["POST"])
@jwt_required()
def check_out():

    user_id = int(get_jwt_identity())

    with get_connection() as connection:

        record = connection.execute(
            """
            SELECT *
            FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        if record is None:

            return jsonify({
                "message": "No active check-in found."
            }), 409

        connection.execute(
            """
            UPDATE attendance
            SET check_out = datetime('now', '+3 hours')
            WHERE id = ? AND user_id = ?
            """,
            (record["id"], user_id)
        )

        updated_record = connection.execute(
            """
            SELECT *
            FROM attendance
            WHERE id = ?
            """,
            (record["id"],)
        ).fetchone()

    return jsonify({
        "message": "Check-out successful.",
        "record": dict(updated_record)
    }), 200


# =====================================
# 7. TEMPORARY LEAVE
# =====================================

@app.route("/api/attendance/leave", methods=["POST"])
@jwt_required()
def leave_work():

    user_id = int(get_jwt_identity())

    data = request.get_json(silent=True) or {}

    expected_return = data.get("expected_return", "").strip()

    if not expected_return:

        return jsonify({
            "message": "Please select your expected return time."
        }), 400

    with get_connection() as connection:

        record = connection.execute(
            """
            SELECT id
            FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        if record is None:

            return jsonify({
                "message": "Please check in before leaving."
            }), 409

        active_leave = connection.execute(
            """
            SELECT id
            FROM attendance_breaks
            WHERE attendance_id = ?
            AND actual_return IS NULL
            """,
            (record["id"],)
        ).fetchone()

        if active_leave:

            return jsonify({
                "message": "You are already on temporary leave."
            }), 409

        cursor = connection.execute(
            """
            INSERT INTO attendance_breaks
            (attendance_id, leave_time, expected_return)
            VALUES (?, datetime('now', '+3 hours'), ?)
            """,
            (record["id"], expected_return)
        )

        break_id = cursor.lastrowid

    return jsonify({
        "message": "Temporary leave recorded successfully.",
        "break_id": break_id
    }), 201


# =====================================
# 8. RETURN TO WORK
# =====================================

@app.route("/api/attendance/return", methods=["POST"])
@jwt_required()
def return_to_work():

    user_id = int(get_jwt_identity())

    with get_connection() as connection:

        record = connection.execute(
            """
            SELECT id
            FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        if record is None:

            return jsonify({
                "message": "No active workday was found."
            }), 409

        active_leave = connection.execute(
            """
            SELECT id
            FROM attendance_breaks
            WHERE attendance_id = ?
            AND actual_return IS NULL
            ORDER BY id DESC
            LIMIT 1
            """,
            (record["id"],)
        ).fetchone()

        if active_leave is None:

            return jsonify({
                "message": "You are not currently on temporary leave."
            }), 409

        connection.execute(
            """
            UPDATE attendance_breaks
            SET actual_return = datetime('now', '+3 hours')
            WHERE id = ?
            """,
            (active_leave["id"],)
        )

    return jsonify({
        "message": "Return to work recorded successfully."
    }), 200


# =====================================
# 9. ATTENDANCE HISTORY
# =====================================

@app.route("/api/attendance", methods=["GET"])
@jwt_required()
def attendance_history():

    user_id = int(get_jwt_identity())

    with get_connection() as connection:

        records = connection.execute(
            """
            SELECT id, check_in, check_out
            FROM attendance
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,)
        ).fetchall()

        result = []

        for record in records:

            breaks = connection.execute(
                """
                SELECT leave_time, expected_return, actual_return
                FROM attendance_breaks
                WHERE attendance_id = ?
                ORDER BY id
                """,
                (record["id"],)
            ).fetchall()

            result.append({
                "id": record["id"],
                "check_in": record["check_in"],
                "check_out": record["check_out"],

                "breaks": [
                    {
                        "leave_time": item["leave_time"],
                        "expected_return": item["expected_return"],
                        "actual_return": item["actual_return"]
                    }
                    for item in breaks
                ]
            })

    return jsonify({
        "records": result
    }), 200


# =====================================
# 10. AI ATTENDANCE SUMMARY
# =====================================

@app.route("/api/ai/attendance-summary", methods=["POST"])
@jwt_required()
def ai_attendance_summary():

    try:

        user_id = int(get_jwt_identity())

        with get_connection() as connection:

            employee = connection.execute(
                """
                SELECT name
                FROM users
                WHERE id = ?
                """,
                (user_id,)
            ).fetchone()

            if not employee:

                return jsonify({
                    "error": "Employee not found."
                }), 404

            records = connection.execute(
                """
                SELECT id, check_in, check_out
                FROM attendance
                WHERE user_id = ?
                ORDER BY check_in DESC
                LIMIT 100
                """,
                (user_id,)
            ).fetchall()

            attendance_data = []

            for record in records:

                breaks = connection.execute(
                    """
                    SELECT leave_time, expected_return, actual_return
                    FROM attendance_breaks
                    WHERE attendance_id = ?
                    ORDER BY id
                    """,
                    (record["id"],)
                ).fetchall()

                attendance_data.append({
                    "check_in": record["check_in"],
                    "check_out": record["check_out"],
                    "breaks": [
                        {
                            "leave_time": item["leave_time"],
                            "expected_return": item["expected_return"],
                            "actual_return": item["actual_return"]
                        }
                        for item in breaks
                    ]
                })

        if not attendance_data:

            return jsonify({
                "summary": "No attendance records found."
            }), 200

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:

            return jsonify({
                "error": "OpenAI API key is missing. Please check your .env file."
            }), 503

        client = OpenAI(api_key=api_key)

        prompt = f"""
You are an employee attendance report assistant.

Employee name: {employee["name"]}

Official working hours: 9:00 AM to 5:00 PM.
Allowed late grace period: 15 minutes.

Attendance records:
{json.dumps(attendance_data, indent=2, ensure_ascii=False)}

Task:
Analyze the employee attendance records and prepare a short,
professional attendance report.

Include:
1. Total attendance records.
2. Late arrivals.
3. Missing check-out records.
4. Temporary leave information.
5. Expected and actual return times.
6. A short overall attendance summary.

Important:
- Use only the provided data.
- Do not invent missing information.
- Do not count missing values as actual times.
- Clearly mention if information is unavailable.
- Use clear and professional language.
"""

        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
            input=prompt
        )

        return jsonify({
            "summary": response.output_text
        }), 200

    except Exception as error:

        print("AI Summary Error:", repr(error))

        return jsonify({
            "error": str(error)
        }), 500


# =====================================
# 11. RUN FLASK SERVER
# =====================================

if __name__ == "__main__":

    init_db()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
