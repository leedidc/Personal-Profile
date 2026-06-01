const API = "https://profile-article-database.leedidc1227.workers.dev/articles";

// ========================
// QUILL INIT
// ========================
const quill = new Quill("#editor", {
  theme: "snow"
});

// ========================
// LOGIN (SERVER VERIFY)
// ========================
async function login() {
  const token = document.getElementById("tokenInput").value;

  if (!token) {
    alert("Enter token");
    return;
  }

  const res = await fetch(API.replace("/articles", "/verify-admin"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token })
  });

  if (!res.ok) {
    alert("Invalid token");
    return;
  }

  localStorage.setItem("admin_token", token);
  checkAuth();
}

// ========================
function logout() {
  localStorage.removeItem("admin_token");
  location.reload();
}

function getToken() {
  return localStorage.getItem("admin_token");
}

// ========================
// AUTH CHECK
// ========================
function checkAuth() {
  const token = getToken();

  if (!token) {
    document.getElementById("panel").style.display = "none";
    return;
  }

  document.getElementById("panel").style.display = "block";
  loadArticles();
}

// ========================
// HEADERS
// ========================
function headers() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

// ========================
// CREATE
// ========================
async function createArticle() {

  const title = document.getElementById("title").value;
  const content = quill.root.innerHTML;

  const res = await fetch(API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title, content })
  });

  if (res.ok) {
    alert("Created!");

    document.getElementById("title").value = "";
    quill.setContents([]);

    loadArticles();
  } else {
    alert("Failed");
  }
}

// ========================
// READ
// ========================
async function loadArticles() {
  const res = await fetch(API);
  const data = await res.json();

  document.getElementById("list").innerHTML = data.map(a => `
    <div class="card">
      <h3>${a.title}</h3>
      <small>${a.created_at}</small>
      <br><br>
      <button onclick="editArticle(${a.id})">Edit</button>
      <button onclick="deleteArticle(${a.id})">Delete</button>
    </div>
  `).join("");
}

// ========================
// UPDATE
// ========================
async function editArticle(id) {
  const title = prompt("New title");
  const content = prompt("New content (HTML)");

  if (!title || !content) return;

  await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ title, content })
  });

  loadArticles();
}

// ========================
// DELETE
// ========================
async function deleteArticle(id) {
  if (!confirm("Delete?")) return;

  await fetch(`${API}/${id}`, {
    method: "DELETE",
    headers: headers()
  });

  loadArticles();
}

// ========================
checkAuth();