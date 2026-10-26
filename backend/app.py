
import os
from datetime import timedelta

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


app = Flask(__name__)
CORS(app)

# Development key only. Use a private environment variable in deployment.
app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY", "dev-only-change-this-secret"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)

jwt = JWTManager(app)
init_db()


@app.route("/")
def home():
    return jsonify({
        "message": "Attendance System Backend is running!",
        "status": "success"
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "healthy"})


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
                (name, email, password_hash),
            )
    except Exception as error:
        import sqlite3
        if isinstance(error, sqlite3.IntegrityError):
            return jsonify({
                "message": "This email is already registered."
            }), 409
        raise

    return jsonify({"message": "Account created successfully."}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if user is None or not check_password_hash(
        user["password_hash"], password
    ):
        return jsonify({"message": "Invalid email or password."}), 401

    token = create_access_token(identity=str(user["id"]))

    return jsonify({
        "message": "Login successful.",
        "access_token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
        },
    })




@app.route("/api/attendance/check-in", methods=["POST"])
@jwt_required()
def check_in():
    user_id = int(get_jwt_identity())

    with get_connection() as connection:
        active_record = connection.execute(
            """
            SELECT id FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            """,
            (user_id,),
        ).fetchone()

        if active_record:
            return jsonify({
                "message": "You are already checked in."
            }), 409

        cursor = connection.execute(
            """
            INSERT INTO attendance (user_id, check_in)
            VALUES (?, datetime('now', '+3 hours'))
            """,
            (user_id,),
        )

        record_id = cursor.lastrowid

        record = connection.execute(
            "SELECT * FROM attendance WHERE id = ?",
            (record_id,),
        ).fetchone()

    return jsonify({
        "message": "Check-in successful.",
        "record": dict(record),
    }), 201


    cursor = connection.execute(
            """
            INSERT INTO attendance (user_id, check_in)
            VALUES (?, datetime('now', '+3 hours'))
            """,
            (user_id,),
        )

    record_id = cursor.lastrowid

    record = connection.execute(
            "SELECT * FROM attendance WHERE id = ?",
            (record_id,),
        ).fetchone()

    return jsonify({
        "message": "Check-in successful.",
        "record": dict(record),
    }), 201


@app.route("/api/attendance/check-out", methods=["POST"])
@jwt_required()
def check_out():
    user_id = int(get_jwt_identity())

    with get_connection() as connection:
        record = connection.execute(
            """
            SELECT * FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC LIMIT 1
            """,
            (user_id,),
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
            (record["id"], user_id),
        )

        updated_record = connection.execute(
            "SELECT * FROM attendance WHERE id = ?",
            (record["id"],),
        ).fetchone()

    return jsonify({
        "message": "Check-out successful.",
        "record": dict(updated_record),
    })



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
            (user_id,),
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
                (record["id"],),
            ).fetchall()

            result.append({
                "id": record["id"],
                "check_in": record["check_in"],
                "check_out": record["check_out"],
                "breaks": [
                    {
                        "leave_time": item["leave_time"],
                        "expected_return": item["expected_return"],
                        "actual_return": item["actual_return"],
                    }
                    for item in breaks
                ],
            })

    return jsonify({"records": result})




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
            SELECT id FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC LIMIT 1
            """,
            (user_id,),
        ).fetchone()

        if record is None:
            return jsonify({
                "message": "Please check in before leaving."
            }), 409

        active_leave = connection.execute(
            """
            SELECT id FROM attendance_breaks
            WHERE attendance_id = ? AND actual_return IS NULL
            """,
            (record["id"],),
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
            (record["id"], expected_return),
        )

    return jsonify({
        "message": "Temporary leave recorded successfully.",
        "break_id": cursor.lastrowid,
    }), 201


@app.route("/api/attendance/return", methods=["POST"])
@jwt_required()
def return_to_work():
    user_id = int(get_jwt_identity())

    with get_connection() as connection:
        record = connection.execute(
            """
            SELECT id FROM attendance
            WHERE user_id = ? AND check_out IS NULL
            ORDER BY id DESC LIMIT 1
            """,
            (user_id,),
        ).fetchone()

        if record is None:
            return jsonify({
                "message": "No active workday was found."
            }), 409

        active_leave = connection.execute(
            """
            SELECT id FROM attendance_breaks
            WHERE attendance_id = ? AND actual_return IS NULL
            ORDER BY id DESC LIMIT 1
            """,
            (record["id"],),
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
            (active_leave["id"],),
        )

    return jsonify({
        "message": "Return to work recorded successfully."
    })

if __name__ == "__main__":
    app.run(debug=True)
