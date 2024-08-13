const form = document.getElementById("form");
const messageTag = document.getElementById("message");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");
const notification = document.getElementById("notification");
const submitBtn = document.getElementById("submit");
form.style.display = "none"; // Hide the form initially
const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]{6,}$/;
let token, id;
window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  token = params.get("token");
  id = params.get("id");

  console.log("ID:", id);
  console.log("Token:", token);

  try {
    const response = await fetch("/auth/verify-pass-reset-token", {
      method: "POST",
      body: JSON.stringify({ token, id }),
      headers: {
        "Content-Type": "application/json;charset=utf-8",
      },
    });

    if (!response.ok) {
      form.style.display = "none";
      const { message } = await response.json();
      messageTag.innerText = message;
      messageTag.classList.add("error");
      return; // Exit the function if verification fails
    }

    messageTag.style.display = "none"; // Hide the message tag if successful
    form.style.display = "block"; // Show the form for password reset
  } catch (error) {
    console.error("Error verifying token:", error);
    // Handle potential errors during the fetch request (optional)
  }
});

const displayNotification = (message, type) => {
  notification.style.display = "block";
  notification.innerText = message;
  notification.classList.add(type);
};

const handleSubmit = async (evt) => {
  evt.preventDefault();

  // Validate password format
  if (!passwordRegex.test(password.value)) {
    return displayNotification(
      "Password must be alphanumeric, with at least one letter and one digit, and be at least 6 characters long.",
      "error"
    );
  }

  // Check if passwords match
  if (password.value.trim() !== confirmPassword.value.trim()) {
    return displayNotification("Passwords do not match", "error");
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Please wait..";

  try {
    const requestBody = {
      id,
      token,
      password: password.value,
    };

    const res = await fetch("/auth/reset-pass", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
      },
      body: JSON.stringify(requestBody),
    });

    submitBtn.disabled = false;
    submitBtn.innerText = "Update Password";

    if (!res.ok) {
      const { message } = await res.json();
      console.error("Server error:", message);
      if (res.status === 400 && message.includes("old password")) {
        // Handle "old password" error specifically
        displayNotification("Invalid old password provided.", "error");
      } else {
        displayNotification(
          message || "Failed to update password. Please try again later.",
          "error"
        );
      }
      return;
    }

    // Password updated successfully
    messageTag.style.display = "block";
    messageTag.innerText = "Your password was updated successfully.";
    form.style.display = "none";
  } catch (error) {
    console.error("Error updating password:", error);
    displayNotification("An error occurred. Please try again later.", "error");
  }
};

form.addEventListener("submit", handleSubmit);
