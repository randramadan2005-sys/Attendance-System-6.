
/* =========================
   Login Form
   ========================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        localStorage.setItem("employeeEmail", email);

        // After login, open the Dashboard
        window.location.href = "dashboard.html";
    });
}


/* =========================
   Attendance System
   Shared by Attendance and History pages
   ========================= */

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

function renderRecords() {
    if (!recordsTable) {
        return;
    }

    recordsTable.replaceChildren();

    if (!email) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "Please log in to view attendance history.";

        row.appendChild(cell);
        recordsTable.appendChild(row);

        return;
    }

    const employeeRecords = records.filter(
        record => record.email === email
    );

    if (employeeRecords.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "No attendance records yet.";

        row.appendChild(cell);
        recordsTable.appendChild(row);

        return;
    }

    employeeRecords.forEach(record => {
        const breaks = record.breaks || [];
        const leaveEntries = breaks.length > 0 ? breaks : [null];

        leaveEntries.forEach(leave => {
            const row = document.createElement("tr");

            const values = [
                record.date,
                record.checkIn || "--",
                leave?.leaveTime || "--",
                leave?.expectedReturn || "--",
                leave?.actualReturn || "--",
                record.checkOut || "--"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");

                cell.textContent = value;
                row.appendChild(cell);
            });

            recordsTable.appendChild(row);
        });
    });
}


/* =========================
   Check In
   ========================= */

if (checkInBtn) {
    checkInBtn.addEventListener("click", function () {
        if (!email) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "Please log in first.";
            }
            return;
        }

        const existingRecord = getTodayRecord();

        if (existingRecord) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "You have already checked in today.";
            }
            return;
        }

        records.push({
            email: email,
            date: today(),
            checkIn: currentTime(),
            checkOut: "",
            breaks: []
        });

        saveRecords();
        renderRecords();

        if (attendanceMessage) {
            attendanceMessage.textContent =
                "Check In recorded successfully!";
        }
    });
}


/* =========================
   Check Out
   ========================= */

if (checkOutBtn) {
    checkOutBtn.addEventListener("click", function () {
        if (!email) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "Please log in first.";
            }
            return;
        }

        const record = getTodayRecord();

        if (!record) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "Please Check In first.";
            }
            return;
        }

        if (record.checkOut) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "You have already checked out.";
            }
            return;
        }

        const activeLeave = (record.breaks || []).some(
            item => !item.actualReturn
        );

        if (activeLeave) {
            if (attendanceMessage) {
                attendanceMessage.textContent =
                    "Please return to work before checking out.";
            }
            return;
        }

        record.checkOut = currentTime();

        saveRecords();
        renderRecords();

        if (attendanceMessage) {
            attendanceMessage.textContent =
                "Check Out recorded successfully!";
        }
    });
}


/* =========================
   Temporary Leave
   ========================= */

if (leaveWorkBtn) {
    leaveWorkBtn.addEventListener("click", function () {
        if (!email) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "Please log in first.";
            }
            return;
        }

        const record = getTodayRecord();

        const expectedReturn = expectedReturnInput
            ? expectedReturnInput.value
            : "";

        if (!record || record.checkOut) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "Please check in before leaving.";
            }
            return;
        }

        if (!expectedReturn) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "Please select your expected return time.";
            }
            return;
        }

        if (expectedReturn <= currentTime()) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "Return time must be later than now.";
            }
            return;
        }

        record.breaks = record.breaks || [];

        const activeLeave = record.breaks.some(
            item => !item.actualReturn
        );

        if (activeLeave) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "You are already on temporary leave.";
            }
            return;
        }

        record.breaks.push({
            leaveTime: currentTime(),
            expectedReturn: expectedReturn,
            actualReturn: ""
        });

        saveRecords();
        renderRecords();

        if (leaveMessage) {
            leaveMessage.textContent =
                "Temporary leave recorded successfully!";
        }

        if (expectedReturnInput) {
            expectedReturnInput.value = "";
        }
    });
}


/* =========================
   Return to Work
   ========================= */

if (returnWorkBtn) {
    returnWorkBtn.addEventListener("click", function () {
        if (!email) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "Please log in first.";
            }
            return;
        }

        const record = getTodayRecord();

        if (!record || record.checkOut) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "No active workday was found.";
            }
            return;
        }

        record.breaks = record.breaks || [];

        const activeLeave = [...record.breaks]
            .reverse()
            .find(item => !item.actualReturn);

        if (!activeLeave) {
            if (leaveMessage) {
                leaveMessage.textContent =
                    "You are not currently on temporary leave.";
            }
            return;
        }

        activeLeave.actualReturn = currentTime();

        saveRecords();
        renderRecords();

        if (leaveMessage) {
            leaveMessage.textContent =
                "Return to work recorded successfully!";
        }
    });
}


/* Display records only when a history table exists */

renderRecords();
