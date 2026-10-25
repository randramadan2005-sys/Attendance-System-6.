

/* Login Form - Backend API */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        let message = document.getElementById("loginMessage");

        if (!message) {
            message = document.createElement("p");
            message.id = "loginMessage";
            loginForm.appendChild(message);
        }

        message.textContent = "Logging in...";
        message.style.color = "#B59A52";

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                message.textContent =
                    data.message || "Login failed. Please try again.";
                message.style.color = "#D9534F";
                return;
            }

            // Save login information
            localStorage.setItem("employeeEmail", data.user.email);
            localStorage.setItem("accessToken", data.access_token);
            localStorage.setItem("employeeName", data.user.name);

            message.textContent = "Login successful! Opening Dashboard...";
            message.style.color = "#B59A52";

            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Login error:", error);

            message.textContent =
                "Cannot connect to the backend. Make sure Flask is running.";
            message.style.color = "#D9534F";
        }
    });
}



/* Attendance System
   Shared by Attendance and History pages */

const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");

const recordsTable = document.getElementById("recordsTable");
const attendanceMessage = document.getElementById("attendanceMessage");

const leaveWorkBtn = document.getElementById("leaveWorkBtn");
const returnWorkBtn = document.getElementById("returnWorkBtn");

const expectedReturnInput =
    document.getElementById("expectedReturnTime");

const leaveMessage = document.getElementById("leaveMessage");

const email = localStorage.getItem("employeeEmail");

let records = [];

try {
    records = JSON.parse(
        localStorage.getItem("attendanceRecords") || "[]"
    );

    if (!Array.isArray(records)) {
        records = [];
    }
} catch (error) {
    records = [];
}


/* Current date */

function today() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* Current time */

function currentTime() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}


/* Save records without deleting existing data */

function saveRecords() {
    localStorage.setItem(
        "attendanceRecords",
        JSON.stringify(records)
    );
}


/* Find today's attendance record for this employee */

function getTodayRecord() {
    return records.find(record =>
        record.email === email &&
        record.date === today()
    );
}


/* Display attendance history on history.html */


/* =========================
   Load Attendance History
   From Backend API
   ========================= */

async function renderRecords() {
    if (!recordsTable) {
        return;
    }

    recordsTable.replaceChildren();

    const token = localStorage.getItem("accessToken");

    if (!token) {
        showHistoryMessage("Please log in to view attendance history.");
        return;
    }

    // Format date
    const formatDate = value => {
        if (!value) return "--";
        return value.split(" ")[0];
    };

    // Format time
    const formatTime = value => {
        if (!value) return "--";
        return value.split(" ")[1] || value;
    };

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/attendance",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showHistoryMessage(
                data.message || "Could not load attendance history."
            );
            return;
        }

        const employeeRecords = data.records || [];

        if (employeeRecords.length === 0) {
            showHistoryMessage("No attendance records yet.");
            return;
        }

        employeeRecords.forEach(record => {
            const breaks = record.breaks || [];

            // If there are no breaks, display one row
            if (breaks.length === 0) {
                const row = document.createElement("tr");

                const values = [
                    formatDate(record.check_in),
                    formatTime(record.check_in),
                    "--",
                    "--",
                    "--",
                    formatTime(record.check_out)
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                recordsTable.appendChild(row);
                return;
            }

            // Display a row for each temporary leave
            breaks.forEach(breakRecord => {
                const row = document.createElement("tr");

                const values = [
                    formatDate(record.check_in),
                    formatTime(record.check_in),
                    formatTime(breakRecord.leave_time),
                    breakRecord.expected_return || "--",
                    formatTime(breakRecord.actual_return),
                    formatTime(record.check_out)
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                recordsTable.appendChild(row);
            });
        });

    } catch (error) {
        console.error("History error:", error);
        showHistoryMessage("Cannot connect to the backend.");
    }
}



/* Check In */


/* Check In - Backend API */

if (checkInBtn) {
    checkInBtn.addEventListener("click", async function () {
        const token = localStorage.getItem("accessToken");

        if (!token) {
            attendanceMessage.textContent = "Please log in first.";
            return;
        }

        attendanceMessage.textContent = "Recording check-in...";

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/attendance/check-in",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                attendanceMessage.textContent =
                    data.message || "Check-in failed.";
                return;
            }

            attendanceMessage.textContent =
                "Check-in recorded successfully!";
        } catch (error) {
            console.error("Check-in error:", error);
            attendanceMessage.textContent =
                "Cannot connect to the backend.";
        }
    });
}


/*Check Out */


/* Check Out - Backend API */

if (checkOutBtn) {
    checkOutBtn.addEventListener("click", async function () {
        const token = localStorage.getItem("accessToken");

        if (!token) {
            attendanceMessage.textContent = "Please log in first.";
            return;
        }

        attendanceMessage.textContent = "Recording check-out...";

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/attendance/check-out",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                attendanceMessage.textContent =
                    data.message || "Check-out failed.";
                return;
            }

            attendanceMessage.textContent =
                "Check-out recorded successfully!";
        } catch (error) {
            console.error("Check-out error:", error);
            attendanceMessage.textContent =
                "Cannot connect to the backend.";
        }
    });
}



/* Temporary Leave */


if (leaveWorkBtn) {
    leaveWorkBtn.addEventListener("click", async function () {
        const token = localStorage.getItem("accessToken");
        const expectedReturn = expectedReturnInput?.value || "";

        if (!token) {
            leaveMessage.textContent = "Please log in first.";
            return;
        }

        if (!expectedReturn) {
            leaveMessage.textContent =
                "Please select your expected return time.";
            return;
        }

        if (expectedReturn <= currentTime()) {
            leaveMessage.textContent =
                "Return time must be later than now.";
            return;
        }

        leaveMessage.textContent = "Recording temporary leave...";

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/attendance/leave",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        expected_return: expectedReturn
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                leaveMessage.textContent =
                    data.message || "Could not record leave.";
                return;
            }

            leaveMessage.textContent = data.message;

            if (expectedReturnInput) {
                expectedReturnInput.value = "";
            }

            renderRecords();
        } catch (error) {
            console.error("Leave error:", error);
            leaveMessage.textContent =
                "Cannot connect to the backend.";
        }
    });
}


/* Return to Work - Backend */

if (returnWorkBtn) {
    returnWorkBtn.addEventListener("click", async function () {
        const token = localStorage.getItem("accessToken");

        if (!token) {
            leaveMessage.textContent = "Please log in first.";
            return;
        }

        leaveMessage.textContent = "Recording return to work...";

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/attendance/return",
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                leaveMessage.textContent =
                    data.message || "Could not record return.";
                return;
            }

            leaveMessage.textContent = data.message;
            renderRecords();
        } catch (error) {
            console.error("Return error:", error);
            leaveMessage.textContent =
                "Cannot connect to the backend.";
        }
    });
}


/* Display records only when a history table exists */

renderRecords();
