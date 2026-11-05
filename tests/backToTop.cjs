const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'});
  await page.setContent('<body style="background:#101925;color:white"><h1>KennysVideo</h1><main style="height:2400px"></main><nav id="bottomNav" style="position:fixed;height:64px;bottom:0;left:0;right:0">首页　搜索　设置</nav></body>');
  await page.addStyleTag({path:path.join(__dirname,'../public/css/styles.css')});
  await page.addScriptTag({path:path.join(__dirname,'../public/js/back_to_top.js')});
  const button=page.getByRole('button',{name:'返回顶部'});
  assert.equal(await button.isVisible(),false);
  await page.evaluate(()=>scrollTo(0,900));
  await button.waitFor({state:'visible'});
  const box=await button.boundingBox();assert(box.y+box.height<700-64,'button must sit above bottom navigation');
  await button.click();await page.waitForFunction(()=>scrollY===0);
  assert.equal(await button.isVisible(),false);
  await page.addScriptTag({path:path.join(__dirname,'../public/js/back_to_top.js')});
  assert.equal(await page.locator('#backToTop').count(),1);
  const svg=fs.readFileSync(path.join(__dirname,'../public/image/nomedia.svg'),'utf8');
  await page.setContent('<body style="margin:0">'+svg+'</body>');
  await page.locator('svg').screenshot({path:path.join(__dirname,'../dist-windows/KennysVideo-player-background.png')});
  console.log('PASS scroll threshold, click returns to top, bottom navigation clearance, no duplicate button; horizontal player background preview saved');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
