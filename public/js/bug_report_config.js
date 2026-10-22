// Public server endpoint only. SMTP credentials must stay on the Linux server.
// Enable only after HTTPS and real delivery have been verified.
const BUG_REPORT_CONFIG = Object.freeze({
    endpoint: 'https://www.kennyspan.xyz/api/kennysvideo/feedback',
    enabled: true
});
