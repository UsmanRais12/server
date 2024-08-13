const messageTag = document.getElementById("message");
window.addEventListener("DOMContentLoaded", async () => {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => {
      return searchParams.get(prop);
    },
  });

  const token = params.token;
  const id = params.id;

  console.log("ID:", id);
  console.log("Token:", token);

  try {
    const res = await fetch("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token, id }),
      headers: {
        "Content-Type": "application/json;charset=utf-8",
      },
    });

    if (!res.ok) {
      const { message } = await res.json();
      messageTag.innerText = message;
      messageTag.classList.add("error");
      return;
    }

    const { message } = await res.json();
    messageTag.innerText = message;
    messageTag.classList.add("success");
  } 
});
