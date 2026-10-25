
const signupForm = document.getElementById("signupForm");
const message = document.getElementById("signupMessage");

signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match!";
        message.style.color = "#D9534F";
        return;
    }

    if (password.length < 8) {
        message.textContent = "Password must be at least 8 characters.";
        message.style.color = "#D9534F";
        return;
    }

    message.textContent = "Creating your account...";
    message.style.color = "#B59A52";

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/signup",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "Registration failed.";
            message.style.color = "#D9534F";
            return;
        }

        message.textContent = "Account created successfully! Redirecting to Login...";
message.style.color = "#B59A52";

signupForm.reset();

setTimeout(function () {
    window.location.href = "index.html";
}, 1500);

    } catch (error) {
        console.error("Signup error:", error);
        message.textContent =
            "Cannot connect to the backend. Make sure Flask is running.";
        message.style.color = "#D9534F";
    }
});
