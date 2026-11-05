// Android-specific presentation and back navigation; no privileged JS interface.
window.KENNYS_PLATFORM = /Android/i.test(navigator.userAgent) ? 'android' : 'desktop';
if (window.KENNYS_PLATFORM === 'android') {
    document.documentElement.classList.add('android-app');
    window.handleAndroidBack = () => {
        const dialogs = [...document.querySelectorAll('dialog[open]')];
        if (dialogs.length) {
            const dialog = dialogs.at(-1);
            if (dialog.dispatchEvent(new Event('cancel', {cancelable:true}))) dialog.close();
            return true;
        }
        if (document.body.classList.contains('dplayer-custom-fullscreen-mode')) {
            document.dispatchEvent(new Event('kennysvideo-android-back'));
            return true;
        }
        const details = document.getElementById('modal');
        if (details && !details.classList.contains('hidden')) { details.classList.add('hidden'); return true; }
        if (location.pathname.endsWith('player.html')) { document.getElementById('goBack')?.click(); return true; }
        if (typeof getCurrentPageId === 'function' && getCurrentPageId() !== 'home') {
            navigateToTab('home'); return true;
        }
        return false; // Native Activity moves the task into the background.
    };
    document.addEventListener('DOMContentLoaded', () => {
        const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
        if (invoke) invoke('set_player_fullscreen', {fullscreen:false}).catch(console.warn);
        if (invoke && !location.pathname.endsWith('player.html')) invoke('set_player_control', {control:'brightness',value:-1}).catch(() => {});
    });
}
