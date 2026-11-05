// Local, user-provided sponsorship images; no payment SDK or automatic transfer.
window.openSponsorship = function () {
    let dialog = document.getElementById('sponsorshipDialog');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'sponsorshipDialog';
        dialog.className = 'sponsorship-dialog';
        dialog.setAttribute('aria-labelledby', 'sponsorshipTitle');
        dialog.innerHTML = `
            <header class="sponsorship-header"><div><h2 id="sponsorshipTitle">赞助列表</h2><p>感谢你支持 KennysVideo</p></div><button type="button" class="sponsorship-close" aria-label="关闭赞助窗口" autofocus>×</button></header>
            <div class="sponsorship-body">
                <p class="sponsorship-note">自愿赞助，量力而行。不赞助也可正常使用全部现有功能。</p>
                <div class="sponsorship-methods">
                    <section><h3>微信赞助</h3><img src="image/sponsor-wechat.jpg" alt="Kennys 的微信赞赏码" width="1171" height="1171"></section>
                    <section><h3>支付宝赞助</h3><img src="image/sponsor-alipay.jpg" alt="Kennys 的支付宝赞助码" width="1170" height="1755"></section>
                </div>
                <p class="sponsorship-note">可使用另一台设备扫码；付款前请在支付软件中核对收款信息。</p>
            </div>`;
        document.body.append(dialog);
        dialog.querySelector('.sponsorship-close').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => {
            if (window.setModalScrollLock) window.setModalScrollLock(dialog, false);
            else document.documentElement.style.overflow = dialog.savedOverflow || '';
        });
    }
    if (dialog.open) return;
    if (window.setModalScrollLock) window.setModalScrollLock(dialog, true);
    else { dialog.savedOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
    dialog.showModal();
};
