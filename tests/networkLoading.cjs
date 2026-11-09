const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../public/js', name), 'utf8');
(async () => {
    const source = {URL, location:{href:'https://app.test/player.html'}, window:{}, AbortController, setTimeout, clearTimeout};
    vm.createContext(source); vm.runInContext(read('playback_source.js'), source);
    assert.equal(source.extractPlaybackUrl('url: "https:\\/\\/cdn.test/a.m3u8?x=1&amp;y=2"', 'https://provider.test/share/a'), 'https://cdn.test/a.m3u8?x=1&y=2');
    assert.equal(source.extractPlaybackUrl('<video src="/a.mp4"></video>', 'https://provider.test/share/a'), 'https://provider.test/a.mp4');
    assert.equal(source.extractPlaybackUrl('<script>alert(1)</script>', 'https://provider.test'), null);
    assert.equal(await source.resolvePlaybackSource('https://cdn.test/a.m3u8'), 'https://cdn.test/a.m3u8');
    source.window.__TAURI_INTERNALS__ = {invoke:async()=>({status:200,body:'var url="https://cdn.test/a.m3u8";'})};
    assert.equal(await source.resolvePlaybackSource('https://provider.test/share/a'), 'https://cdn.test/a.m3u8');
    source.window.__TAURI_INTERNALS__.invoke = async()=>({status:403,body:'denied'});
    await assert.rejects(source.resolvePlaybackSource('https://provider.test/share/a'), /403/);
    const elements = Object.fromEntries(['searchInput','resultsArea','results','searchResultsCount'].map(id=>[id,{value:'test',innerHTML:'',classList:{remove(){}}}]));
    let finishSlow;
    const slow = new Promise(resolve=>{finishSlow=resolve;});
    const response = name=>({status:200,body:JSON.stringify({list:[{vod_id:name,vod_name:'test',source_code:name}],pagecount:1})});
    const ctx = {console, URL, window:{}, document:{getElementById:id=>elements[id]},
        localStorage:{getItem:()=>null}, sessionStorage:{setItem(){}}, selectedAPIs:['fast','slow'],
        API_SITES:{fast:{api:'https://fast.test',name:'fast'},slow:{api:'https://slow.test',name:'slow'}},
        API_CONFIG:{search:{path:'/?wd=',headers:{},maxPages:1}},AGGREGATED_SEARCH_CONFIG:{timeout:8000},
        tauriConstants:{invoke:async(_,args)=>args.options.url.includes('fast.test')?response('fast'):slow},
        showLoading(){},hideLoading(){},createPosterImage:()=>''};
    vm.createContext(ctx); vm.runInContext(read('search_logic.js'),ctx);
    const pending=ctx.search();
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(elements.results.innerHTML,/fast/,'fast result shown while slow source still pending');
    finishSlow(response('slow')); await pending;
    assert.equal(elements.searchResultsCount.textContent,2,'merged results deduplicated');
    let finishOld;
    const oldResponse = new Promise(resolve=>{finishOld=resolve;});
    ctx.selectedAPIs=['fast'];
    ctx.tauriConstants.invoke=async(_,args)=>args.options.url.includes('old')?oldResponse:response('new');
    elements.searchInput.value='old'; const oldSearch=ctx.search();
    elements.searchInput.value='new'; await ctx.search();
    const latestHTML=elements.results.innerHTML;
    finishOld(response('old')); await oldSearch;
    assert.equal(elements.results.innerHTML,latestHTML,'late previous search cannot overwrite new results');
    console.log('PASS: static share resolution, direct links, HTTP errors, progressive search and deduplication');
})().catch(error=>{console.error(error);process.exitCode=1;});
