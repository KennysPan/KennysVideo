// Source-specific catalog. Requests use the same native HTTP bridge as search.
function buildSourceCatalogUrl(base, parameters) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('数据源地址必须是 HTTP 或 HTTPS 地址');
    }
    if (!/\/api\.php\/provide\/vod\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/$/, '') + '/api.php/provide/vod/';
    }
    for (const key of ['ac', 'pg', 't', 'wd', 'ids', 'h']) url.searchParams.delete(key);
    for (const [key, value] of Object.entries(parameters)) {
        if (value !== '' && value !== undefined) url.searchParams.set(key, String(value));
    }
    url.hash = '';
    return url.href;
}

(() => {
    const state = { sources: [], source: null, category: '', keyword: '', page: 1,
        pageCount: null, next: false, loading: false, request: 0, requestedCode: null };
    const byId = id => document.getElementById(id);
    const banned = ['伦理片','福利','里番动漫','门事件','萝莉少女','制服诱惑','国产传媒','cosplay','黑丝诱惑','无码','有码','SWAG','网红主播','色情片','同性片'];
    const filterEnabled = () => localStorage.getItem('yellowFilterEnabled') === 'true';
    const allowed = item => item && typeof item === 'object' && (!filterEnabled() || !banned.some(word => String(item.type_name || '').includes(word)));
    const positiveInteger = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

    function getSources() {
        const custom = customAPIs.map((source, index) => ({code: 'custom_' + index,
            name: source.name, url: source.url, adult: source.isAdult}));
        const builtIn = Object.entries(API_SITES).filter(([, source]) => source.api && !(source.adult && typeof HIDE_BUILTIN_ADULT_APIS !== 'undefined' && HIDE_BUILTIN_ADULT_APIS))
            .map(([code, source]) => ({code, name: source.name, url: source.api, adult: source.adult}));
        return [...custom, ...builtIn].filter(source => source.url && (!filterEnabled() || !source.adult));
    }

    function updatePaging() {
        byId('sourceCatalogPrev').disabled = state.loading || state.page <= 1 || !state.source;
        byId('sourceCatalogNext').disabled = state.loading || !state.next || !state.source;
        byId('sourceCatalogPage').textContent = state.pageCount === null
            ? `第 ${state.page} 页` : `第 ${state.page} / ${Math.max(1, state.pageCount)} 页`;
        byId('sourceCatalogGrid').setAttribute('aria-busy', String(state.loading));
    }

    function validateResponse(data) {
        if (!data || typeof data !== 'object' || (data.code !== undefined && ![0, 1, 200].includes(Number(data.code)))) {
            throw new Error('该接口未返回有效片库数据');
        }
        return data;
    }

    async function request(source, parameters) {
        return validateResponse(await executeApiRequest(buildSourceCatalogUrl(source.url, parameters), {
            headers: API_CONFIG.search.headers, timeoutSecs: 15, sourceForLog: 'source-catalog'
        }));
    }

    function renderCategories(classes) {
        const select = byId('sourceCatalogCategory');
        select.replaceChildren(new Option('全部分类', ''));
        for (const item of classes || []) {
            if (item && item.type_id !== undefined && item.type_name && allowed(item)) {
                select.add(new Option(String(item.type_name), String(item.type_id)));
            }
        }
        select.value = state.category;
    }

    function renderMovies(items, source) {
        const grid = byId('sourceCatalogGrid');
        grid.replaceChildren();
        const seen = new Set();
        for (const item of items.filter(allowed)) {
            if (!item || item.vod_id === undefined || item.vod_id === null || !item.vod_name) continue;
            const id = String(item.vod_id);
            if (seen.has(id)) continue;
            seen.add(id);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'source-catalog-card';
            card.setAttribute('aria-label', '查看 ' + item.vod_name);
            // Only the shared image helper generates markup; API text is assigned through textContent.
            const cover = document.createElement('div');
            let poster = '';
            try { const parsed = new URL(item.vod_pic); if (['http:', 'https:'].includes(parsed.protocol)) poster = parsed.href; } catch {}
            cover.innerHTML = createPosterImage(poster, '', 'object-cover');
            const title = document.createElement('strong');
            title.textContent = String(item.vod_name);
            title.title = String(item.vod_name);
            const info = document.createElement('span');
            info.textContent = [item.vod_remarks || item.type_name || '', item.vod_year || ''].filter(Boolean).join(' · ');
            card.append(cover, title, info);
            card.addEventListener('click', () => {
                // Resolve the current config before opening, since custom source indices may change.
                const live = getSources().find(entry => entry.code === source.code && entry.url === source.url);
                if (!live) { initSourceCatalog(); return; }
                showDetails(id, String(item.vod_name), source.code);
            });
            grid.append(card);
        }
        return grid.childElementCount;
    }

    async function loadPage(resetCategories = false) {
        const ticket = ++state.request;
        const source = state.source;
        state.loading = true;
        state.next = false;
        byId('sourceCatalogRetry').hidden = true;
        byId('sourceCatalogGrid').replaceChildren();
        byId('sourceCatalogStatus').textContent = source ? `正在加载 ${source.name}…` : '请先在设置中添加可用的 API';
        updatePaging();
        if (!source) { state.loading = false; updatePaging(); return; }
        try {
            sessionStorage.setItem('sourceCatalogView', JSON.stringify({url: source.url,
                category: state.category, keyword: state.keyword, page: state.page}));
        } catch { /* Optional view restoration must not stop browsing. */ }
        if (resetCategories) {
            renderCategories([]);
            byId('sourceCatalogCategory').disabled = true;
            request(source, {ac: 'list', pg: 1}).then(data => {
                if (state.source !== source) return;
                renderCategories(Array.isArray(data.class) ? data.class : []);
                byId('sourceCatalogCategory').disabled = byId('sourceCatalogCategory').options.length <= 1;
            }).catch(() => { /* Sources may support lists and searches without categories. */ });
        }
        try {
            const data = await request(source, {ac: 'videolist', pg: state.page, t: state.category, wd: state.keyword});
            if (ticket !== state.request) return;
            if (!Array.isArray(data.list)) throw new Error('该接口未提供兼容的影片列表');
            const count = renderMovies(data.list, source);
            state.pageCount = positiveInteger(data.pagecount);
            const limit = positiveInteger(data.limit);
            state.next = state.pageCount !== null ? state.page < state.pageCount
                : data.list.length > 0 && (limit ? data.list.length >= limit : true);
            const total = positiveInteger(data.total);
            byId('sourceCatalogStatus').textContent = count
                ? `${source.name} · 本页 ${count} 部${total !== null ? ` · 来源共 ${total} 部` : ''}`
                : `${source.name} · 本页暂无匹配影片，可调整分类、关键词或翻页`;
        } catch (error) {
            if (ticket !== state.request) return;
            state.next = false;
            state.pageCount = null;
            byId('sourceCatalogStatus').textContent = '加载失败：接口可能暂时不可用或不支持片库浏览，请重试或切换来源';
            byId('sourceCatalogRetry').hidden = false;
            console.warn('Source catalog request failed', error);
        } finally {
            if (ticket === state.request) { state.loading = false; updatePaging(); }
        }
    }

    function bindControls() {
        const sourceSelect = byId('sourceCatalogSource');
        if (sourceSelect.dataset.bound) return;
        sourceSelect.dataset.bound = 'true';
        sourceSelect.addEventListener('change', () => {
            state.source = state.sources.find(source => source.code === sourceSelect.value) || null;
            state.category = ''; state.keyword = ''; state.page = 1; state.pageCount = null;
            byId('sourceCatalogKeyword').value = '';
            loadPage(true);
        });
        byId('sourceCatalogCategory').addEventListener('change', event => {
            state.category = event.target.value; state.page = 1; loadPage();
        });
        byId('sourceCatalogSearch').addEventListener('submit', event => {
            event.preventDefault();
            state.keyword = byId('sourceCatalogKeyword').value.trim(); state.page = 1; loadPage();
        });
        byId('sourceCatalogPrev').addEventListener('click', () => { if (!state.loading && state.page > 1) { state.page--; loadPage(); } });
        byId('sourceCatalogNext').addEventListener('click', () => { if (!state.loading && state.next) { state.page++; loadPage(); } });
        byId('sourceCatalogRetry').addEventListener('click', () => loadPage(byId('sourceCatalogCategory').options.length <= 1));
    }

    window.initSourceCatalog = function initSourceCatalog() {
        bindControls();
        const previous = state.source;
        let saved = null;
        if (!previous && !state.requestedCode) {
            try { saved = JSON.parse(sessionStorage.getItem('sourceCatalogView') || 'null'); } catch {}
        }
        state.sources = getSources();
        state.source = state.sources.find(source => state.requestedCode ? source.code === state.requestedCode
            : previous ? source.url === previous.url && source.code === previous.code : saved && source.url === saved.url) || state.sources[0] || null;
        state.requestedCode = null;
        byId('sourceCatalogSource').replaceChildren();
        for (const source of state.sources) {
            byId('sourceCatalogSource').add(new Option((source.code.startsWith('custom_') ? '自定义 · ' : '') + source.name, source.code));
        }
        if (state.source) byId('sourceCatalogSource').value = state.source.code;
        if (!previous || !state.source || previous.code !== state.source.code || previous.url !== state.source.url) {
            state.page = 1; state.pageCount = null; state.category = ''; state.keyword = '';
            byId('sourceCatalogKeyword').value = '';
        }
        if (saved && state.source?.url === saved.url) {
            state.page = Math.max(1, positiveInteger(saved.page) || 1);
            state.category = typeof saved.category === 'string' ? saved.category : '';
            state.keyword = typeof saved.keyword === 'string' ? saved.keyword.slice(0, 100) : '';
            byId('sourceCatalogKeyword').value = state.keyword;
        }
        loadPage(!previous || previous.url !== state.source?.url || state.category === '');
    };

    window.openSourceCatalog = function openSourceCatalog(code) {
        state.requestedCode = code;
        navigateToTab('sources');
    };
})();
