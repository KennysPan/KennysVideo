(() => {
    let dialog, controller;
    let sending = false;
    let sent = false;
    let submission;
    let deviceId;
    function installationId() {
        if (deviceId) return deviceId;
        try { deviceId = localStorage.getItem('kennysvideo.feedback.device'); } catch { /* Storage may be disabled. */ }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(deviceId || '')) {
            deviceId = crypto.randomUUID();
            try { localStorage.setItem('kennysvideo.feedback.device', deviceId); } catch { /* Retain the identifier for this window. */ }
        }
        return deviceId;
    }
    const ready = () => {
        try {
            const endpoint = new URL(BUG_REPORT_CONFIG.endpoint);
            return BUG_REPORT_CONFIG.enabled === true && !endpoint.username && !endpoint.password &&
                (endpoint.protocol === 'https:' || endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname));
        } catch { return false; }
    };
    const field = name => dialog.querySelector(`[name="${name}"]`);

    function status(message, success = false) {
        const element = dialog.querySelector('.bug-report-status');
        element.textContent = message;
        element.dataset.success = String(success);
    }

    function updateButtons() {
        dialog.querySelector('[type="submit"]').disabled = sending || sent || !ready();
        dialog.querySelector('[data-dismiss]').disabled = sending;
        dialog.querySelector('[type="submit"]').textContent = sending ? '正在发送…' : sent ? '已提交' : '发送报告';
        for (const input of dialog.querySelectorAll('input, textarea')) input.disabled = sending || sent;
    }

    async function submit(event) {
        event.preventDefault();
        if (sending || sent || !ready() || !dialog.querySelector('form').reportValidity()) return;
        const title = field('title').value.trim();
        const description = field('description').value.trim();
        const steps = field('steps').value.trim();
        const email = field('email').value.trim();
        if (!title || title.length > 100 || !description || description.length > 4000 || steps.length > 2000 || email.length > 254) {
            status('请填写问题标题和问题描述，内容不能只包含空格');
            return;
        }
        const version = SITE_CONFIG.version;
        const platform = navigator.userAgentData?.platform || navigator.platform || '未知';
        const report = { title, description, steps, reply_email: email, version, platform, device_id: installationId(), privacy_version: 2 };
        const fingerprint = JSON.stringify(report);
        if (!submission || submission.fingerprint !== fingerprint) {
            submission = { fingerprint, id: crypto.randomUUID() };
        }
        const payload = { request_id: submission.id, ...report };
        sending = true;
        updateButtons();
        status('正在提交报告，请稍候…');
        controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(BUG_REPORT_CONFIG.endpoint, {
                method: 'POST', headers: {'Content-Type':'application/json','Accept':'application/json'},
                body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
            });
            let result;
            try { result = await response.json(); } catch { throw new Error('服务未返回有效结果，请稍后重试'); }
            if (response.status === 429) throw new Error('反馈过于频繁或发送额度已用完，请稍后再试');
            if (response.status === 423 && result?.code === 'device_blocked') {
                const until = new Date(Number(result.blocked_until) * 1000);
                throw new Error(`此设备的反馈功能暂时受限${Number.isFinite(until.getTime()) ? '，恢复时间：' + until.toLocaleString('zh-CN') : '，请稍后再试'}。其他功能不受影响，内容已保留`);
            }
            if (response.status === 503) throw new Error('反馈服务暂不可用，内容已保留，请稍后重试');
            if (response.status === 400) throw new Error('报告格式未通过校验，内容已保留（400）');
            if (response.status === 403) throw new Error('反馈服务拒绝了当前应用来源，内容已保留（403）');
            if (response.status === 409) {
                submission = null;
                throw new Error('报告编号发生冲突，内容已保留，请再次点击发送（409）');
            }
            if (response.status === 413) throw new Error('报告内容过大，请缩短描述后再试（413）');
            if (!response.ok || result?.success !== true) throw new Error('报告未能提交，请检查网络后重试');
            if (result.status === 'failed') throw new Error('报告已保存，但邮件发送失败，请稍后联系开发者');
            sent = true;
            status(result.status === 'sent' ? '报告已提交，邮件已发送。感谢你的反馈！' : '报告已提交，服务器已保存并加入发送队列。感谢你的反馈！', true);
        } catch (error) {
            status(error?.name === 'AbortError'
                ? '等待结果超时，暂时无法确认是否送达，请稍后再试'
                : error instanceof TypeError ? '网络连接失败，内容已保留，请检查网络后重试' : error.message);
        } finally {
            clearTimeout(timeout);
            controller = null;
            sending = false;
            updateButtons();
        }
    }

    window.openBugReport = function openBugReport() {
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'bugReportDialog';
            dialog.className = 'bug-report-dialog';
            dialog.setAttribute('aria-labelledby', 'bugReportTitle');
            dialog.innerHTML = '<form><h2 id="bugReportTitle">反馈 BUG</h2><p class="bug-report-device"></p><label>问题标题<input name="title" required maxlength="100" placeholder="例如：点击全屏后进度条不显示" autofocus></label><label>问题描述<textarea name="description" required maxlength="4000" placeholder="请说明遇到的问题、预期结果和实际情况"></textarea></label><label>复现步骤（可选）<textarea name="steps" maxlength="2000" placeholder="例如：打开影片 → 点击全屏 → …"></textarea></label><label>回复邮箱（可选）<input name="email" type="email" maxlength="254" autocomplete="email" placeholder="方便开发者联系你"></label><p style="margin-top:16px">点击发送后，你填写的内容、软件版本及运行平台将提交到开发者的反馈服务器，保存最多 30 天，并通过邮件转交开发者。</p><p class="bug-report-status" role="status" aria-live="polite"></p><div class="bug-report-actions"><button type="button" data-dismiss>取消</button><button type="submit">发送报告</button></div></form>';
            dialog.querySelector('form > p[style]').textContent = '点击发送后，填写内容、软件版本及平台将提交到开发者服务器并通过邮件转交。服务器同时记录来源 IP 和随机安装标识摘要，仅管理员可见，用于处理滥发；不读取硬件序列号。报告及 IP 最多保留 30 天；反馈禁用记录在期限内保留（最多 365 天），到期恢复。';
            dialog.querySelector('form').addEventListener('submit', submit);
            dialog.querySelector('[data-dismiss]').addEventListener('click', () => { if (!sending) dialog.close(); });
            dialog.addEventListener('cancel', event => { if (sending) event.preventDefault(); });
            document.body.append(dialog);
        }
        if (dialog.open) return;
        if (sent) { dialog.querySelector('form').reset(); sent = false; submission = null; }
        dialog.querySelector('.bug-report-device').textContent = `软件版本 ${SITE_CONFIG.version} · ${navigator.userAgentData?.platform || navigator.platform || '未知平台'}`;
        status(ready() ? '' : '反馈通道尚未启用，请稍后再试。');
        updateButtons();
        dialog.showModal();
    };
})();
