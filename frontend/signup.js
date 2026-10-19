
const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const password =
        document.getElementById("signupPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    const message =
        document.getElementById("signupMessage");

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match!";
        message.style.color = "#D9534F";
        return;
    }

    message.textContent =
        "Form completed successfully! Backend registration is not connected yet.";
    message.style.color = "#D982A8";
});
