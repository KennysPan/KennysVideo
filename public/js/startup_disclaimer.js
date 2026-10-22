// Native process memory resets on a full exit, but survives player navigation.
document.addEventListener('DOMContentLoaded', async () => {
    let shouldShow;
    try {
        const invoke = typeof tauriConstants !== 'undefined' && tauriConstants.invoke;
        if (invoke) shouldShow = await invoke('claim_startup_disclaimer');
    } catch (error) {
        console.warn('Startup notice state unavailable.', error);
    }
    if (typeof shouldShow !== 'boolean') {
        // Browser preview: once per tab session, including refresh/navigation.
        try {
            shouldShow = sessionStorage.getItem('startupDisclaimerShown') !== 'true';
            sessionStorage.setItem('startupDisclaimerShown', 'true');
        } catch { shouldShow = true; }
    }
    if (!shouldShow) return;
    const modal = document.getElementById('disclaimerModal');
    modal.style.display = 'flex';
    const accept = document.getElementById('acceptDisclaimerBtn');
    accept.addEventListener('click', () => { modal.style.display = 'none'; }, { once: true });
    accept.focus();
});
