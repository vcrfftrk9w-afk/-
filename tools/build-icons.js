// Рисует PNG-иконки для установки на телефон: node tools/build-icons.js
// Android (Chrome) хочет 192 и 512, айфон — apple-touch-icon 180 без скруглений (скругляет сам),
// APK — mipmap-иконки в android/app/src/main/res.
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'icons');
const RES = '../android/app/src/main/res';
const ICONS = [
  { file: 'icon-192.png', size: 192, radius: 0.22, emoji: 0.56 },
  { file: 'icon-512.png', size: 512, radius: 0.22, emoji: 0.56 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0, emoji: 0.44 }, // Android обрежет в круг/сквиркл — эмодзи в безопасной зоне
  { file: 'apple-touch-icon.png', size: 180, radius: 0, emoji: 0.56 },
  // Android-приложение (APK): обычная иконка по плотностям экрана и передний слой адаптивной иконки
  ...[['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]].map(([d, size]) => (
    { file: `${RES}/mipmap-${d}/ic_launcher.png`, size, radius: 0.22, emoji: 0.56 })),
  { file: `${RES}/mipmap-xxxhdpi/ic_launcher_foreground.png`, size: 432, radius: 0, emoji: 0.42, bg: 'transparent' },
];

const html = ({ size, radius, emoji, bg }) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;
  background:${bg || 'linear-gradient(135deg,#7c3aed,#06b6d4)'};display:flex;align-items:center;justify-content:center;
  font:${Math.round(size * emoji)}px/1 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif">🦥</div>
</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const icon of ICONS) {
    const p = await b.newPage({ viewport: { width: icon.size, height: icon.size } });
    await p.setContent(html(icon));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, icon.file), omitBackground: true });
    await p.close();
    console.log(path.join('icons', icon.file));
  }
  await b.close();
})();
