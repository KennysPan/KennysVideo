// Injected on every desktop page, including the player and About page.
(() => {
    if (window.kennysCloseReady) return;
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    if (!invoke) return;
    window.kennysCloseReady = true;
    let dialog;
    let pending = false;
    const style = document.createElement('style');
    style.textContent = `
      #windowCloseDialog { color:#e2e8f0; background:#111d2b; border:1px solid #284657; border-radius:16px; padding:28px; width:min(440px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; box-sizing:border-box; box-shadow:0 24px 80px #0009; }
      #windowCloseDialog::backdrop { background:#0009; }
      #windowCloseDialog h2 { font-size:22px; font-weight:700; margin:0 0 8px; color:#a5f3fc; }
      #windowCloseDialog p { font-size:14px; color:#a8bbc9; line-height:1.6; margin:0 0 18px; }
      #windowCloseDialog fieldset { border:0; padding:0; margin:0; }
      #windowCloseDialog .close-option { display:flex; gap:12px; align-items:center; min-height:56px; padding:8px 14px; margin:8px 0; border:1px solid #284657; border-radius:10px; cursor:pointer; }
      #windowCloseDialog .close-option:has(input:checked) { border-color:#22d3ee; background:#12313e; }
      #windowCloseDialog input { accent-color:#22d3ee; width:17px; height:17px; flex-shrink:0; }
      #windowCloseDialog .close-remember { display:flex; align-items:center; gap:10px; min-height:44px; margin-top:12px; font-size:14px; cursor:pointer; }
      #windowCloseDialog .close-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:20px; }
      #windowCloseDialog button { min-height:44px; min-width:88px; border-radius:8px; border:1px solid #355366; color:#e2e8f0; background:#1c2d3c; cursor:pointer; font-weight:600; }
      #windowCloseDialog .close-confirm { background:#0e7490; border-color:#0e7490; color:white; }
      #windowCloseDialog button:hover { filter:brightness(1.15); }
      #windowCloseDialog button:disabled { opacity:.5; cursor:wait; }
      #windowCloseDialog :focus-visible { outline:2px solid #67e8f9; outline-offset:3px; }
      #windowCloseDialog .close-error { margin:10px 0 0; color:#fca5a5; }
    `;
    document.head.append(style);

    function createDialog() {
        dialog = document.createElement('dialog');
        dialog.id = 'windowCloseDialog';
        dialog.setAttribute('aria-labelledby', 'windowCloseTitle');
        dialog.setAttribute('aria-describedby', 'windowCloseDescription');
        dialog.innerHTML = `<h2 id="windowCloseTitle">关闭 KennysVideo</h2>
          <p id="windowCloseDescription">点击关闭按钮时，你希望怎么做？</p>
          <fieldset aria-label="关闭方式">
            <label class="close-option"><input type="radio" name="windowCloseAction" value="minimize" checked><span>最小化到系统托盘</span></label>
            <label class="close-option"><input type="radio" name="windowCloseAction" value="exit"><span>退出程序</span></label>
          </fieldset>
          <label class="close-remember"><input type="checkbox" class="close-remember-input"><span>下次不再提示</span></label>
          <p style="margin:0;font-size:12px">之后可在“设置 → 关闭按钮行为”中修改。</p>
          <p class="close-error" role="status" hidden></p>
          <div class="close-actions"><button type="button" class="close-cancel">取消</button><button type="button" class="close-confirm">确定</button></div>`;
        document.body.append(dialog);
        dialog.querySelector('.close-cancel').onclick = () => { if (!pending) dialog.close(); };
        dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
        dialog.querySelector('.close-confirm').onclick = async () => {
            if (pending) return;
            pending = true;
            dialog.querySelectorAll('button').forEach(button => button.disabled = true);
            const preference = {
                action: dialog.querySelector('[name="windowCloseAction"]:checked').value,
                remember: dialog.querySelector('.close-remember-input').checked
            };
            try {
                await invoke('apply_close_action', { preference });
                dialog.close();
                syncSetting(preference);
            } catch {
                const error = dialog.querySelector('.close-error');
                error.textContent = '操作未完成，请重试；也可取消后继续使用。';
                error.hidden = false;
            } finally {
                pending = false;
                dialog.querySelectorAll('button').forEach(button => button.disabled = false);
            }
        };
    }

    let opening = false;
    window.addEventListener('kennys-close-requested', async () => {
        if (opening || dialog?.open) return;
        opening = true;
        try {
            if (!dialog) createDialog();
            // Every fresh confirmation starts with the safe tray action.
            dialog.querySelector('[type="radio"][value="minimize"]').checked = true;
            dialog.querySelector('.close-remember-input').checked = false;
            dialog.querySelector('.close-error').hidden = true;
            dialog.showModal();
            dialog.querySelector('.close-cancel').focus();
        } finally { opening = false; }
    });

    const setting = document.getElementById('windowCloseBehavior');
    function syncSetting(preference) {
        if (setting) setting.value = preference.remember ? preference.action : 'ask';
    }
    if (setting) {
        document.getElementById('windowCloseSettings').hidden = false;
        invoke('get_close_preference').then(syncSetting).catch(console.error);
        setting.addEventListener('change', async () => {
            setting.disabled = true;
            const status = document.getElementById('windowCloseStatus');
            try {
                await invoke('set_close_preference', { preference: {action: setting.value === 'exit' ? 'exit' : 'minimize', remember: setting.value !== 'ask'} });
                status.textContent = '已保存';
            } catch {
                status.textContent = '保存失败，请重试';
                await invoke('get_close_preference').then(syncSetting).catch(console.error);
            } finally { setting.disabled = false; }
        });
    }
})();
