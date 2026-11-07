// Shared by every page; only known palette identifiers enter the DOM/storage.
(() => {
    const names = { blue: '青蓝', emerald: '翡翠', violet: '紫罗兰', rose: '玫瑰' };
    const key = 'kennysTheme';
    function restore() {
        let selected = 'blue';
        try { const value = localStorage.getItem(key); if (Object.hasOwn(names, value)) selected = value; } catch (_) {}
        document.documentElement.dataset.theme = selected;
        document.querySelectorAll('[data-theme-choice]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.themeChoice === selected));
        });
        const status = document.getElementById('themeStatus');
        if (status) status.textContent = `当前配色：${names[selected]} · 自动记住选择`;
    }
    window.restoreKennysTheme = restore;
    window.setKennysTheme = function (value) {
        if (!Object.hasOwn(names, value)) return;
        try { localStorage.setItem(key, value); restore(); }
        catch (_) { window.showToast?.('无法保存主题，请检查存储空间', 'error'); }
    };
    restore();
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-theme-choice]').forEach(button => {
            button.addEventListener('click', () => window.setKennysTheme(button.dataset.themeChoice));
        });
        restore();
    });
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) restore(); });
})();
