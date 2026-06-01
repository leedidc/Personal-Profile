async function loadArticles() {

    const response = await fetch(
        "https://profile-article-database.leedidc1227.workers.dev/articles"
    );

    const articles = await response.json();

    const container =
        document.getElementById("article-list");

    articles.forEach(article => {

        container.innerHTML += `
            <article class="article-card">

                <div class="article-meta">
                    <span>${article.category ?? ""}</span>
                    <span>${article.created_at ?? ""}</span>
                </div>

                <h2>
                    <a href="article-view.html?id=${article.id}">
                        ${article.title}
                    </a>
                </h2>

                <p>
                    Article Preview
                </p>

            </article>
        `;
    });
}

loadArticles();