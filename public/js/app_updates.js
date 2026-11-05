// Native commands own version comparison, source selection and verified installers.
let checkingAppUpdate = false;
async function checkAppUpdate(startup = false) {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    const status = document.getElementById('appUpdateStatus');
    const button = document.getElementById('checkAppUpdateButton');
    const existing = document.getElementById('appUpdateDialog');
    if (existing && existing.dataset.phase !== 'available') {
        if (!startup) existing.reopen();
        return;
    }
    if (checkingAppUpdate) return;
    if (!invoke) { if (status) status.textContent = '请在 KennysVideo 客户端内检查更新'; return; }
    checkingAppUpdate = true;
    if (button) button.disabled = true;
    if (status) status.textContent = '正在检查更新…';
    try {
        const result = await invoke('check_app_update', { startup });
        if (!result) { if (status) status.textContent = '本次启动已检查，可点击重新检查'; return; }
        if (status) status.textContent = !result.latest_version ? '尚无可用的正式发布版本' : result.available ? `发现新版本 ${result.latest_version}（当前 ${result.current_version}）` : `当前 ${result.current_version}，已是最新版本`;
        if (status && result.source) status.textContent += ` · ${result.source === 'github' ? 'GitHub' : 'Gitee'}`;
        if (result.available) showAppUpdate(result, invoke);
    } catch (error) {
        if (status) status.textContent = '暂时无法检查更新，请稍后重试（不影响使用）';
        console.warn('Update check failed:', error);
    } finally {
        checkingAppUpdate = false;
        if (button) button.disabled = false;
    }
}

// Render our release-note Markdown without accepting HTML or external embeds.
function renderUpdateNotes(container, text) {
    let list;
    for (const line of text.split('\n')) {
        const bullet = line.match(/^\s*(?:[-*+] |\d+\. )(.*)$/);
        let row;
        if (bullet) {
            if (!list) { list = document.createElement('ul'); container.append(list); }
            row = document.createElement('li'); list.append(row);
        } else {
            list = null;
            if (!line.trim()) continue;
            row = document.createElement(/^#{1,4} /.test(line) ? 'h4' : 'p'); container.append(row);
        }
        const content = bullet ? bullet[1] : line.replace(/^#{1,4} /, '');
        content.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                const strong = document.createElement('strong'); strong.textContent = part.slice(2, -2); row.append(strong);
            } else row.append(document.createTextNode(part));
        });
    }
}

function showAppUpdate(result, invoke) {
    const previous = document.getElementById('appUpdateDialog');
    if (previous) {
        if (previous.dataset.version === result.latest_version || previous.dataset.phase !== 'available') { previous.reopen(); return; }
        previous.dispose();
    }
    const android = window.KENNYS_PLATFORM === 'android';
    const dialog = document.createElement('dialog');
    dialog.id = 'appUpdateDialog';
    dialog.dataset.phase = 'available';
    dialog.dataset.version = result.latest_version;
    dialog.setAttribute('aria-labelledby', 'appUpdateTitle');
    dialog.setAttribute('aria-describedby', 'appUpdateCurrentVersion');
    dialog.innerHTML = `
        <div class="update-dialog-layout">
            <header class="update-dialog-header">
                <img class="update-app-logo" src="image/kennys-logo.png" alt="" width="60" height="60">
                <div class="update-heading"><h2 id="appUpdateTitle"></h2><p id="appUpdateCurrentVersion" class="update-version"></p></div>
                <button type="button" class="update-close" aria-label="关闭更新弹窗">×</button>
            </header>
            <section class="update-release-notes" tabindex="0" aria-label="本次更新内容">
                <h3></h3><div class="update-release-notes-body"></div>
                <button type="button" class="update-changelog">查看完整更新日志 <span aria-hidden="true">↗</span></button>
            </section>
            <div class="update-download-state">
                <p class="update-intro"></p>
                <div class="update-progress-panel" hidden>
                    <div class="update-progress-heading"><span class="update-bytes">正在下载更新…</span><span class="update-percent">—</span></div>
                    <progress class="update-progress" aria-label="更新下载进度" max="100" value="0"></progress>
                    <p class="update-source"></p>
                </div>
                <p class="update-ready" role="status" hidden><span aria-hidden="true">✓</span><span class="update-ready-text"></span></p>
                <p class="update-error" role="status" hidden></p>
            </div>
            <footer class="update-dialog-footer">
                <button type="button" class="update-dismiss">稍后再说</button>
                <button type="button" class="update-manual">手动下载</button>
                <button type="button" class="update-download">下载更新</button>
                <button type="button" class="update-background" hidden>转到后台下载</button>
            </footer>
        </div>`;
    const title = dialog.querySelector('#appUpdateTitle');
    const intro = dialog.querySelector('.update-intro');
    const download = dialog.querySelector('.update-download');
    const dismiss = dialog.querySelector('.update-dismiss');
    const manual = dialog.querySelector('.update-manual');
    const background = dialog.querySelector('.update-background');
    const message = dialog.querySelector('.update-error');
    const ready = dialog.querySelector('.update-ready');
    const progressPanel = dialog.querySelector('.update-progress-panel');
    const bar = progressPanel.querySelector('progress');
    const percentage = progressPanel.querySelector('.update-percent');
    const amount = progressPanel.querySelector('.update-bytes');
    const sourceLabel = progressPanel.querySelector('.update-source');
    const status = document.getElementById('appUpdateStatus');
    const checkButton = document.getElementById('checkAppUpdateButton');
    const badge = document.createElement('button');
    badge.type = 'button'; badge.className = 'update-background-status'; badge.hidden = true;
    badge.setAttribute('aria-label', '查看更新下载进度');
    badge.onclick = () => dialog.reopen();
    let active = false, switched = false, disposed = false;
    let badgeText = '正在下载更新…';
    title.textContent = `KennysVideo ${result.latest_version} 可用`;
    dialog.querySelector('.update-version').textContent = `当前版本 ${result.current_version}`;
    dialog.querySelector('.update-release-notes h3').textContent = android ? '本次更新 · 手机端' : '本次更新 · 电脑端';
    renderUpdateNotes(dialog.querySelector('.update-release-notes-body'), result.release_notes || '此版本未提供更新说明，可前往发布页面查看。');
    intro.textContent = android ? '下载并校验更新包后，由 Android 系统确认安装。覆盖更新保留设置和观看历史。' : '优先使用 GitHub，超时或下载过慢自动切换 Gitee。覆盖更新保留设置和观看历史。';
    function syncBadge() {
        badge.hidden = dialog.open || dialog.dataset.phase === 'available';
        badge.textContent = badgeText;
        if (status && dialog.dataset.phase !== 'available') status.textContent = badgeText;
        if (checkButton) checkButton.textContent = dialog.dataset.phase === 'downloading' ? '查看下载进度' : dialog.dataset.phase === 'ready' ? '查看安装更新' : dialog.dataset.phase === 'error' ? '重试更新' : '检查更新';
    }
    dialog.reopen = () => {
        if (!dialog.open) dialog.showModal();
        syncBadge();
        (dialog.dataset.phase === 'downloading' ? background : download).focus();
    };
    dialog.dispose = () => {
        disposed = true;
        window.removeEventListener('app-update-progress', onProgress);
        badge.remove(); dialog.remove();
    };
    dialog.querySelector('.update-close').onclick = dismiss.onclick = background.onclick = () => dialog.close();
    dialog.addEventListener('close', syncBadge);
    async function openReleasePage() {
        try { await invoke('open_app_download_page'); }
        catch { message.hidden = false; message.textContent = '无法打开浏览器，请稍后重试'; }
    }
    manual.onclick = dialog.querySelector('.update-changelog').onclick = openReleasePage;
    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    function renderProgress(progress) {
        if (progress.stage === 'fallback') switched = true;
        sourceLabel.textContent = `${switched ? '已切换至 ' : '下载来源：'}${progress.source === 'github' ? 'GitHub' : 'Gitee'}`;
        const total = Number(progress.total) > 0 ? Number(progress.total) : null;
        const bytes = Math.max(0, Number(progress.downloaded) || 0);
        amount.textContent = bytes ? `已下载 ${formatBytes(bytes)}${total ? ` / ${formatBytes(total)}` : ' · 总大小未知'}` : '正在连接下载源…';
        if (progress.stage === 'ready') { bar.value = 100; percentage.textContent = '100%'; }
        else if (total) { bar.value = Math.min(99, Math.floor(bytes / total * 100)); percentage.textContent = `${bar.value}%`; }
        else { bar.removeAttribute('value'); percentage.textContent = '—'; }
        if (progress.stage === 'verifying') amount.textContent = '正在校验并保存安装包…';
        if (progress.stage === 'fallback') amount.textContent = '正在切换下载源，重新下载…';
        badgeText = `正在更新至 ${result.latest_version}${total ? ` · ${percentage.textContent}` : '…'}`;
        syncBadge();
    }
    const onProgress = event => { if (active && event.detail) renderProgress(event.detail); };
    window.addEventListener('app-update-progress', onProgress);
    async function installUpdate() {
        download.disabled = true;
        try { await invoke('install_app_update'); }
        catch (error) {
            message.hidden = false;
            message.textContent = android ? `未启动安装：${String(error)}。允许安装后可再次点击，或选择手动下载。` : '安装器启动失败，可重试或选择手动下载。';
            manual.hidden = false;
        } finally { download.disabled = false; }
    }
    download.onclick = async () => {
        if (active) return;
        if (dialog.dataset.phase === 'ready') { await installUpdate(); return; }
        active = true; switched = false;
        dialog.dataset.phase = 'downloading';
        title.textContent = `KennysVideo ${result.latest_version} 正在下载`;
        intro.hidden = message.hidden = ready.hidden = true;
        download.hidden = dismiss.hidden = manual.hidden = true;
        background.hidden = false; background.focus();
        progressPanel.hidden = false;
        renderProgress({stage:'connecting',source:result.source,downloaded:0,total:null});
        try {
            const downloaded = await invoke('download_app_update');
            if (disposed) return;
            renderProgress({stage:'ready',source:downloaded.source,downloaded:downloaded.bytes,total:downloaded.bytes});
            dialog.dataset.phase = 'ready';
            title.textContent = `KennysVideo ${result.latest_version} 已下载`;
            progressPanel.hidden = true; ready.hidden = false;
            dialog.querySelector('.update-ready-text').textContent = android ? '更新已下载并通过校验，点击安装后由系统确认。' : '更新已下载并通过校验，安装时将关闭 KennysVideo。';
            badgeText = `${result.latest_version} 已下载 · 点击安装`;
            download.textContent = android ? '安装更新' : '关闭程序并安装';
            dismiss.textContent = '稍后安装';
        } catch {
            dialog.dataset.phase = 'error';
            title.textContent = `KennysVideo ${result.latest_version} 下载未完成`;
            message.hidden = false;
            message.textContent = '下载未完成或校验失败，请重试，也可选择手动下载。';
            download.textContent = '重试下载';
            percentage.textContent = '未完成';
            if (!bar.hasAttribute('value')) bar.value = 0;
            badgeText = '更新下载未完成 · 点击重试';
        } finally {
            active = false;
            download.hidden = dismiss.hidden = false;
            manual.hidden = dialog.dataset.phase === 'ready';
            background.hidden = true;
            syncBadge();
            if (dialog.open) download.focus();
        }
    };
    document.body.append(dialog, badge);
    dialog.reopen();
}

document.addEventListener('DOMContentLoaded', () => { checkAppUpdate(true); });


