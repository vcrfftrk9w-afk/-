// Рисует PNG-иконки маркетплейса Sauda из market/icons/icon.svg: node tools/sauda-icons.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, '..', 'market', 'icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const ICONS = [
  { file: 'icon-192.png', size: 192, pad: 0, round: true },
  { file: 'icon-512.png', size: 512, pad: 0, round: true },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12, round: false }, // Android обрежет в круг — знак в безопасной зоне
  { file: 'apple-touch-icon.png', size: 180, pad: 0, round: false },
  // APK (android-sauda): иконка по плотностям экрана
  ...[['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]].map(([d, size]) => (
    { file: `../../android-sauda/app/src/main/res/mipmap-${d}/ic_launcher.png`, size, pad: 0, round: true })),
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const ic of ICONS) {
    const p = await b.newPage({ viewport: { width: ic.size, height: ic.size } });
    const inner = ic.round ? svg : svg.replace('rx="16"', 'rx="0"');
    await p.setContent(`<body style="margin:0;background:${ic.pad ? '#0077b6' : 'transparent'}"><div style="width:${ic.size}px;height:${ic.size}px;display:grid;place-items:center">
      <div style="width:${ic.size * (1 - ic.pad * 2)}px;height:${ic.size * (1 - ic.pad * 2)}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body>`);
    fs.mkdirSync(path.dirname(path.join(DIR, ic.file)), { recursive: true });
    await p.screenshot({ path: path.join(DIR, ic.file), omitBackground: true });
    await p.close();
    console.log(path.relative(path.join(__dirname, '..'), path.join(DIR, ic.file)));
  }
  await b.close();
})();
