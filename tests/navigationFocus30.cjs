const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [390,1000]){
   const page=await browser.newPage({viewport:{width,height:680}});
   const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link[^>]*>/gi,'');
   await page.setContent(html);
   await page.addStyleTag({path:path.join(__dirname,'../public/css/styles.css')});
   const nav=page.locator('#bottomNav [data-page="search"]');
   await nav.click();
   assert.equal(await nav.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await page.keyboard.press('Tab');
   const focused=page.locator('#bottomNav [data-page="filter"]');
   assert(await focused.evaluate(e=>e===document.activeElement));
   assert.equal(await focused.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   assert.equal(await focused.locator('span').evaluate(e=>getComputedStyle(e).textDecorationLine),'underline');
   await page.close();
  }
  console.log('PASS: phone/desktop navigation has no rectangular pointer or keyboard focus frame; keyboard label cue remains');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
