(() => {
    function setup() {
        if (document.getElementById('backToTop')) return;
        const button = document.createElement('button');
        button.id = 'backToTop';
        button.type = 'button';
        button.title = '返回顶部';
        button.setAttribute('aria-label', '返回顶部');
        button.hidden = true;
        button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 13 6-6 6 6M12 7v13M5 3h14"/></svg>';
        document.body.append(button);
        let scheduled = false;
        const update = () => {
            button.hidden = window.scrollY < Math.max(480, window.innerHeight * .7) || document.body.classList.contains('dplayer-custom-fullscreen-mode');
            scheduled = false;
        };
        window.addEventListener('scroll', () => {
            if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
        }, {passive:true});
        window.addEventListener('resize', update);
        button.onclick = () => window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        update();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
    else setup();
})();
