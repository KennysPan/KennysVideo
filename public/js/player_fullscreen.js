// Use the desktop window for native fullscreen, not WebView-only fullscreen.
function setupPlayerFullscreen(player) {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    const native = typeof invoke === 'function';
    let active = false;
    let pending = Promise.resolve();

    function updateLayout(fullscreen) {
        active = fullscreen;
        document.body.classList.toggle('dplayer-custom-fullscreen-mode', fullscreen);
        if (native) player.container.classList.toggle('dplayer-fulled', fullscreen);
        requestAnimationFrame(() => {
            player.resize();
            player.controller.show();
        });
    }

    if (!native) {
        // DPlayer owns browser fullscreen. Do not issue a second request on the document.
        player.on('fullscreen', () => updateLayout(true));
        player.on('fullscreen_cancel', () => updateLayout(false));
        player.on('webfullscreen', () => updateLayout(true));
        player.on('webfullscreen_cancel', () => updateLayout(false));
        return;
    }

    function setFullscreen(fullscreen) {
        // Serialize quick clicks so native and player states cannot finish out of order.
        pending = pending.then(async () => {
            if (active === fullscreen) return;
            await invoke('set_player_fullscreen', { fullscreen });
            updateLayout(fullscreen);
            player.events.trigger(fullscreen ? 'fullscreen' : 'fullscreen_cancel');
        }).catch(error => {
            console.error('无法切换桌面全屏:', error);
            player.notice('无法切换全屏，请重试');
        });
        return pending;
    }

    player.fullScreen.isFullScreen = () => active;
    player.fullScreen.request = () => setFullscreen(true);
    player.fullScreen.cancel = () => setFullscreen(false);

    const onKeyDown = event => {
        if (event.key === 'Escape' && active) {
            event.preventDefault();
            setFullscreen(false);
        }
    };
    document.addEventListener('keydown', onKeyDown);
    player.on('destroy', () => {
        document.removeEventListener('keydown', onKeyDown);
        // Changing episodes replaces DPlayer; release its fullscreen state too.
        document.body.classList.remove('dplayer-custom-fullscreen-mode');
        invoke('set_player_fullscreen', { fullscreen: false }).catch(console.error);
    });
}
