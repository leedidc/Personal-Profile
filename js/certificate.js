document.addEventListener('DOMContentLoaded', () => {
    const sliders = document.querySelectorAll('.cert-grid');

    sliders.forEach((slider) => {
        slider.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();

                slider.scrollBy({
                    left: e.deltaY * 3,
                    behavior: 'auto'
                });
            },
            { passive: false }
        );
    });
});

document.querySelectorAll(".cvx-card").forEach(card => {

    const created = new Date(card.dataset.date);
    const base = card.dataset.lastUpdate
        ? new Date(card.dataset.lastUpdate)
        : created;

    const years = parseInt(card.dataset.years);
    const now = new Date();

    const badge = document.createElement("div");
    const bar = document.createElement("div");
    const fill = document.createElement("div");
    const info = document.createElement("div");

    badge.className = "cvx-badge";
    bar.className = "cvx-bar";
    fill.className = "cvx-fill";
    info.className = "cvx-dates";

    const fmt = d => d.toISOString().split("T")[0];

    info.innerHTML = `
        <div>First: ${fmt(created)}</div>
        <div>Base: ${fmt(base)}</div>
    `;

    if (years === 0) {
        badge.innerText = "PERMANENT";
        badge.classList.add("perm");
        fill.style.width = "100%";
    } else {

        const expiry = new Date(base);
        expiry.setFullYear(expiry.getFullYear() + years);

        const total = expiry - base;
        const passed = now - base;

        const percent = Math.min(100, (passed / total) * 100);
        fill.style.width = percent + "%";

        const left =
            Math.max(0, (expiry - now) / (365 * 24 * 60 * 60 * 1000));

        badge.innerText = `${years}Y · ${left.toFixed(1)} left`;
    }

    bar.appendChild(fill);

    card.appendChild(badge);
    card.appendChild(bar);
    card.appendChild(info);
});