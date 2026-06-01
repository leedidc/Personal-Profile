const params =
    new URLSearchParams(window.location.search);

const id = params.get("id");

loadArticle(id);

async function loadArticle(id) {

    const response = await fetch(
        `https://profile-article-database.leedidc1227.workers.dev/articles/${id}`
    );

    const article = await response.json();

    document.getElementById("title").textContent =
        article.title;

    document.getElementById("content").innerHTML =
        article.content;
}