const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const png=fs.readFileSync(path.join(root,'src-tauri/icons/icon.png'));
const size=png.readUInt32BE(16);
for(const name of ['kennys-logo.png','retrotv_5520.png','nomedia.png'])fs.writeFileSync(path.join(root,'public/image',name),png);
for(const name of fs.readdirSync(path.join(root,'public')).filter(name=>name.endsWith('.html'))) {
 const file=path.join(root,'public',name);
 let html=fs.readFileSync(file,'utf8').replaceAll('image/retrotv_5520.png','image/kennys-logo.png');
 if(!html.includes('rel="icon"'))html=html.replace('<head>','<head>\n    <link rel="icon" href="./image/kennys-logo.png">\n    <link rel="apple-touch-icon" href="./image/kennys-logo.png">');
 fs.writeFileSync(file,html);
}
const manifestPath=path.join(root,'public/manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
manifest.icons=[{src:'./image/kennys-logo.png',sizes:`${size}x${size}`,type:'image/png'}];
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const configPath=path.join(root,'public/js/config.js');
fs.writeFileSync(configPath,fs.readFileSync(configPath,'utf8').replace('image/retrotv_5520.png','image/kennys-logo.png'));
console.log(`Installed ${size}px web icon and updated every desktop page favicon.`);
