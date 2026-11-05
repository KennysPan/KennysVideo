// Shared player input. Android adjusts the real media stream and this window's brightness.
function setupPlayerInteractions(player) {
    const android = window.KENNYS_PLATFORM === 'android';
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    const surface = player.container.querySelector('.dplayer-video-wrap');
    const video = player.video;
    if (android && invoke) invoke('get_player_controls').then(settings => {
        if (!settings.volume_fixed && !destroyed) player.volume(1, true, true);
    }).catch(() => {});
    const locked = () => !!document.querySelector('#playerContainer.controls-locked');
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const feedback = document.createElement('div');
    feedback.className = 'player-input-feedback';
    feedback.hidden = true;
    feedback.setAttribute('role', 'status');
    player.container.append(feedback);
    let hideTimer, destroyed = false;
    function show(message) {
        if (destroyed) return;
        clearTimeout(hideTimer);
        feedback.textContent = message;
        feedback.hidden = false;
        hideTimer = setTimeout(() => { feedback.hidden = true; }, 1000);
    }
    function seekable() { return Number.isFinite(video.duration) && video.duration > 0; }
    function time(value) {
        const seconds = Math.max(0, Math.floor(value));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const ignoredKeys = target => target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],dialog[open]');
    const keydown = event => {
        if (android || locked() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || ignoredKeys(event.target) || document.querySelector('dialog[open]')) return;
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key)) return;
        if (event.key === ' ' && event.target?.closest('button,a,[role="button"]')) return;
        event.preventDefault();
        if (event.key === ' ') { player.toggle(); return; }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            if (!seekable()) { show('当前视频暂不支持快进快退'); return; }
            const delta = event.key === 'ArrowRight' ? 5 : -5;
            const target = clamp(video.currentTime + delta, 0, Math.max(0, video.duration - 0.1));
            player.seek(target);
            show(`${delta > 0 ? '快进' : '后退'} 5 秒 · ${time(target)} / ${time(video.duration)}`);
        } else {
            const value = clamp((video.muted ? 0 : video.volume) + (event.key === 'ArrowUp' ? 0.05 : -0.05), 0, 1);
            player.volume(value, true, true);
            show(`音量 ${Math.round(value * 100)}%`);
        }
    };
    document.addEventListener('keydown', keydown);

    let gesture = null, suppressClickUntil = 0, queue = [], sending = false;
    async function flush() {
        if (sending) return;
        sending = true;
        while (queue.length && !destroyed) {
            const job = queue.shift();
            try {
                const result = await invoke('set_player_control', job);
                if (gesture?.kind === job.control) show(`${job.control === 'brightness' ? '亮度' : '音量'} ${Math.round(result.value * 100)}%`);
            } catch { show('调节失败，请稍后重试'); queue = []; }
        }
        sending = false;
    }
    function enqueue(control, value) {
        queue = queue.filter(job => job.control !== control);
        queue.push({control, value});
        flush();
    }
    function applyVertical(state) {
        if (destroyed || (gesture !== state && !state.commitOnRead) || !state.settings || !state.kind || state.kind === 'seek') return;
        const value = clamp(state.settings[state.kind] + state.delta, state.kind === 'brightness' ? 0.02 : 0, 1);
        if (state.kind === 'volume' && state.settings.volume_fixed) {
            player.volume(value, true, true);
        } else if (invoke) {
            if (state.kind === 'volume') { video.muted = false; player.volume(1, true, true); }
            enqueue(state.kind, value);
        }
        show(`${state.kind === 'brightness' ? '亮度' : '音量'} ${Math.round(value * 100)}%`);
    }
    const interactive = target => target?.closest('button,a,input,select,textarea,.dplayer-controller,.dplayer-setting,.dplayer-contextmenu,.dplayer-bar-wrap');
    const start = event => {
        gesture = null;
        if (!android || locked() || event.touches.length !== 1 || interactive(event.target)) return;
        const touch = event.touches[0], rect = surface.getBoundingClientRect();
        const state = {id:touch.identifier, x:touch.clientX, y:touch.clientY, rect, startTime:video.currentTime, side:touch.clientX < rect.left + rect.width / 2 ? 'brightness' : 'volume', kind:null, delta:0};
        gesture = state;
        if (invoke) invoke('get_player_controls').then(settings => {
            if (gesture !== state && !state.commitOnRead) return;
            state.settings = settings;
            if (settings.volume_fixed) state.settings.volume = video.muted ? 0 : video.volume;
            applyVertical(state);
        }).catch(() => { if (gesture === state) { state.failed = true; if (state.kind && state.kind !== 'seek') show('无法读取亮度或音量'); } });
    };
    const move = event => {
        const state = gesture;
        if (!state) return;
        if (event.touches.length !== 1 || locked()) { gesture = null; return; }
        const touch = [...event.touches].find(t => t.identifier === state.id);
        if (!touch) return;
        const dx = touch.clientX - state.x, dy = touch.clientY - state.y;
        if (!state.kind) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
            if (Math.abs(dx) > Math.abs(dy) * 1.15) state.kind = 'seek';
            else if (Math.abs(dy) > Math.abs(dx) * 1.15) state.kind = state.side;
            else return;
            player.container.dispatchEvent(new Event('player-gesture-start'));
        }
        event.preventDefault(); event.stopImmediatePropagation();
        if (state.kind === 'seek') {
            if (!seekable()) { state.target = null; show('当前视频暂不支持快进快退'); return; }
            const delta = dx / Math.max(1, state.rect.width) * 120;
            state.target = clamp(state.startTime + delta, 0, Math.max(0, video.duration - 0.1));
            const change = Math.round(state.target - state.startTime);
            show(`${change >= 0 ? '快进' : '后退'} ${Math.abs(change)} 秒 · ${time(state.target)} / ${time(video.duration)}`);
        } else {
            state.delta = -dy / Math.max(1, state.rect.height) * 1.2;
            if (state.failed) show('无法读取亮度或音量'); else applyVertical(state);
        }
    };
    const end = event => {
        if (!gesture) return;
        const state = gesture;
        if (state.kind) {
            event.preventDefault(); event.stopImmediatePropagation();
            suppressClickUntil = Date.now() + 500;
            if (event.type !== 'touchcancel' && !locked() && state.kind === 'seek' && Number.isFinite(state.target)) player.seek(state.target);
            if (event.type !== 'touchcancel' && !locked() && state.kind !== 'seek' && !state.settings) state.commitOnRead = true;
        }
        gesture = null;
    };
    const click = event => {
        if (Date.now() < suppressClickUntil && !interactive(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    if (surface && android) {
        surface.classList.add('player-touch-surface');
        surface.addEventListener('touchstart', start, {capture:true, passive:true});
        surface.addEventListener('touchmove', move, {capture:true, passive:false});
        surface.addEventListener('touchend', end, {capture:true, passive:false});
        surface.addEventListener('touchcancel', end, {capture:true, passive:false});
        surface.addEventListener('click', click, true);
    }
    player.on('destroy', () => {
        destroyed = true; gesture = null; queue = []; clearTimeout(hideTimer);
        document.removeEventListener('keydown', keydown);
        if (surface) {
            for (const [type, listener] of [['touchstart',start],['touchmove',move],['touchend',end],['touchcancel',end],['click',click]]) surface.removeEventListener(type, listener, true);
        }
        feedback.remove();
        if (android && invoke) invoke('set_player_control', {control:'brightness', value:-1}).catch(() => {});
    });
}
