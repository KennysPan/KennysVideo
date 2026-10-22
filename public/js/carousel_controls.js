const carouselBindings = new WeakMap();

function setupCarouselControls(track) {
    const container = track.closest('.carousel-container');
    if (!container) return;
    const existing = carouselBindings.get(container);
    if (existing) {
        requestAnimationFrame(existing);
        return;
    }

    container.tabIndex = 0;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', '影片列表，可左右滚动');
    const controls = document.createElement('div');
    controls.className = 'carousel-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'carousel-page-button';
    previous.textContent = '‹';
    previous.setAttribute('aria-label', '向左浏览影片');
    const hint = document.createElement('span');
    hint.textContent = '左右浏览更多影片';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'carousel-page-button';
    next.textContent = '›';
    next.setAttribute('aria-label', '向右浏览影片');
    controls.append(previous, hint, next);
    container.after(controls);

    function refresh() {
        const maximum = container.scrollWidth - container.clientWidth;
        controls.hidden = maximum <= 1;
        previous.disabled = container.scrollLeft <= 1;
        next.disabled = container.scrollLeft >= maximum - 1;
    }
    function move(direction) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        container.scrollBy({
            left: direction * Math.max(160, container.clientWidth * 0.85),
            behavior: reducedMotion ? 'instant' : 'smooth'
        });
    }
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    container.addEventListener('scroll', refresh, { passive: true });
    container.addEventListener('keydown', event => {
        if (event.target !== container || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
    });
    carouselBindings.set(container, refresh);
    requestAnimationFrame(refresh);
}

let carouselResizeFrame;
window.addEventListener('resize', () => {
    cancelAnimationFrame(carouselResizeFrame);
    carouselResizeFrame = requestAnimationFrame(() => {
        document.querySelectorAll('.carousel-container').forEach(container => carouselBindings.get(container)?.());
    });
});
