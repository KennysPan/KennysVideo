const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:760}});
  await page.route('http://return.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="UTF-8"><div id="page-search"><input id="searchInput" value="后会友期"><div id="resultsArea"><span id="searchResultsCount">2</span><div id="results"><button id="result1">后会友期</button><div style="height:2000px"></div></div></div></div>'}));
  await page.goto('http://return.test/index.html');
  const script=fs.readFileSync(path.join(__dirname,'../public/js/player_return.js'),'utf8');
  await page.addScriptTag({content:script});
  await page.evaluate(()=>{window.scrollTo(0,400);capturePlayerReturn()});
  const y=await page.evaluate(()=>scrollY);assert(y>0);
  await page.goto('http://return.test/player.html');await page.addScriptTag({content:script});
  await page.evaluate(()=>{window.scrollTo(0,450);window.dispatchEvent(new PageTransitionEvent('pageshow'))});
  await page.waitForFunction(()=>scrollY===0);
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'manual');
  await page.evaluate(()=>returnToPlayerSearch());await page.waitForURL('http://return.test/index.html');
  await page.addScriptTag({content:script});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('activeTab')),'search');
  await page.evaluate(()=>{document.querySelector('#searchInput').value='';document.querySelector('#results').innerHTML='';window.restored=restorePlayerSearchReturn()});
  assert.equal(await page.evaluate(()=>window.restored),true);
  await page.waitForFunction(y=>Math.abs(scrollY-y)<2,y);
  assert.equal(await page.locator('#searchInput').inputValue(),'后会友期');assert.equal(await page.locator('#result1').textContent(),'后会友期');
  await page.evaluate(()=>{document.querySelector('#page-search').classList.add('hidden');capturePlayerReturn()});
  assert.equal(await page.evaluate(()=>returnToPlayerSearch()),false,'home/history must not return to stale search');
  console.log('PASS: enter player at top, return to search with keyword/results/scroll preserved, no stale search return from other tabs');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
