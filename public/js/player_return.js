// Keep search-page position separate from playback-page scroll restoration.
window.capturePlayerReturn = function () {
    const searchPage = document.getElementById('page-search');
    const fromSearch = searchPage && !searchPage.classList.contains('hidden');
    sessionStorage.setItem('playerFromSearch', fromSearch ? 'true' : 'false');
    if (!fromSearch) return;
    const query = document.getElementById('searchInput')?.value || '';
    const results = document.getElementById('results')?.cloneNode(true);
    // Do not put large downloaded image data URIs into the session cache.
    results?.querySelectorAll('img').forEach(image => {
        if (image.src.startsWith('data:')) {
            image.src = 'image/poster-placeholder.svg';
            delete image.dataset.posterStarted;
            image.dataset.posterState = 'placeholder';
        }
    });
    sessionStorage.setItem('lastSearchQuery', query);
    sessionStorage.setItem('lastPageView', 'searchResults');
    const cache = {query, html:results?.innerHTML || '', count:document.getElementById('searchResultsCount')?.textContent || '0', y:scrollY};
    try {
        const encoded = JSON.stringify(cache);
        if (encoded.length > 1500000) throw new Error('Search cache too large');
        sessionStorage.setItem('playerSearchReturn', encoded);
    } catch {
        sessionStorage.removeItem('playerSearchReturn'); // Navigation still works; re-query on return.
    }
};

window.returnToPlayerSearch = function () {
    if (sessionStorage.getItem('playerFromSearch') !== 'true') return false;
    sessionStorage.setItem('activeTab', 'search');
    sessionStorage.setItem('restorePlayerSearch', 'true');
    location.href = 'index.html';
    return true;
};

window.restorePlayerSearchReturn = function () {
    if (sessionStorage.getItem('restorePlayerSearch') !== 'true') return false;
    sessionStorage.removeItem('restorePlayerSearch');
    try {
        const saved = JSON.parse(sessionStorage.getItem('playerSearchReturn') || 'null');
        if (!saved || saved.query !== sessionStorage.getItem('lastSearchQuery') || !saved.html) return false;
        document.getElementById('searchInput').value = saved.query;
        document.getElementById('results').innerHTML = saved.html;
        document.getElementById('searchResultsCount').textContent = saved.count;
        document.getElementById('resultsArea').classList.remove('hidden');
        requestAnimationFrame(() => window.scrollTo({top:saved.y || 0,left:0,behavior:'instant'}));
        return true;
    } catch { return false; }
};

if (location.pathname.endsWith('player.html')) {
    history.scrollRestoration = 'manual';
    window.resetPlayerPageTop = () => window.scrollTo({top:0,left:0,behavior:'instant'});
    window.addEventListener('pageshow', () => {
        resetPlayerPageTop();
        requestAnimationFrame(resetPlayerPageTop);
    });
}
