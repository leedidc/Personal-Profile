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