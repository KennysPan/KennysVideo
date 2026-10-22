const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');
const requests = [];
let mode = 'normal';
const specialTitle = `测试剧 '第二季' <img src=x onerror=alert(1)>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (/^\/(a|b)\/api.php\/provide\/vod\//.test(url.pathname)) {
    requests.push({path:url.pathname,params:Object.fromEntries(url.searchParams)});
    const reply = () => {
      if (mode === 'http-error') {res.writeHead(503, {'Content-Type':'text/html'});return res.end('unavailable');}
      res.setHeader('Content-Type','application/json');
      const base = {code:'1', page:'1', pagecount:'2', limit:'2', total:'3'};
      if (url.searchParams.get('ac') === 'list') return res.end(JSON.stringify({...base,class:mode==='no-categories'?[]:[{type_id:'1',type_name:'电视剧'},{type_id:'2',type_name:'电影'},{type_id:'3',type_name:'伦理片'}],list:[]}));
      if (url.searchParams.has('ids')) return res.end(JSON.stringify({code:1,list:[{vod_name:specialTitle,vod_play_url:'第一集$https://media.example/video.m3u8'}]}));
      if (mode === 'invalid') return res.end(JSON.stringify({code:1,list:{wrong:true}}));
      if (mode === 'empty') return res.end(JSON.stringify({...base,pagecount:'0',total:0,list:[]}));
      const isB=url.pathname.startsWith('/b/');
      const name=isB?'来源 B 专属影片':specialTitle;
      let list=[{vod_id:'101',vod_name:name,type_name:'电视剧',vod_remarks:'更新至 12 集',vod_year:'2026'}, {vod_id:'102',vod_name:'另一部影片',type_name:'电影',vod_remarks:'正片'}];
      if (url.searchParams.get('pg')==='2') list=[{vod_id:'103',vod_name:'第二页影片',type_name:'电视剧'}];
      res.end(JSON.stringify({...base,list}));
    };
    if (url.searchParams.get('wd')==='slow') return setTimeout(reply,180);
    return reply();
  }
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  let body=fs.readFileSync(file);const ext=path.extname(file);
  if(ext==='.html')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[ext]||'application/octet-stream');res.end(body);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  await page.goto(origin);
  await page.evaluate(({origin})=>{
    localStorage.setItem('customAPIs',JSON.stringify([{name:'来源 A',url:origin+'/a'},{name:'来源 B',url:origin+'/b/api.php/provide/vod/?token=test-token&wd=old'}]));
    localStorage.setItem('selectedAPIs','["ruyi"]');localStorage.setItem('yellowFilterEnabled','true');
    window.__TAURI__={core:{invoke:async(command,{options})=>{
      if(command!=='make_http_request')throw Error('Unexpected command');
      const response=await fetch(options.url);return {status:response.status,body:await response.text(),headers:{'content-type':response.headers.get('content-type')}};
    }}};
  },{origin});
  for(const name of ['libs/tailwindcss.min.js','js/config.js','js/apiUtils.js','js/apiRequestCore.js','js/app_globals.js','js/ui.js','js/api_management.js','js/poster_images.js','js/source_catalog.js','js/details_modal.js','js/player_navigation.js']) await page.addScriptTag({path:path.join(root,name)});
  await page.evaluate(()=>{openSourceCatalog('custom_0');});
  await page.locator('#sourceCatalogGrid button').first().waitFor();
  assert.equal(await page.locator('#sourceCatalogGrid button').count(),2);
  assert.equal(await page.locator('#sourceCatalogGrid strong').first().textContent(),specialTitle);
  assert.equal(await page.locator('#sourceCatalogGrid img[onerror]').count(),0);
  assert.equal(await page.locator('#sourceCatalogCategory option').count(),3,'Adult category must stay filtered');
  assert.equal(await page.evaluate(()=>localStorage.getItem('selectedAPIs')),'["ruyi"]');
  await page.locator('#sourceCatalogNext').click();
  await page.getByRole('button',{name:'查看 第二页影片',exact:true}).waitFor();
  assert.equal(await page.locator('#sourceCatalogNext').isEnabled(),false);
  await page.locator('#sourceCatalogCategory').selectOption('1');
  await page.locator('#sourceCatalogGrid button').first().waitFor();
  assert(requests.some(r=>r.path.startsWith('/a/')&&r.params.t==='1'&&r.params.pg==='1'));
  await page.locator('#sourceCatalogKeyword').fill('slow');await page.locator('#sourceCatalogSearch button').click();
  await page.locator('#sourceCatalogSource').selectOption('custom_1');
  await page.getByRole('button',{name:'查看 来源 B 专属影片',exact:true}).waitFor();
  await page.waitForTimeout(230);
  assert.equal(await page.locator('#sourceCatalogGrid strong').first().textContent(),'来源 B 专属影片','Late source A response must not overwrite source B');
  assert(requests.some(r=>r.path==='/b/api.php/provide/vod/'&&r.params.token==='test-token'&&!r.params.wd));
  assert.equal(await page.locator('#sourceCatalogKeyword').inputValue(),'');
  await page.locator('#sourceCatalogKeyword').fill('测试 剧');await page.locator('#sourceCatalogSearch button').click();
  await page.getByRole('button',{name:'查看 来源 B 专属影片',exact:true}).waitFor();
  assert(requests.some(r=>r.path.startsWith('/b/')&&r.params.wd==='测试 剧'));
  console.log('PASS real HTTP catalog: source isolation, categories, paging, keyword encoding, full endpoint/query preservation, stale-response suppression, safe text');
  mode='http-error';await page.locator('#sourceCatalogSearch button').click();await page.locator('#sourceCatalogRetry').waitFor({state:'visible'});
  assert.equal(await page.locator('#sourceCatalogNext').isEnabled(),false);
  mode='invalid';await page.locator('#sourceCatalogRetry').click();await page.locator('#sourceCatalogRetry').waitFor({state:'visible'});
  mode='empty';await page.locator('#sourceCatalogRetry').click();await page.waitForFunction(()=>document.getElementById('sourceCatalogStatus').textContent.includes('暂无匹配'));
  assert.equal(await page.locator('#sourceCatalogGrid button').count(),0);
  mode='no-categories';await page.locator('#sourceCatalogSource').selectOption('custom_0');await page.locator('#sourceCatalogGrid button').first().waitFor();
  assert.equal(await page.locator('#sourceCatalogCategory').isEnabled(),false);
  mode='normal';await page.locator('#sourceCatalogSource').selectOption('custom_1');await page.locator('#sourceCatalogGrid button').first().waitFor();
  await page.screenshot({path:path.join(__dirname,'../dist-windows/KennysVideo-source-catalog.png')});
  await page.setViewportSize({width:480,height:760});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS HTTP errors, malformed list, retry recovery, empty catalog, optional categories, 480px layout');
  await page.getByRole('button',{name:'查看 来源 B 专属影片',exact:true}).click();
  await page.locator('#episodesGrid button').first().waitFor();
  assert(requests.some(r=>r.path==='/b/api.php/provide/vod/'&&r.params.ids==='101'&&r.params.token==='test-token'));
  await page.locator('#episodesGrid button').first().click();await page.waitForURL('**/player.html?**');
  const playback=new URL(page.url());assert.equal(playback.searchParams.get('source_code'),'custom_1');
  assert.equal(playback.searchParams.get('url'),'https://media.example/video.m3u8');
  console.log('PASS existing details → episode → player navigation with correct custom source and media URL');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
