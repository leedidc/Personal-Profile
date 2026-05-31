document.querySelectorAll('.detail-btn').forEach(btn => {

    btn.addEventListener('click', () => {

        const content = btn.nextElementSibling;

        content.classList.toggle('active');

        btn.textContent =
            content.classList.contains('active')
                ? 'Hide Details ▲'
                : 'See Details ▼';
    });

});