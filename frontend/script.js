
/* =====================================
   NEXORA TECHNOLOGIES
   LOGIN + ATTENDANCE + HISTORY + AI
   ===================================== */

const API_URL = "http://127.0.0.1:5000";

/* =====================================
   1. LOGIN
   ===================================== */

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

            const response = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                message.textContent =
                    data.message || "Login failed.";
                message.style.color = "#D9534F";
                return;
            }

            localStorage.setItem("employeeEmail", data.user.email);
            localStorage.setItem("accessToken", data.access_token);
            localStorage.setItem("employeeName", data.user.name);

            message.textContent = "Login successful!";
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


/* =====================================
   2. SHARED ELEMENTS
   ===================================== */

const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");

const attendanceMessage =
    document.getElementById("attendanceMessage");

const leaveWorkBtn = document.getElementById("leaveWorkBtn");
const returnWorkBtn = document.getElementById("returnWorkBtn");

const expectedReturnInput =
    document.getElementById("expectedReturnTime");

const leaveMessage = document.getElementById("leaveMessage");

const recordsTable = document.getElementById("recordsTable");

const aiSummaryBtn = document.getElementById("aiSummaryBtn");
const aiSummaryResult = document.getElementById("aiSummaryResult");


/* =====================================
   3. HELPER FUNCTIONS
   ===================================== */

function getToken() {
    return localStorage.getItem("accessToken");
}

function showHistoryMessage(message) {

    if (!recordsTable) return;

    recordsTable.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.textContent = message;

    row.appendChild(cell);
    recordsTable.appendChild(row);
}

function formatDate(value) {

    if (!value) return "--";

    return value.split(" ")[0];
}

function formatTime(value) {

    if (!value) return "--";

    return value.split(" ")[1] || value;
}

function currentTime() {

    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}


/* =====================================
   4. LOAD ATTENDANCE HISTORY
   ===================================== */

async function renderRecords() {

    if (!recordsTable) return;

    const token = getToken();

    if (!token) {
        showHistoryMessage("Please log in to view attendance history.");
        return;
    }

    showHistoryMessage("Loading attendance records...");

    try {

        const response = await fetch(
            `${API_URL}/api/attendance`,
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

        recordsTable.replaceChildren();

        if (employeeRecords.length === 0) {

            showHistoryMessage("No attendance records yet.");

            return;
        }

        employeeRecords.forEach(record => {

            const breaks = record.breaks || [];

            // Display one row if there are no temporary leaves
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

            // Display each temporary leave separately
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


/* =====================================
   5. CHECK IN
   ===================================== */

if (checkInBtn) {

    let checkInProcessing = false;

    checkInBtn.addEventListener("click", async function () {

        if (checkInProcessing) return;

        const token = getToken();

        if (!token) {

            attendanceMessage.textContent = "Please log in first.";

            return;
        }

        checkInProcessing = true;
        checkInBtn.disabled = true;

        attendanceMessage.textContent = "Recording check-in...";

        try {

            const response = await fetch(
                `${API_URL}/api/attendance/check-in`,
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
                data.message || "Check-in recorded successfully!";

        } catch (error) {

            console.error("Check-in error:", error);

            attendanceMessage.textContent =
                "Cannot connect to the backend.";

        } finally {

            checkInProcessing = false;
            checkInBtn.disabled = false;
        }

    });
}


/* =====================================
   6. CHECK OUT
   ===================================== */

if (checkOutBtn) {

    let checkOutProcessing = false;

    checkOutBtn.addEventListener("click", async function () {

        if (checkOutProcessing) return;

        const token = getToken();

        if (!token) {

            attendanceMessage.textContent = "Please log in first.";

            return;
        }

        checkOutProcessing = true;
        checkOutBtn.disabled = true;

        attendanceMessage.textContent = "Recording check-out...";

        try {

            const response = await fetch(
                `${API_URL}/api/attendance/check-out`,
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
                data.message || "Check-out recorded successfully!";

        } catch (error) {

            console.error("Check-out error:", error);

            attendanceMessage.textContent =
                "Cannot connect to the backend.";

        } finally {

            checkOutProcessing = false;
            checkOutBtn.disabled = false;
        }

    });
}


/* =====================================
   7. TEMPORARY LEAVE
   ===================================== */

if (leaveWorkBtn) {

    let leaveProcessing = false;

    leaveWorkBtn.addEventListener("click", async function () {

        if (leaveProcessing) return;

        const token = getToken();

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

        leaveProcessing = true;
        leaveWorkBtn.disabled = true;

        leaveMessage.textContent = "Recording temporary leave...";

        try {

            const response = await fetch(
                `${API_URL}/api/attendance/leave`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
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

            leaveMessage.textContent =
                data.message || "Temporary leave recorded successfully!";

            expectedReturnInput.value = "";

        } catch (error) {

            console.error("Leave error:", error);

            leaveMessage.textContent =
                "Cannot connect to the backend.";

        } finally {

            leaveProcessing = false;
            leaveWorkBtn.disabled = false;
        }

    });
}


/* =====================================
   8. RETURN TO WORK
   ===================================== */

if (returnWorkBtn) {

    let returnProcessing = false;

    returnWorkBtn.addEventListener("click", async function () {

        if (returnProcessing) return;

        const token = getToken();

        if (!token) {

            leaveMessage.textContent = "Please log in first.";

            return;
        }

        returnProcessing = true;
        returnWorkBtn.disabled = true;

        leaveMessage.textContent = "Recording return to work...";

        try {

            const response = await fetch(
                `${API_URL}/api/attendance/return`,
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

            leaveMessage.textContent =
                data.message || "Return to work recorded successfully!";

        } catch (error) {

            console.error("Return error:", error);

            leaveMessage.textContent =
                "Cannot connect to the backend.";

        } finally {

            returnProcessing = false;
            returnWorkBtn.disabled = false;
        }

    });
}


/* =====================================
   9. AI ATTENDANCE SUMMARY
   ===================================== */

if (aiSummaryBtn && aiSummaryResult) {

    let aiProcessing = false;

    aiSummaryBtn.addEventListener("click", async function () {

        if (aiProcessing) return;

        const token = getToken();

        if (!token) {

            aiSummaryResult.textContent = "Please log in first.";

            return;
        }

        aiProcessing = true;
        aiSummaryBtn.disabled = true;

        aiSummaryBtn.textContent = "Generating summary...";

        aiSummaryResult.textContent =
            "AI is analyzing your attendance records...";

        try {

            const response = await fetch(
                `${API_URL}/api/ai/attendance-summary`,
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

                aiSummaryResult.textContent =
                    data.error || data.message || "Could not generate AI summary.";

                return;
            }

            aiSummaryResult.textContent =
                data.summary || "No summary was returned.";

        } catch (error) {

            console.error("AI Summary Error:", error);

            aiSummaryResult.textContent =
                "Cannot connect to the backend. Please try again.";

        } finally {

            aiProcessing = false;
            aiSummaryBtn.disabled = false;

            aiSummaryBtn.textContent =
                "✨ Generate AI Attendance Summary";
        }

    });
}


/* =====================================
   10. INITIALIZE HISTORY PAGE
   ===================================== */

renderRecords();
