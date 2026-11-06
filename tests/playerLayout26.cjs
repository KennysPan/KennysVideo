const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390,640,1000,1366]){
   const page=await browser.newPage({viewport:{width,height:720}});
   await page.route('http://layout.test/**',r=>{
    const file=path.join(__dirname,'../public',new URL(r.request().url()).pathname.slice(1));
    if(!fs.existsSync(file))return r.abort();
    let body=fs.readFileSync(file);if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    return r.fulfill({body,contentType:{'.html':'text/html','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'}[path.extname(file)]||'text/javascript'});
   });
   await page.goto('http://layout.test/player.html');
   await page.addScriptTag({path:path.join(__dirname,'../public/libs/tailwindcss.min.js')});
   await page.evaluate(()=>{document.body.classList.add('test-ready');document.querySelector('#videoTitle').textContent='星际穿越：很长的视频标题测试';});
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.player-header-brand')).display==='flex');
   const back=await page.locator('#goBack').boundingBox();const brand=await page.locator('.player-header-brand').boundingBox();const title=await page.locator('#videoTitle').boundingBox();
   assert(back.x<title.x&&title.x+title.width<=brand.x+1);
   assert(brand.x+brand.width<=width&&back.x>=0);
   assert(await page.locator('#bottomNav').isHidden());assert(await page.locator('#mobileBottomNav').isHidden());
   if(width===1000||width===390)await page.screenshot({path:path.join(__dirname,`../dist-windows/player-layout-${width}.png`)});
   await page.close();
  }
  console.log('PASS: player back left, branding right, long title fits, both bottom bars hidden at all phone/desktop widths');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
