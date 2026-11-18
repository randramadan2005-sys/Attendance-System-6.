
// ========================================
// Nexora Dashboard JavaScript
// ========================================

// Display employee name
const employeeName = localStorage.getItem("employeeName");

const welcomeHeading = document.getElementById("welcomeHeading");

if (welcomeHeading && employeeName) {
    welcomeHeading.textContent = `Welcome back, ${employeeName} 👋`;
}

// Logout functionality
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {

        localStorage.removeItem("accessToken");
        localStorage.removeItem("employeeEmail");
        localStorage.removeItem("employeeName");

        window.location.href = "index.html";
    });
}
