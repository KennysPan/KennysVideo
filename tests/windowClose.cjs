const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const version = JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'))).version;
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1000,height:650}});
  await page.route('**/*', route => {
   const url = new URL(route.request().url());
   if (url.hostname !== 'close.test') return route.abort();
   const file = path.join(__dirname,'../public',url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
   if (!fs.existsSync(file)) return route.abort();
   let body = fs.readFileSync(file);
   if (path.extname(file)==='.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   return route.fulfill({contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream',body});
  });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('https://close.test/');
  await page.addScriptTag({path:path.join(__dirname,'../public/libs/tailwindcss.min.js')});
  await page.evaluate(() => {
   window.closeCalls=[]; window.preference={action:'minimize',remember:false};
   window.__TAURI_INTERNALS__={invoke:async (command,args)=>{
    closeCalls.push({command,args});
    if(command==='get_close_preference')return {...preference};
    if(window.failClose)throw Error('test persistence failure');
    if(command==='set_close_preference'||command==='apply_close_action') { preference=args.preference; return; }
    throw Error(command);
   }};
   document.querySelectorAll('.page-content').forEach(el=>el.classList.add('hidden'));
   document.querySelector('#page-settings').classList.remove('hidden');
  });
  const script=path.join(__dirname,'../public/js/window_close.js');
  await page.addScriptTag({path:script});
  // Repeated injection/navigation callbacks must not install duplicate handlers.
  await page.addScriptTag({path:script});
  const open=async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('kennys-close-requested')));await page.locator('#windowCloseDialog').waitFor({state:'visible'});};
  const actions=()=>page.evaluate(()=>closeCalls.filter(x=>x.command==='apply_close_action'));
  await open(); await open();
  assert.equal(await page.locator('#windowCloseDialog').count(),1);
  assert.equal(await page.locator('.close-cancel').evaluate(el=>el===document.activeElement),true);
  await page.locator('#windowCloseTitle').click({clickCount:3});
  await page.keyboard.press('Control+a');
  assert.equal(await page.evaluate(()=>window.getSelection().toString()),'', 'close dialog text must not be selectable');
  await page.locator('.close-remember-input').check();
  await page.locator('.close-cancel').click();
  assert.equal((await actions()).length,0,'cancel must neither perform nor save an action');
  await open();
  assert.equal(await page.locator('.close-remember-input').isChecked(),false);
  await page.keyboard.press('Escape');
  assert.equal((await actions()).length,0);
  await open();
  await page.locator('[value="exit"][type="radio"]').check();
  await page.locator('.close-remember-input').check();
  await page.locator('.close-confirm').click();
  await page.locator('#windowCloseDialog').waitFor({state:'hidden'});
  assert.deepEqual((await actions()).at(-1).args.preference,{action:'exit',remember:true});
  assert.equal(await page.locator('#windowCloseBehavior').inputValue(),'exit');
  await page.locator('#windowCloseBehavior').selectOption('ask');
  await page.waitForFunction(()=>preference.remember===false);
  await open();
  await page.locator('.close-confirm').click();
  await page.locator('#windowCloseDialog').waitFor({state:'hidden'});
  assert.deepEqual((await actions()).at(-1).args.preference,{action:'minimize',remember:false});
  await open();
  await page.locator('[value="exit"][type="radio"]').check();
  await page.locator('.close-confirm').click();
  await page.locator('#windowCloseDialog').waitFor({state:'hidden'});
  assert.deepEqual((await actions()).at(-1).args.preference,{action:'exit',remember:false});
  await open();
  assert.equal(await page.locator('[type="radio"][value="minimize"]').isChecked(),true,'every new confirmation must default to tray, even after an unremembered exit');
  await page.evaluate(()=>window.failClose=true);
  await page.locator('.close-confirm').click();
  await page.locator('.close-error').waitFor({state:'visible'});
  assert.equal(await page.locator('#windowCloseDialog').isVisible(),true);
  assert.equal(await page.locator('.close-cancel').isEnabled(),true);
  await page.evaluate(()=>window.failClose=false);
  await page.locator('.close-cancel').click();
  await open();
  assert.equal(await page.locator('[type="radio"][value="minimize"]').locator('..').innerText(),'最小化到系统托盘');
  await page.screenshot({path:path.join(__dirname,`../dist-windows/KennysVideo-${version}-close-dialog.png`)});
  await page.setViewportSize({width:420,height:440});
  assert.equal(await page.locator('#windowCloseDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.locator('.close-cancel').click();
  for(const width of [1000,1360,480]) {
   await page.setViewportSize({width,height:800});
   const cards=await page.locator('.settings-sections > div').evaluateAll(elements=>elements.map(el=>({left:el.getBoundingClientRect().left,width:el.getBoundingClientRect().width})));
   assert.equal(cards.length,6,'every section must remain inside the shared container');
   assert(cards.every(card=>Math.abs(card.left-cards[0].left)<1&&Math.abs(card.width-cards[0].width)<1));
   assert.equal(await page.locator('.settings-sections > div').filter({has:page.locator('#doubanApiModeToggle')}).count(),1);
   assert.equal(await page.locator('#windowCloseBehavior').evaluate(el=>el.getBoundingClientRect().height),44);
   assert.equal(await page.locator('#checkAppUpdateButton').evaluate(el=>getComputedStyle(el).fontSize),'14px');
   assert.equal(await page.locator('#windowCloseBehavior').evaluate(el=>getComputedStyle(el).fontSize),'14px');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'settings must not overflow the window');
   if(width===1000) {
    await page.locator('#windowCloseSettings').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,`../dist-windows/KennysVideo-${version}-settings.png`)});
   }
  }
  for (const name of ['player.html','about.html']) {
   await page.goto(`https://close.test/${name}`);
   await page.evaluate(()=>{window.__TAURI_INTERNALS__={invoke:async()=>({action:'minimize',remember:false})};});
   await page.addScriptTag({path:script});
   await open();
   await page.locator('.close-cancel').click();
   assert.equal(await page.locator('#windowCloseDialog').isVisible(),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS close dialog, tray wording, remembered actions; all six settings cards align with consistent controls at 480/1000/1360px');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
