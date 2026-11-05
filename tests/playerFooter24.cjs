const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const viewport of [{width:800,height:600},{width:1000,height:680},{width:640,height:400},{width:390,height:760}]){
   const page=await browser.newPage({viewport});
   await page.route('http://footer.test/**',r=>{
    const file=path.join(__dirname,'../public',new URL(r.request().url()).pathname.slice(1)||'player.html');
    if(!fs.existsSync(file))return r.abort();
    let body=fs.readFileSync(file);
    if(file.endsWith('.html'))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    return r.fulfill({body,contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'});
   });
   await page.goto('http://footer.test/player.html');
   await page.addScriptTag({path:path.join(__dirname,'../public/libs/tailwindcss.min.js')});
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   const rects=await page.evaluate(()=>({footer:document.querySelector('footer').getBoundingClientRect().bottom,nav:document.querySelector('#bottomNav').getBoundingClientRect().top}));
   assert(rects.footer<=rects.nav,JSON.stringify({viewport,...rects}));
   await page.screenshot({path:path.join(__dirname,`../dist-windows/footer-fixed-${viewport.width}.png`)});
   await page.close();
  }
  console.log('PASS: complete player footer remains above bottom navigation at desktop, short-window and mobile sizes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
