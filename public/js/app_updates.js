// Native commands own version comparison, source selection and verified installers.
let checkingAppUpdate = false;
async function checkAppUpdate(startup = false) {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    const status = document.getElementById('appUpdateStatus');
    const button = document.getElementById('checkAppUpdateButton');
    if (checkingAppUpdate) return;
    if (!invoke) { if (status) status.textContent = '请在 Windows 客户端内检查更新'; return; }
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

function showAppUpdate(result, invoke) {
    if (document.getElementById('appUpdateDialog')?.open) return;
    document.getElementById('appUpdateDialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'appUpdateDialog';
    dialog.setAttribute('aria-labelledby', 'appUpdateTitle');
    dialog.style.cssText = 'max-width:440px;width:calc(100% - 40px);padding:24px;border:1px solid #155e75;border-radius:14px;background:#111c2b;color:#f0f9ff;';
    dialog.innerHTML = '<h2 id="appUpdateTitle" style="font-size:22px;font-weight:bold;color:#67e8f9">发现新版本</h2><p class="update-version" style="margin:16px 0"></p><p style="font-size:14px;color:#a8bbc9">优先使用 GitHub，超时或下载过慢会自动切换 Gitee。下载完成后点击安装，程序会关闭并启动安装器，保留设置和观看历史。</p><p class="update-error" role="status" style="margin-top:12px;color:#a5f3fc"></p><div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:24px"><button class="update-dismiss" style="padding:8px 12px">稍后再说</button><button class="update-manual" style="padding:8px 12px">手动下载</button><button class="update-download theme-action" style="padding:8px 12px;border-radius:8px">下载更新</button></div>';
    dialog.querySelector('.update-version').textContent = `${result.current_version} → ${result.latest_version}`;
    dialog.querySelector('.update-dismiss').onclick = () => dialog.close();
    dialog.querySelector('.update-manual').onclick = async () => {
        try { await invoke('open_app_download_page'); dialog.close(); }
        catch { dialog.querySelector('.update-error').textContent = '无法打开浏览器，请稍后重试'; }
    };
    const download = dialog.querySelector('.update-download');
    const message = dialog.querySelector('.update-error');
    const progressPanel = document.createElement('div');
    progressPanel.className = 'update-progress-panel';
    progressPanel.hidden = true;
    progressPanel.style.cssText = 'margin-top:20px';
    progressPanel.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:14px"><span class="update-source"></span><span class="update-percent">0%</span></div><progress class="update-progress" aria-label="更新下载进度" max="100" value="0" style="display:block;width:100%;height:14px;accent-color:#22d3ee"></progress><p class="update-bytes" style="font-size:13px;color:#a8bbc9;margin-top:8px">0 B</p>';
    dialog.insertBefore(progressPanel, message);
    const bar = progressPanel.querySelector('progress');
    const percentage = progressPanel.querySelector('.update-percent');
    const amount = progressPanel.querySelector('.update-bytes');
    const sourceLabel = progressPanel.querySelector('.update-source');
    let active = false;
    let switched = false;
    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    function renderProgress(progress) {
        if (progress.stage === 'fallback') switched = true;
        const source = progress.source === 'github' ? 'GitHub' : 'Gitee';
        sourceLabel.textContent = `${switched ? '已切换至 ' : '下载来源：'}${source}`;
        const total = Number(progress.total) > 0 ? Number(progress.total) : null;
        const bytes = Math.max(0, Number(progress.downloaded) || 0);
        amount.textContent = `${formatBytes(bytes)}${total ? ` / ${formatBytes(total)}` : ' · 正在获取总大小'}`;
        if (progress.stage === 'ready') {
            bar.value = 100;
            percentage.textContent = '100%';
        } else if (total) {
            // Completion means verified and saved, not merely received over the network.
            const percent = Math.min(99, Math.floor(bytes / total * 100));
            bar.value = percent;
            percentage.textContent = `${percent}%`;
        } else {
            bar.removeAttribute('value');
            percentage.textContent = '等待中';
        }
        if (progress.stage === 'fallback') message.textContent = 'GitHub 下载失败、超时或过慢，正从 Gitee 重新下载…';
        else if (progress.stage === 'connecting') message.textContent = '正在连接下载源…';
        else if (progress.stage === 'verifying') message.textContent = '下载已接收，正在校验并保存安装包…';
        else if (progress.stage === 'downloading') {
            message.textContent = total ? '正在下载安装包…' : '正在下载安装包，服务器未提供总大小…';
            if (!total) { percentage.textContent = '下载中'; amount.textContent = `${formatBytes(bytes)} · 总大小未知`; }
        }
    }
    const onProgress = event => { if (active && event.detail) renderProgress(event.detail); };
    window.addEventListener('app-update-progress', onProgress);
    download.onclick = async () => {
        if (active) return;
        active = true;
        switched = false;
        dialog.querySelector('#appUpdateTitle').hidden = true;
        dialog.querySelector('.update-version').nextElementSibling.hidden = true;
        message.hidden = true;
        download.parentElement.style.display = 'none';
        progressPanel.hidden = false;
        renderProgress({stage:'connecting',source:result.source,downloaded:0,total:null});
        download.disabled = true;
        download.textContent = '正在下载…';
        try {
            const downloaded = await invoke('download_app_update');
            renderProgress({stage:'ready',source:downloaded.source,downloaded:downloaded.bytes,total:downloaded.bytes});
            message.textContent = `下载完成（${downloaded.source === 'github' ? 'GitHub' : 'Gitee'}），安装包校验通过。`;
            download.textContent = '关闭程序并安装';
            download.onclick = async () => {
                download.disabled = true;
                try { await invoke('install_app_update'); }
                catch { message.textContent = '安装器启动失败，可重试或选择手动下载。'; download.disabled = false; }
            };
        } catch {
            message.hidden = false;
            message.textContent = '下载未完成或校验失败，请重试，也可选择手动下载。';
            download.textContent = '重试下载';
            percentage.textContent = '未完成';
            if (!bar.hasAttribute('value')) bar.value = 0;
        } finally { active = false; download.disabled = false; download.parentElement.style.display = 'flex'; }
    };
    dialog.addEventListener('close', () => { window.removeEventListener('app-update-progress', onProgress); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('.update-dismiss').focus();
}
document.addEventListener('DOMContentLoaded', () => { checkAppUpdate(true); });
