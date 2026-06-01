const API = "https://profile-article-database.leedidc1227.workers.dev/articles";


const quill = new Quill("#editor", {
  theme: "snow",
  modules: {
    toolbar: "#toolbar"
  }
});

// ========================
// LOGIN
// ========================
function login() {
  const token = document.getElementById("tokenInput").value;

  if (!token) {
    alert("Enter token");
    return;
  }

  localStorage.setItem("admin_token", token);

  checkAuth();
}

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

  // ✅ Quill 에디터 내용
  const content = quill.root.innerHTML;

  const res = await fetch(API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title, content })
  });

  if (res.ok) {
    alert("Created!");

    document.getElementById("title").value = "";

    // 🔥 Quill 초기화 (중요)
    quill.setContents([]);

    loadArticles();
  } else {
    alert("Failed (check token)");
  }
}

// ========================
// READ (LIST)
// ========================
async function loadArticles() {
  const res = await fetch(API);
  const data = await res.json();

  const list = document.getElementById("list");

  list.innerHTML = data.map(a => `
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
  const content = prompt("New content");

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
  if (!confirm("Delete this article?")) return;

  await fetch(`${API}/${id}`, {
    method: "DELETE",
    headers: headers()
  });

  loadArticles();
}

// ========================
// INIT
// ========================
checkAuth();