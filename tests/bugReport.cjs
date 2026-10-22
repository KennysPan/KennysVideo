const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');
let mode = 'success';
const submissions = [];
const server = http.createServer((req,res)=>{
 if(req.url==='/submit'&&req.method==='POST'){
  let body='';req.on('data',part=>body+=part);req.on('end',()=>{
   submissions.push(JSON.parse(body));
   const answer=()=>{res.setHeader('Content-Type','application/json');
    if(mode==='rate'){res.statusCode=429;return res.end('{"success":false}');}
    if(mode==='unavailable'){res.statusCode=503;return res.end('{"success":false}');}
    if(mode==='invalid')return res.end('invalid-json');
    if(mode==='rejected')return res.end('{"success":false}');
    res.statusCode=202;res.end('{"success":true,"status":"queued"}');};
   if(mode==='slow')return setTimeout(answer,250);
   answer();
  });return;
 }
 const file=path.resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 let body=fs.readFileSync(file);const ext=path.extname(file);
 if(ext==='.html')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[ext]||'application/octet-stream');res.end(body);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  async function prepare(configured=true){
   const page=await browser.newPage({viewport:{width:1000,height:760}});await page.goto(origin);
   await page.addScriptTag({path:path.join(root,'libs/tailwindcss.min.js')});
   await page.addScriptTag({path:path.join(root,'js/config.js')});
   const config=fs.readFileSync(path.join(root,'js/bug_report_config.js'),'utf8')
    .replace('https://www.kennyspan.xyz/api/kennysvideo/feedback',origin+'/submit')
    .replace(/enabled: (true|false)/,`enabled: ${configured}`);
   await page.addScriptTag({content:config});await page.addScriptTag({path:path.join(root,'js/bug_report.js')});
   await page.evaluate(()=>openBugReport());return page;
  }
  const unconfigured=await prepare(false);assert.equal(await unconfigured.getByRole('button',{name:'发送报告',exact:true}).isEnabled(),false);
  assert.equal(submissions.length,0);await unconfigured.close();
  const page=await prepare();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();assert.equal(submissions.length,0);
  await page.locator('[name=title]').fill('全屏时进度条没有显示');
  await page.locator('#bugReportDialog [name=description]').fill('打开影片后点击全屏，底部进度条没有显示。');
  await page.locator('[name=steps]').fill('打开影片 → 点击全屏');
  await page.locator('[name=email]').fill('reporter@example.test');
  await page.screenshot({path:path.join(__dirname,'../dist-windows/KennysVideo-bug-report-preview.png')});
  mode='rejected';await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByText('报告未能提交，请检查网络后重试',{exact:true}).waitFor();
  assert.equal(await page.locator('[name=title]').inputValue(),'全屏时进度条没有显示');
  mode='rate';await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByText('反馈过于频繁或发送额度已用完，请稍后再试',{exact:true}).waitFor();
  mode='unavailable';await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByText('反馈服务暂不可用，内容已保留，请稍后重试',{exact:true}).waitFor();
  mode='invalid';await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByText('服务未返回有效结果，请稍后重试',{exact:true}).waitFor();
  mode='slow';const before=submissions.length;await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.keyboard.press('Escape');assert.equal(await page.locator('#bugReportDialog').isVisible(),true);
  assert.equal(await page.getByRole('button',{name:'取消',exact:true}).isEnabled(),false);
  await page.getByText('报告已提交，服务器已保存并加入发送队列。感谢你的反馈！',{exact:true}).waitFor();
  assert.equal(submissions.length,before+1);assert.equal(await page.getByRole('button',{name:'已提交',exact:true}).isEnabled(),false);
  const payload=submissions.at(-1);
  assert.deepEqual(Object.keys(payload).sort(),['request_id','title','description','steps','reply_email','version','platform'].sort());
  assert.equal(payload.version,require('../package.json').version);assert.equal(payload.reply_email,'reporter@example.test');
  assert.match(payload.request_id,/^[a-f0-9-]{36}$/);assert.equal(new Set(submissions.map(item=>item.request_id)).size,1);
  assert(!JSON.stringify(payload).includes('http'));assert(!JSON.stringify(payload).includes('SMTP'));
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.evaluate(()=>openBugReport());
  assert.equal(await page.locator('[name=title]').inputValue(),'');
  await page.setViewportSize({width:480,height:600});
  const geometry=await page.locator('#bugReportDialog').boundingBox();assert(geometry.x>=0&&geometry.x+geometry.width<=480&&geometry.height<=600);
  console.log('PASS actual fetch → local HTTP: required fields, unconfigured channel, strict success, JSON failure, 429, retry preserves text, single submission, close lock, success reset, 480px layout; no real email sent');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
