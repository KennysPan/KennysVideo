const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'../public');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [390,1000]){
   const page=await browser.newPage({viewport:{width,height:760}});
   await page.route('https://config.test/**',route=>{
    const file=path.join(root,new URL(route.request().url()).pathname.slice(1)||'index.html');
    if(!fs.existsSync(file))return route.abort();
    let body=fs.readFileSync(file);
    if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    return route.fulfill({body,contentType:{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'image/png'});
   });
   await page.goto('https://config.test/');
   await page.addScriptTag({path:path.join(root,'libs/tailwindcss.min.js')});
   await page.addStyleTag({content:'.hidden {display:none !important}'});
   await page.addScriptTag({path:path.join(root,'js/theme.js')});
   await page.addScriptTag({path:path.join(root,'js/config_io.js')});
   await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
   await page.evaluate(()=>document.querySelector('#page-settings').classList.remove('hidden'));
   await page.getByRole('button',{name:'紫罗兰',exact:true}).click();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'violet');
   assert.equal(await page.getByRole('button',{name:'紫罗兰',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim()),'#a78bfa');
   const checks=await page.evaluate(async()=>{
    const data={customAPIs:JSON.stringify([{name:'中文资源',url:'https://example.test/private-api'}]),viewingHistory:'[{"title":"影片"}]',kennysTheme:'rose'};
    const a=await KennysConfig.encode(data), b=await KennysConfig.encode(data);
    const decoded=await KennysConfig.decode(a);
    const e=JSON.parse(a.slice(a.indexOf('\n')+1));
    const material=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('KennysVideo/admin-config/builtin-1/a7c18b9d205f64e6'));
    const k=await crypto.subtle.importKey('raw',material,'AES-GCM',false,['decrypt']);
    const unpack=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(e.iv),c=>c.charCodeAt(0)),additionalData:new TextEncoder().encode('KennysVideo-Config/1\nbuiltin-1'),tagLength:128},k,Uint8Array.from(atob(e.ciphertext),c=>c.charCodeAt(0)));
    const internal=JSON.parse(new TextDecoder().decode(unpack));
    const shape=Object.keys(internal).join(',')==='name,time,cfgVer,data,hash'&&internal.name==='KennysVideo-Settings'&&internal.cfgVer==='1.0.0';
    const sample={name:'KennysVideo-Settings',time:'1794010863193',cfgVer:'1.0.0',data:{selectedAPIs:'["tyyszy","xiaomaomi","bfzy","dyttzy","ruyi"]',yellowFilterEnabled:'true',adFilteringEnabled:'true',doubanEnabled:'true',doubanApiMode:'true',hasInitializedDefaults:'true'},hash:'872029a044a12ec78ef97c7e4955ac3ae5b627bea752acb29c6425f3a3854349'};
    const sampleOk=(await KennysConfig.decode(JSON.stringify(sample))).doubanEnabled==='true';
    e.ciphertext=(e.ciphertext[0]==='A'?'B':'A')+e.ciphertext.slice(1);
    let tamper=false;try{await KennysConfig.decode('KennysVideo-Config/1\n'+JSON.stringify(e))}catch(_){tamper=true}
    let unknown=false;try{await KennysConfig.decode(a.replace('builtin-1','builtin-9'))}catch(_){unknown=true}
    const legacy={name:'LibreTV-Settings',cfgVer:'1.0.0',data};
    legacy.hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const old=await KennysConfig.decode(JSON.stringify(legacy));
    legacy.name='KennysVideo-Settings';
    const branded=await KennysConfig.decode(JSON.stringify(legacy));
    localStorage.setItem('customAPIs','original');localStorage.setItem('kennysTheme','violet');
    const backing=new Map([['customAPIs','original'],['kennysTheme','violet']]);let failOnce=true;
    const simulated={getItem:k=>backing.get(k)??null,removeItem:k=>backing.delete(k),setItem(k,v){if(k==='kennysTheme'&&v==='rose'&&failOnce){failOnce=false;throw Error('quota')}backing.set(k,v)}};
    let rollback=false;try{KennysConfig.apply(data,simulated)}catch(_){rollback=backing.get('customAPIs')==='original'&&backing.get('kennysTheme')==='violet'}
    KennysConfig.apply({...data,untrustedToken:'do-not-import'});
    return {shape,sampleOk,same:JSON.stringify(decoded)===JSON.stringify(data),random:a!==b,hidden:!a.includes('private-api')&&!a.includes('影片'),tamper,unknown,legacy:old.kennysTheme==='rose',branded:branded.kennysTheme==='rose',rollback,allowlist:localStorage.getItem('untrustedToken')===null};
   });
   assert(Object.values(checks).every(Boolean),JSON.stringify(checks));
   await page.evaluate(()=>{window.saved=[];window.KENNYS_PLATFORM='android';window.__TAURI_INTERNALS__={invoke:async(command,args)=>{saved.push({command,args});return true}}});
   await page.evaluate(()=>exportConfig());
   assert(await page.evaluate(()=>saved[0].args.filename.endsWith('.KennysVideo')&&saved[0].args.content.startsWith('KennysVideo-Config/1\n')));
   await page.reload();
   await page.addScriptTag({path:path.join(root,'libs/tailwindcss.min.js')});
   await page.addStyleTag({content:'.hidden {display:none !important}'});
   await page.addScriptTag({path:path.join(root,'js/theme.js')});
   await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
   assert.equal(await page.locator('html').getAttribute('data-theme'),'rose');
   await page.evaluate(()=>document.querySelector('#page-settings').classList.remove('hidden'));
   await page.locator('#themeSettings').scrollIntoViewIfNeeded();
   await page.locator('#page-settings').evaluate(async element=>{await Promise.all(element.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))});
   await page.screenshot({path:path.join(__dirname,`../dist-windows/config-theme31-${width}.png`)});
   await page.goto('https://config.test/player.html');
   await page.addScriptTag({path:path.join(root,'js/theme.js')});
   assert.equal(await page.locator('html').getAttribute('data-theme'),'rose');
   await page.close();
  }
  console.log('PASS: encrypted randomized roundtrip, tamper/version rejection, legacy JSON, rollback, import allowlist, Android custom extension and persistent phone/desktop/player themes');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
