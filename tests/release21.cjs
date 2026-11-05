const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:900,height:400}});
  await page.setContent('<html class="android-app"><body class="dplayer-custom-fullscreen-mode"><div id="player"><div class="dplayer-controller">timeline</div><div class="dplayer-controller-mask"></div></div></body></html>');
  await page.addStyleTag({path:path.join(__dirname,'../public/css/player.css')});
  const opacity=()=>page.locator('.dplayer-controller').evaluate(e=>getComputedStyle(e).opacity);
  assert.equal(await opacity(),'1');
  await page.locator('#player').evaluate(e=>e.classList.add('dplayer-hide-controller'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.dplayer-controller')).opacity==='0');
  await page.locator('#player').evaluate(e=>e.classList.remove('dplayer-hide-controller'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.dplayer-controller')).opacity==='1');
  await page.addScriptTag({content:'let currentEpisodes = []; let episodesReversed = false;'});
  await page.addScriptTag({path:path.join(__dirname,'../public/js/details_modal.js')});
  const labels=await page.evaluate(()=>{
   currentEpisodes=['https://example.test/1','https://example.test/2'];
   const episodes=currentEpisodes.map((url,i)=>({url,name:['先导片','20261105 加更篇'][i]}));
   const forward=renderEpisodes('测试','test',episodes);
   episodesReversed=true;
   return [forward,renderEpisodes('测试','test',episodes)];
  });
  assert(labels.every(s=>s.includes('先导片')&&s.includes('20261105 加更篇')));
  console.log('PASS provider labels in both orders; landscape mobile controls hide and restore');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
