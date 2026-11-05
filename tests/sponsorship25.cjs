const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'../public');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [320,390,1000]){
   const page=await browser.newPage({viewport:{width,height:760}});
   await page.route('http://sponsor.test/**',route=>{
    const file=path.join(root,new URL(route.request().url()).pathname.slice(1)||'index.html');
    if(!fs.existsSync(file))return route.abort();
    let body=fs.readFileSync(file); if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    return route.fulfill({body,contentType:{'.html':'text/html','.css':'text/css','.jpg':'image/jpeg','.js':'text/javascript'}[path.extname(file)]||'image/png'});
   });
   await page.goto('http://sponsor.test/');
   await page.addScriptTag({path:path.join(root,'js/app_updates.js')});
   await page.addScriptTag({path:path.join(root,'js/sponsorship.js')});
   await page.addScriptTag({path:path.join(root,'js/startup_disclaimer.js')});
   await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
   await page.locator('.startup-sponsor-link').click();
   await page.locator('#sponsorshipDialog').waitFor({state:'visible'});
   assert.equal(await page.locator('#sponsorshipDialog img').count(),2);
   await page.waitForFunction(()=>[...document.querySelectorAll('#sponsorshipDialog img')].every(i=>i.complete&&i.naturalWidth>0));
   const box=await page.locator('#sponsorshipDialog').boundingBox();
   assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=760);
   for(const img of await page.locator('#sponsorshipDialog img').all()){
    assert(await img.evaluate(e=>Math.abs(e.width/e.height-e.naturalWidth/e.naturalHeight)<.01));
   }
   await page.screenshot({path:path.join(__dirname,`../dist-windows/sponsorship-${width}.png`)});
   await page.getByRole('button',{name:'关闭赞助窗口'}).click();
   assert.equal(await page.evaluate(()=>document.body.style.position),'fixed','startup lock retained');
   await page.locator('#acceptDisclaimerBtn').click();
   assert.equal(await page.evaluate(()=>document.body.style.position),'');
   await page.evaluate(()=>document.querySelector('#page-settings').classList.remove('hidden'));
   await page.locator('#settingsSponsorshipButton').click();
   assert(await page.locator('#sponsorshipDialog').isVisible());
   await page.keyboard.press('Escape');
   assert(await page.locator('#sponsorshipDialog').isHidden());
   await page.goto('http://sponsor.test/player.html');
   await page.addScriptTag({path:path.join(root,'js/sponsorship.js')});
   await page.getByRole('button',{name:'赞助',exact:true}).click();
   assert(await page.locator('#sponsorshipDialog').isVisible());
   assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
   await page.getByRole('button',{name:'关闭赞助窗口'}).click();
   await page.waitForFunction(()=>document.documentElement.style.overflow==='');
   assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
   await page.close();
  }
  console.log('PASS: startup top entry, settings and player sponsorship, both original images, responsive layout, close/Escape and stacked scroll locks');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
