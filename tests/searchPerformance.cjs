// Exercises the real search scheduler and DOM with local responses only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<input id="searchInput"><div id="resultsArea"><span id="searchResultsCount"></span><div id="results"></div></div>'}));
  await page.goto('https://search.test/');
  await page.evaluate(()=>{
   window.selectedAPIs=Array.from({length:20},(_,i)=>'s'+i);
   window.API_SITES=Object.fromEntries(selectedAPIs.map(s=>[s,{api:'https://source.test/'+s,name:s}]));
   window.API_CONFIG={search:{path:'/?wd=',pagePath:'/?wd={query}&pg={page}',headers:{},maxPages:3}};
   window.AGGREGATED_SEARCH_CONFIG={timeout:8000};
   window.createPosterImage=()=>'';window.showLoading=window.hideLoading=window.saveSearchHistory=()=>{};
   window.calls=[];window.active=0;window.peak=0;window.pendingOld=[];
   window.tauriConstants={invoke:async(_,args)=>{
    const u=new URL(args.options.url),term=u.searchParams.get('wd');calls.push({term,page:u.searchParams.get('pg')});active++;peak=Math.max(peak,active);
    try {
     if(term==='old')await new Promise(resolve=>pendingOld.push(resolve));
     return {status:200,body:JSON.stringify({list:term==='empty'?[]:Array.from({length:term==='many'?7:1},(_,i)=>({vod_id:i+1,vod_name:term})),pagecount:term==='old'?3:1})};
    } finally{active--}
   }};
  });
  await page.addScriptTag({path:path.join(__dirname,'../public/js/search_logic.js')});
  await page.evaluate(()=>{document.querySelector('input').value='old';window.oldSearch=search()});
  await page.waitForFunction(()=>pendingOld.length===6);
  await page.evaluate(()=>{document.querySelector('input').value='new';window.newSearch=search();pendingOld.splice(0).forEach(resolve=>resolve())});
  await page.evaluate(()=>Promise.all([oldSearch,newSearch]));
  assert.equal(await page.evaluate(()=>peak),6,'global native request concurrency must stay bounded');
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.term==='old').length),6,'old queued sources and pages must not run');
  assert.equal(await page.locator('#searchResultsCount').textContent(),'20');
  assert(!(await page.locator('#results').textContent()).includes('old'));
  await page.evaluate(async()=>{document.querySelector('input').value='many';await search()});
  assert.equal(await page.locator('#searchResultsCount').textContent(),'140');
  assert.equal(await page.locator('#results > div').count(),60);
  await page.getByRole('button',{name:/显示更多/}).click();
  assert.equal(await page.locator('#results > div').count(),120);
  await page.getByRole('button',{name:/显示更多/}).click();
  assert.equal(await page.locator('#results > div').count(),140);
  assert.equal(await page.getByRole('button',{name:/显示更多/}).count(),0);
  await page.evaluate(async()=>{document.querySelector('input').value='empty';await search()});
  assert.equal(await page.locator('#searchResultsCount').textContent(),'0');
  assert((await page.locator('#results').textContent()).includes('没有找到'));
  console.log('PASS bounded concurrency, stale sources/pages skipped, newest results retained, 60/120/140 pagination, empty count');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
