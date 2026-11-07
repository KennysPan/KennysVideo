// Versioned authenticated container. The built-in key is intentionally extractable:
// this prevents casual plaintext viewing, not disclosure to someone with the app.
window.KennysConfig = (() => {
    const magic = 'KennysVideo-Config/1\n';
    const keyId = 'builtin-1';
    const limit = 10 * 1024 * 1024;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', {fatal:true});
    const keys = () => [...new Set([
        'selectedAPIs', 'customAPIs', 'yellowFilterEnabled',
        typeof PLAYER_CONFIG !== 'undefined' ? PLAYER_CONFIG.adFilteringStorage : 'adFilteringEnabled',
        'doubanEnabled', 'doubanApiMode', 'hasInitializedDefaults', 'viewingHistory',
        typeof SEARCH_HISTORY_KEY !== 'undefined' ? SEARCH_HISTORY_KEY : 'searchHistory', 'kennysTheme'
    ].filter(Boolean))];
    function subtle() {
        if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持安全加密，请更新系统 WebView 或浏览器');
        return crypto.subtle;
    }
    function base64(bytes) {
        let result = '';
        for (let i=0;i<bytes.length;i+=8192) result += String.fromCharCode(...bytes.subarray(i,i+8192));
        return btoa(result);
    }
    function unbase64(value, max) {
        if (typeof value !== 'string' || value.length > Math.ceil(max/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('配置文件编码无效');
        const bytes = Uint8Array.from(atob(value), c=>c.charCodeAt(0));
        if (bytes.length > max) throw new Error('配置文件过大');
        return bytes;
    }
    async function key() {
        // Keep this versioned material stable so previous exports remain importable.
        const material = await subtle().digest('SHA-256', encoder.encode('KennysVideo/admin-config/builtin-1/a7c18b9d205f64e6'));
        return subtle().importKey('raw', material, 'AES-GCM', false, ['encrypt','decrypt']);
    }
    async function hash(data) {
        return Array.from(new Uint8Array(await subtle().digest('SHA-256',encoder.encode(JSON.stringify(data))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    function validate(data) {
        if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('配置数据格式不正确');
        const result = Object.create(null);
        for (const [name,value] of Object.entries(data)) {
            if (!keys().includes(name)) continue; // Never restore arbitrary session/auth/internal keys.
            if (typeof value !== 'string') throw new Error('配置值格式不正确');
            if (name === 'kennysTheme' && !['blue','emerald','violet','rose'].includes(value)) throw new Error('主题配色无效');
            result[name] = value;
        }
        return result;
    }
    async function encode(data) {
        const config = {name:'KennysVideo-Settings',time:String(Date.now()),cfgVer:'1.0.0',data:validate(data)};
        config.hash = await hash(config.data);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await subtle().encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(magic+keyId),tagLength:128},await key(),encoder.encode(JSON.stringify(config)));
        const text = magic + JSON.stringify({keyId,algorithm:'AES-256-GCM',iv:base64(iv),ciphertext:base64(new Uint8Array(ciphertext))});
        if (encoder.encode(text).length > limit) throw new Error('加密配置超过 10MB，请精简历史记录后重试');
        return text;
    }
    async function decode(text) {
        if (typeof text !== 'string' || encoder.encode(text).length > limit) throw new Error('文件大小超过 10MB');
        let config;
        if (text.startsWith(magic)) {
            const envelope = JSON.parse(text.slice(magic.length));
            if (envelope.keyId !== keyId || envelope.algorithm !== 'AES-256-GCM') throw new Error('配置版本不受支持，请更新软件');
            const iv = unbase64(envelope.iv,12);
            if (iv.length !== 12) throw new Error('配置文件校验失败');
            try {
                const bytes = await subtle().decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(magic+keyId),tagLength:128},await key(),unbase64(envelope.ciphertext,limit));
                config = JSON.parse(decoder.decode(bytes));
            } catch (_) { throw new Error('配置文件损坏或无法解密，未修改现有配置'); }
        } else {
            // Legacy JSON is recognized by content, even if its extension was changed.
            config = JSON.parse(text.replace(/^\uFEFF/,''));
        }
        if (!['KennysVideo-Settings','LibreTV-Settings'].includes(config?.name) || !config.data || typeof config.hash !== 'string') throw new Error('不是有效的 KennysVideo 配置文件');
        if (!['1.0.0','2.0.0'].includes(config.cfgVer)) throw new Error('配置版本不受支持');
        if (await hash(config.data) !== config.hash) throw new Error('配置文件校验失败，未修改现有配置');
        return validate(config.data);
    }
    function apply(data, storage=localStorage) {
        const values = validate(data);
        const before = Object.entries(values).map(([name])=>[name,storage.getItem(name)]);
        try { for (const [name,value] of Object.entries(values)) storage.setItem(name,value); }
        catch (_) {
            // Free changed entries first so restoring larger original values has room.
            for (const [name] of before) { try { storage.removeItem(name); } catch (_) {} }
            for (const [name,value] of before) {
                try { value === null ? storage.removeItem(name) : storage.setItem(name,value); } catch (_) {}
            }
            throw new Error('配置保存失败，请检查存储空间后重试');
        }
        window.restoreKennysTheme?.();
    }
    return {encode,decode,apply,keys,limit};
})();

async function importConfig() {
    if (typeof showImportBox !== 'function') { window.showToast?.('导入功能不可用','error'); return; }
    let busy = false;
    showImportBox(async file => {
        if (!file || busy) return;
        busy = true;
        try {
            if (file.size > KennysConfig.limit) throw new Error('文件大小超过 10MB');
            const text = await file.text();
            const values = await KennysConfig.decode(text);
            KennysConfig.apply(values);
            document.getElementById('showImportBoxModal')?.remove();
            window.showToast?.('配置导入成功，3 秒后刷新页面','success');
            setTimeout(()=>window.location.reload(),3000);
        } catch (_) {
            window.showToast?.('配置导入失败：文件不受支持、已损坏或存储空间不足，现有配置未变更','error');
            busy = false;
        }
    });
    const input = document.getElementById('ChooseFile');
    // Android document providers may expose custom extensions as octet-stream.
    // Leave the picker unrestricted; authenticate and identify file contents instead.
    input?.removeAttribute('accept');
}

async function exportConfig() {
    try {
        const values = Object.create(null);
        for (const name of KennysConfig.keys()) {
            const value = localStorage.getItem(name);
            if (value !== null) values[name] = value;
        }
        const content = await KennysConfig.encode(values);
        await saveStringAsFile(content, `KennysVideo-Settings_${Date.now()}.KennysVideo`);
    } catch (_) { window.showToast?.('配置加密导出失败，请更新 WebView 并检查数据大小后重试','error'); }
}

async function saveStringAsFile(content, fileName) {
    const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
    if (window.KENNYS_PLATFORM === 'android' && invoke) {
        try {
            const saved = await invoke('export_config_file', {content,filename:fileName});
            if (saved) window.showToast?.('配置文件已保存','success');
        } catch (_) { window.showToast?.('配置文件保存失败，请重试','error'); }
        return;
    }
    const blob = new Blob([content], {type:'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=fileName; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
}
