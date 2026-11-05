(() => {
    const root = '/feedback-admin', $ = id => document.getElementById(id);
    let csrf = '', page = 1, view = 'reports', target = null, loading = false;
    const categories = {unreviewed:'待处理', actionable:'有效问题', spam:'垃圾内容', abuse:'辱骂 / 滥发', duplicate:'重复报告', other:'其他'};
    const stateNames = {queued:'等待发送', sending:'正在发送', sent:'邮件已发送', failed:'邮件发送失败'};
    const date = value => new Date(value * 1000).toLocaleString('zh-CN', {hour12:false});
    function message(text, error = false) { $('status').textContent = text; $('status').dataset.error = String(error); }
    function authenticated(value) { $('workspace').hidden = !value; $('logout').hidden = !value; $('changePassword').hidden = !value; $('login').hidden = value; }
    async function api(path, body) {
        const response = await fetch(root + path, {method:body === undefined ? 'GET' : 'POST', credentials:'same-origin',
            headers:body === undefined ? {} : {'Content-Type':'application/json', 'X-CSRF-Token':csrf}, body:body === undefined ? undefined : JSON.stringify(body)});
        const result = await response.json();
        if (!response.ok) {
            if (response.status === 401) authenticated(false);
            const errors = {invalid_credentials:'密码错误', login_required:'会话已过期，请重新登录', login_rate_limited:'登录尝试过多，请 15 分钟后再试', csrf_failed:'会话校验失败，请刷新后重试', legacy_device_unavailable:'旧版报告没有安装标识，无法禁用设备', invalid_ban:'请填写 1–365 天及处理原因', admin_not_configured:'管理员账号尚未配置'};
            const passwordErrors = {current_password_incorrect:'当前密码不正确', invalid_new_password:'新密码需要 6–256 个字符，不能全部为空格', password_rate_limited:'当前密码尝试过多，请 15 分钟后再试'};
            throw Error(errors[result.code] || passwordErrors[result.code] || `操作失败（${response.status}），请刷新后重试`);
        }
        return result;
    }
    function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
    function button(text, action, className) { const b = node('button', text, className); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await action(); } catch (e) { message(e.message, true); } finally { b.disabled = false; } }); return b; }
    function reportCard(r) {
        const card = node('article');
        card.append(node('span', categories[r.category] || r.category, 'tag'), node('span', stateNames[r.state] || r.state, 'tag'), node('h3', r.title));
        card.append(node('div', `${date(r.created)} · v${r.version} · ${r.platform}`, 'meta'));
        card.append(node('div', `来源 IP：${r.source_ip || '旧版未记录'}　安装标识：${r.device || '旧版未提供'}`, 'meta'));
        card.append(node('div', `报告编号：${r.id}${r.reply_email ? '　回复邮箱：' + r.reply_email : ''}`, 'meta'));
        card.append(node('p', '问题描述'), node('div', r.description, 'content'));
        if (r.steps) card.append(node('p', '复现步骤'), node('div', r.steps, 'content'));
        const actions = node('div', undefined, 'actions'), select = node('select');
        select.setAttribute('aria-label', '报告处理分类');
        for (const [value,label] of Object.entries(categories)) { const option = node('option',label); option.value = value; select.append(option); }
        select.value = r.category;
        actions.append(select, button('保存分类', async () => { await api('/review', {report_id:r.id, category:select.value}); await load(); message('处理分类已保存'); }));
        const ban = button('禁用此设备', () => { target = r.id; $('banError').textContent = ''; $('banForm').reset(); $('banDialog').showModal(); }, 'danger');
        ban.disabled = !r.device; if (!r.device) ban.title = '旧版未提供安装标识';
        actions.append(ban); card.append(actions); return card;
    }
    async function load() {
        if (loading) return; loading = true; $('refresh').disabled = true;
        const expected = view;
        try {
            const result = await api('/' + view + (view === 'reports' ? '?page=' + page : ''));
            if (view !== expected) return;
            $('items').replaceChildren(); $('pagination').hidden = view !== 'reports';
            $('viewTitle').textContent = {reports:'BUG 报告',bans:'有效禁用',audit:'操作记录'}[view];
            const rows = result[view]; $('count').textContent = view === 'reports' ? `${result.total} 条 · 保留 30 天` : view === 'bans' ? '最近 500 条有效禁用' : '最近 100 条 · 保留 90 天';
            if (!rows.length) $('items').append(node('p', '暂无记录', 'empty'));
            for (const r of rows) {
                if (view === 'reports') { $('items').append(reportCard(r)); continue; }
                const card = node('article');
                if (view === 'bans') { card.append(node('h3', '安装标识 ' + r.device), node('div', '禁用至 ' + date(r.until), 'meta'), node('p', r.reason)); card.append(button('解除禁用', async () => { if (!confirm('确认解除该设备的反馈限制？')) return; await api('/unban', {ban_id:r.id}); await load(); message('反馈限制已解除'); })); }
                else card.append(node('div', date(r.created) + ' · ' + ({ban:'禁用',unban:'解除禁用',review:'处理分类',password_change:'修改密码'}[r.action] || r.action), 'meta'), node('p', r.target), node('div', categories[r.detail] || r.detail, 'content'));
                $('items').append(card);
            }
            $('pageLabel').textContent = `第 ${page} / ${Math.max(1, Math.ceil((result.total || 0)/20))} 页`;
            $('previous').disabled = page <= 1; $('next').disabled = page * 20 >= (result.total || 0);
        } finally { loading = false; $('refresh').disabled = false; }
    }
    function refresh() { return load().catch(e => message(e.message, true)); }
    $('loginForm').addEventListener('submit', async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; try { const data = await api('/login', {password:$('password').value}); csrf = data.csrf_token; $('password').value = ''; authenticated(true); await load(); message('已安全登录'); } catch (error) { message(error.message,true); } finally { b.disabled = false; } });
    $('logout').addEventListener('click', async () => { try { await api('/logout', {}); csrf = ''; $('items').replaceChildren(); authenticated(false); message('已退出登录'); } catch (e) { message(e.message,true); } });
    for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', async () => { if (loading) return; view = b.dataset.view; for (const t of document.querySelectorAll('[data-view]')) t.setAttribute('aria-pressed', String(t === b)); await refresh(); });
    $('refresh').addEventListener('click', refresh);
    $('previous').addEventListener('click', () => { if (!loading && page > 1) { page--; refresh(); } });
    $('next').addEventListener('click', () => { if (!loading) { page++; refresh(); } });
    $('cancelBan').addEventListener('click', () => $('banDialog').close());
    $('changePassword').addEventListener('click', () => { $('passwordForm').reset(); $('passwordError').textContent = ''; $('passwordDialog').showModal(); });
    $('cancelPassword').addEventListener('click', () => $('passwordDialog').close());
    $('passwordForm').addEventListener('submit', async e => {
        e.preventDefault();
        if ($('newPassword').value !== $('confirmPassword').value) { $('passwordError').textContent = '两次输入的新密码不一致'; return; }
        const b = e.submitter; b.disabled = true;
        try {
            await api('/password', {current_password:$('currentPassword').value,new_password:$('newPassword').value});
            $('passwordForm').reset(); $('passwordDialog').close(); csrf = ''; $('items').replaceChildren(); authenticated(false);
            message('密码已修改，所有会话已退出，请用新密码重新登录');
        } catch (error) { $('passwordError').textContent = error.message; }
        finally { b.disabled = false; }
    });
    $('banForm').addEventListener('submit', async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; try { await api('/ban', {report_id:target, days:Number($('banDays').value), reason:$('banReason').value.trim()}); $('banDialog').close(); message('反馈限制已生效，到期自动恢复'); await load(); } catch (error) { $('banError').textContent = error.message; } finally { b.disabled = false; } });
    api('/session').then(async result => { csrf = result.csrf_token; authenticated(true); await load(); }).catch(e => { authenticated(false); if (!e.message.includes('会话已过期')) message(e.message,true); });
})();
