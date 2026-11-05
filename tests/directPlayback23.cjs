const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, 'public/js', file), 'utf8');
(async () => {
  const ctx = vm.createContext({});
  vm.runInContext(source('search_logic.js'), ctx);
  assert(vm.runInContext("similarSearchTerms('后悔友期').includes('后会友期')", ctx));
  assert(vm.runInContext("searchTitleScore('后会友期 沉浸版','后悔友期') > 0", ctx));
  assert(vm.runInContext("searchTitleScore('后会友期','后会友期') > searchTitleScore('后悔友期','后会友期')", ctx));
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage();
    await page.route('http://playback.test/**', r => r.fulfill({body:'<div id="modal" class="hidden"><div id="modalTitle"></div><div id="modalContent"></div></div><div id="player" style="position:relative;width:100%;height:300px"></div>'}));
    await page.goto('http://playback.test/');
    await page.evaluate(() => {
      window.currentEpisodes=[]; window.currentEpisodeNames=[]; window.currentVideoTitle=''; window.episodesReversed=false;
      window.API_SITES={test:{api:'https://provider.test',name:'测试源'}};
      window.API_CONFIG={detail:{headers:{}}};
      window.tauriConstants={invoke:async()=>({status:200,body:JSON.stringify({list:[{vod_play_url:'20261022第一期完整版$https://video.test/1.m3u8#第二期$https://video.test/2.m3u8'}]})})};
      window.playVideo=(...args)=>window.playArgs=args;
      window.showLoading=()=>{}; window.hideLoading=()=>{};
    });
    await page.addScriptTag({content:source('details_modal.js')});
    for (const [history, index, position] of [
      [[],0,0],
      [[{title:'后会友期',sourceName:'测试源',episodeIndex:1,playbackPosition:124}],1,124],
      [[{title:'后会友期',sourceName:'测试源',episodeIndex:0,url:'player.html?url=https%3A%2F%2Fvideo.test%2F2.m3u8',playbackPosition:5}],1,5],
      [[{title:'后会友期',sourceName:'其他源',episodeIndex:1,playbackPosition:124}],0,0],
      [{bad:true},0,0]
    ]) {
      await page.evaluate(history => localStorage.setItem('viewingHistory',JSON.stringify(history)), history);
      await page.evaluate(() => showDetails('1','后会友期','test'));
      const args = await page.evaluate(() => window.playArgs);
      assert.equal(args[3],index); assert.equal(args[4],position);
      assert.equal(args[0],`https://video.test/${index+1}.m3u8`);
      assert.equal(await page.locator('#modal').getAttribute('class'),'hidden');
    }
    await page.addScriptTag({content:source('player_dplayer_handler.js')});
    await page.addStyleTag({path:path.join(root,'public/css/player.css')});
    for (const width of [320,390,900]) {
      await page.setViewportSize({width,height:500});
      await page.evaluate(() => {
        document.body.style.margin='0';
        document.querySelector('#player').replaceChildren();
        window.playerEvents={};
        setupPlayerBrandPlaceholder({container:document.querySelector('#player'),video:{readyState:0},on:(name,cb)=>window.playerEvents[name]=cb});
      });
      const image=await page.locator('.player-brand-placeholder img').boundingBox();
      const text=await page.locator('.player-brand-placeholder strong').boundingBox();
      assert(Math.abs((image.x+text.x+text.width)/2-width/2)<2,JSON.stringify({width,image,text}));
      assert(image.x>=0 && text.x+text.width<=width);
      await page.evaluate(()=>window.playerEvents.loadeddata());
      assert(await page.locator('.player-brand-placeholder').isHidden());
    }
    console.log('PASS: first episode, same-source resume including old records, malformed history, fuzzy titles and centered mobile branding');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
