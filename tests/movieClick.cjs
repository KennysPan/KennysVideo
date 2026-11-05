const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   if(new URL(route.request().url()).hostname!=='click.test')return route.abort();
   const name=new URL(route.request().url()).pathname.slice(1)||'index.html';const file=path.join(__dirname,'../public',name);
   if(!fs.existsSync(file))return route.abort();let body=fs.readFileSync(file);
   if(name==='index.html')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   return route.fulfill({contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream',body});
  });
  await page.goto('https://click.test/');
  await page.addScriptTag({path:path.join(__dirname,'../public/libs/tailwindcss.min.js')});
  await page.evaluate(()=>{
   window.requests=[];
   window.__TAURI_INTERNALS__={invoke:async(command,{options})=>{
    if(command!=='make_http_request')throw Error(command);window.requests.push(options.url);
    return {status:200,body:JSON.stringify({code:1,pagecount:1,list:[{vod_id:'1',vod_name:new URL(options.url).searchParams.get('wd'),vod_pic:'',type_name:'电影',vod_remarks:'测试搜索结果'}]})};
   }};
  });
  for(const name of ['config','ui','apiUtils','app_globals','api_management','app_event_listeners','poster_images','carousel_controls','douban_ui','search_logic'])await page.addScriptTag({path:path.join(__dirname,`../public/js/${name}.js`)});
  await page.evaluate(()=>{selectedAPIs=['ruyi'];initAPICheckboxes();});
  for(const title of ['这个杀手不太冷',`O'Connor "测试" <特别篇>`]) {
   await page.evaluate(title=>{
    document.querySelectorAll('.page-content').forEach(el=>el.classList.add('hidden'));
    document.querySelector('#page-home').classList.remove('hidden');
    document.querySelectorAll('#bottomNav .nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page==='home'));
    document.querySelector('#douban-recommendations-container').innerHTML='<div class="carousel-container"><div id="click-track" class="carousel-track flex"></div></div>';
    renderDoubanCardsAsCarousel({subjects:[{title,rate:'9.4'}]},document.querySelector('#click-track'),'movie','动作');
    window.requests=[];
   },title);
   if(title==='这个杀手不太冷') await page.evaluate(()=>{
    // Reproduce a long home feed whose native poster data URIs exceed sessionStorage quota.
    const image=document.createElement('img');image.src='data:image/png;base64,'+'A'.repeat(6*1024*1024);
    document.querySelector('#douban-recommendations-container').append(image);
   });
   await page.locator('#click-track .relative').first().click();
   await page.waitForTimeout(200);
   assert.deepEqual(errors,[]);
   assert.equal(await page.locator('#page-search').isVisible(),true,'click must reveal the search page');
   assert.equal(await page.locator('#searchInput').inputValue(),title);
   assert.equal(await page.evaluate(title=>requests.some(url=>new URL(url).searchParams.get('wd')===title),title),true);
   const saved=await page.evaluate(()=>sessionStorage.getItem('homePageState'));
   assert(saved.length < 100000, 'home cache must not contain large poster data URIs');
   assert(!saved.includes('data:image/'));
   await page.evaluate(()=>{navigateToTab('home');window.requests=[];});
   await page.locator('#click-track [data-movie-title]').first().focus();
   await page.keyboard.press('Enter');
   await page.waitForTimeout(100);
   assert.equal(await page.locator('#page-search').isVisible(),true);
   assert.equal(await page.evaluate(title=>requests.some(url=>new URL(url).searchParams.get('wd')===title),title),true);
  }
  await page.evaluate(()=>{
   navigateToTab('home');
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='homePageState')throw new DOMException('Test quota','QuotaExceededError');return original.call(this,key,value);};
   window.requests=[];
  });
  await page.locator('#click-track .relative').first().click();
  assert.equal(await page.locator('#page-search').isVisible(),true,'failed optional cache must never block navigation');
  assert.deepEqual(errors,[]);
  await page.setContent('<h1 id="selection-title">KennysVideo 普通界面文字</h1><input id="editable" value="搜索影片"><textarea id="config-edit">配置内容</textarea>');
  await page.addStyleTag({path:path.join(__dirname,'../public/css/styles.css')});
  await page.locator('#selection-title').dblclick();
  await page.keyboard.press('Control+A');
  assert.equal(await page.evaluate(()=>window.getSelection().toString()),'');
  for(const selector of ['#editable','#config-edit']) {
   await page.locator(selector).focus();await page.keyboard.press('Control+A');
   assert.equal(await page.locator(selector).evaluate(el=>el.selectionEnd-el.selectionStart),4);
  }
  console.log('PASS app text cannot be selected; inputs and configuration remain editable');
  console.log('PASS real poster clicks navigate and start search, including quoted titles');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
