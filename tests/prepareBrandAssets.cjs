// Preserve the supplied artwork; only wrap/encode it for app icons and placeholders.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const imageDir = path.join(root,'public/image');
const source = process.argv[2] || path.join(imageDir,'kennys-logo.jpg');
const bytes = fs.readFileSync(source);
fs.writeFileSync(path.join(imageDir,'kennys-logo.jpg'),bytes);
const uri = 'data:image/jpeg;base64,' + bytes.toString('base64');
fs.writeFileSync(path.join(imageDir,'kennys-logo.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><image width="600" height="600" href="${uri}"/></svg>`);
fs.writeFileSync(path.join(imageDir,'poster-placeholder.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
<rect width="300" height="450" rx="18" fill="#101d2b"/>
<image x="24" y="180" width="72" height="72" href="${uri}" preserveAspectRatio="xMidYMid meet"/>
<text x="108" y="209" fill="#67e8f9" font-family="Segoe UI,Arial,sans-serif" font-size="23" font-weight="700">KennysVideo</text>
<text x="109" y="235" fill="#9cabbc" font-family="Segoe UI,Arial,sans-serif" font-size="12">封面暂不可用</text></svg>`);
fs.writeFileSync(path.join(imageDir,'nomedia.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<rect width="1280" height="720" fill="#000"/>
<image x="255" y="270" width="150" height="150" href="${uri}" preserveAspectRatio="xMidYMid meet"/>
<text x="445" y="345" fill="#67e8f9" font-family="Segoe UI,Arial,sans-serif" font-size="72" font-weight="700">KennysVideo</text>
<text x="448" y="395" fill="#999" font-family="Segoe UI,Arial,sans-serif" font-size="26">自由观影，畅享精彩</text></svg>`);
console.log('Prepared exact supplied artwork and embedded offline placeholders.');
