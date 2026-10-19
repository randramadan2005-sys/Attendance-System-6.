
/* Login Form */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        localStorage.setItem("employeeEmail", email);
        window.location.href = "attendance.html";
    });
}

/* Attendance System */
const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");
const recordsTable = document.getElementById("recordsTable");
const attendanceMessage = document.getElementById("attendanceMessage");

const leaveWorkBtn = document.getElementById("leaveWorkBtn");
const returnWorkBtn = document.getElementById("returnWorkBtn");
const expectedReturnInput = document.getElementById("expectedReturnTime");
const leaveMessage = document.getElementById("leaveMessage");

if (recordsTable) {
    const email = localStorage.getItem("employeeEmail");

    let records = JSON.parse(
        localStorage.getItem("attendanceRecords") || "[]"
    );

    function today() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function currentTime() {
        return new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    function saveRecords() {
        localStorage.setItem(
            "attendanceRecords",
            JSON.stringify(records)
        );
    }

    function getTodayRecord() {
        return records.find(record =>
            record.email === email && record.date === today()
        );
    }

    /* Display Attendance Records */
    function renderRecords() {
        recordsTable.replaceChildren();

        records
            .filter(record => record.email === email)
            .forEach(record => {
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

    
/* Check In */
if (checkInBtn && attendanceMessage) {
    checkInBtn.addEventListener("click", function() {
        if (!email) {
            attendanceMessage.textContent =
                "Please log in first.";
            return;
        }

        let record = getTodayRecord();

        if (record) {
            attendanceMessage.textContent =
                "You have already checked in today.";
            renderRecords();
            return;
        }

        record = {
            email: email,
            date: today(),
            checkIn: currentTime(),
            checkOut: "",
            breaks: []
        };

        records.push(record);

        saveRecords();
        renderRecords();

        attendanceMessage.textContent =
            "Check In recorded successfully!";
    });


    }

    /* Check Out */
    if (checkOutBtn) {
        checkOutBtn.addEventListener("click", function() {
            const record = getTodayRecord();

            if (!record) {
                attendanceMessage.textContent =
                    "Please Check In first.";
                return;
            }

            if (record.checkOut) {
                attendanceMessage.textContent =
                    "You have already checked out.";
                return;
            }

            const activeLeave = (record.breaks || []).some(
                item => !item.actualReturn
            );

            if (activeLeave) {
                attendanceMessage.textContent =
                    "Please return to work before checking out.";
                return;
            }

            record.checkOut = currentTime();

            saveRecords();
            renderRecords();

            attendanceMessage.textContent =
                "Check Out recorded successfully!";
        });
    }

    /* Temporary Leave */
    if (leaveWorkBtn && expectedReturnInput && leaveMessage) {
        leaveWorkBtn.addEventListener("click", function() {
            const record = getTodayRecord();
            const expectedReturn = expectedReturnInput.value;

            if (!record || record.checkOut) {
                leaveMessage.textContent =
                    "Please check in before leaving.";
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

            record.breaks = record.breaks || [];

            if (record.breaks.some(item => !item.actualReturn)) {
                leaveMessage.textContent =
                    "You are already on temporary leave.";
                return;
            }

            record.breaks.push({
                leaveTime: currentTime(),
                expectedReturn: expectedReturn,
                actualReturn: ""
            });

            saveRecords();
            renderRecords();

            leaveMessage.textContent =
                "Temporary leave recorded successfully!";

            expectedReturnInput.value = "";
        });
    }

    /* Return to Work */
    if (returnWorkBtn && leaveMessage) {
        returnWorkBtn.addEventListener("click", function() {
            const record = getTodayRecord();

            if (!record || record.checkOut) {
                leaveMessage.textContent =
                    "No active workday was found.";
                return;
            }

            record.breaks = record.breaks || [];

            const activeLeave = [...record.breaks]
                .reverse()
                .find(item => !item.actualReturn);

            if (!activeLeave) {
                leaveMessage.textContent =
                    "You are not currently on temporary leave.";
                return;
            }

            activeLeave.actualReturn = currentTime();

            saveRecords();
            renderRecords();

            leaveMessage.textContent =
                "Return to work recorded successfully!";
        });
    }

    renderRecords();
}


