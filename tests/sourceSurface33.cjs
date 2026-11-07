const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [390,1000]){
   const page=await browser.newPage({viewport:{width,height:760}});
   const root=path.join(__dirname,'../public');
   await page.route('https://surface.test/**',route=>{
    const file=path.join(root,new URL(route.request().url()).pathname.slice(1)||'index.html');
    if(!fs.existsSync(file))return route.abort();
    let body=fs.readFileSync(file);
    if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    return route.fulfill({body,contentType:{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'image/png'});
   });
   await page.goto('https://surface.test/');
   await page.addScriptTag({path:path.join(root,'libs/tailwindcss.min.js')});
   await page.addStyleTag({content:'.hidden{display:none!important}'});
   await page.addScriptTag({path:path.join(root,'js/theme.js')});
   await page.evaluate(()=>{
    document.getElementById('page-settings').classList.remove('hidden');
    document.getElementById('apiCheckboxes').innerHTML='<div class="grid grid-cols-2 gap-2"><div class="api-group-title">普通资源</div>'+Array.from({length:20},(_,i)=>'<label><input type="checkbox" '+(i<5?'checked':'')+'> 测试资源 '+(i+1)+'</label>').join('')+'</div>';
   });
   for(const theme of ['blue','emerald','violet','rose']){
    await page.evaluate(t=>setKennysTheme(t),theme);
    const colors=await page.locator('.api-source-list').evaluate(e=>({list:getComputedStyle(e).backgroundColor,card:getComputedStyle(e.parentElement).backgroundColor,surface:getComputedStyle(document.documentElement).getPropertyValue('--theme-surface').trim(),scroll:e.scrollHeight>e.clientHeight}));
    assert.equal(colors.list,'rgba(0, 0, 0, 0)');
    assert(colors.card!=='rgba(0, 0, 0, 0)');
    assert(colors.scroll);
    const checkbox=page.locator('#apiCheckboxes input').first();
    await checkbox.uncheck(); assert.equal(await checkbox.isChecked(),false); await checkbox.check();
   }
   await page.evaluate(()=>setKennysTheme('blue'));
   await page.locator('.api-source-list').scrollIntoViewIfNeeded();
   await page.locator('#page-settings').evaluate(async e=>{await Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))});
   await page.screenshot({path:path.join(__dirname,`../dist-windows/source-surface33-${width}.png`)});
   await page.close();
  }
  console.log('PASS: transparent source-list surface, four palettes, mobile/desktop, scrolling and checkboxes');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
