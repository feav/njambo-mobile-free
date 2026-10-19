import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'src/assets/images/cards');
const texture = `file://${resolve(outputDir, 'card-texture-template.png')}`;
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tempDir = resolve(root, '.card-generation');
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const suits = {
  C: { symbol: '♣', color: '#111714', label: 'trèfle' },
  D: { symbol: '♦', color: '#d91d0b', label: 'carreau' },
  H: { symbol: '♥', color: '#d91d0b', label: 'cœur' },
  S: { symbol: '♠', color: '#111714', label: 'pique' },
};

const pipLayouts = {
  2: [[50,29,0],[50,71,180]],
  3: [[50,23,0],[50,50,0],[50,77,180]],
  4: [[31,28,0],[69,28,0],[31,72,180],[69,72,180]],
  5: [[31,25,0],[69,25,0],[50,50,0],[31,75,180],[69,75,180]],
  6: [[31,23,0],[69,23,0],[31,50,0],[69,50,0],[31,77,180],[69,77,180]],
  7: [[31,20,0],[69,20,0],[50,36,0],[31,50,0],[69,50,0],[31,78,180],[69,78,180]],
  8: [[31,19,0],[69,19,0],[50,34,0],[31,45,0],[69,55,180],[50,66,180],[31,81,180],[69,81,180]],
  9: [[31,18,0],[69,18,0],[31,38,0],[69,38,0],[50,50,0],[31,62,180],[69,62,180],[31,82,180],[69,82,180]],
  10:[[31,17,0],[69,17,0],[50,29,0],[31,37,0],[69,37,0],[31,63,180],[69,63,180],[50,71,180],[31,83,180],[69,83,180]],
};

mkdirSync(tempDir, { recursive: true });

function centerMarkup(rank, symbol) {
  if (pipLayouts[rank]) {
    return pipLayouts[rank].map(([x,y,rotation]) =>
      `<span class="pip" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rotation}deg)">${symbol}</span>`
    ).join('');
  }
  if (rank === 'A') return `<div class="ace-mark">${symbol}</div>`;
  return `<div class="court"><span>${rank}</span><b>${symbol}</b><i>${rank}</i></div>`;
}

function documentFor(rank, suit) {
  const { symbol, color, label } = suits[suit];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{width:235px;height:360px;margin:0;overflow:hidden;background:transparent}
    body{font-family:Georgia,'Times New Roman',serif}
    .card{position:relative;width:235px;height:360px;overflow:hidden;border-radius:18px;
      background:linear-gradient(rgba(255,252,243,.3),rgba(242,235,218,.18)),url('${texture}') center/cover;
      color:${color};border:2px solid #f7ca53;
      box-shadow:inset 0 0 0 2px #fff9df,inset 0 0 0 4px #a86c08,inset 0 0 18px rgba(121,76,0,.16)}
    .card:after{content:'';position:absolute;inset:6px;border:1px solid rgba(255,213,92,.76);border-radius:12px;pointer-events:none}
    .corner{position:absolute;z-index:3;width:46px;display:grid;justify-items:center;line-height:.78;text-shadow:0 1px 0 #fff,0 2px 2px rgba(62,31,0,.26)}
    .corner strong{font-family:Arial,sans-serif;font-size:${rank === '10' ? 31 : 38}px;font-weight:900;letter-spacing:-2px}
    .corner small{font-family:Arial,sans-serif;font-size:29px;font-weight:900}
    .corner.top{top:18px;left:15px}.corner.bottom{right:15px;bottom:18px;transform:rotate(180deg)}
    .pip{position:absolute;z-index:2;font-family:Arial,sans-serif;font-size:47px;font-weight:900;line-height:1;
      text-shadow:0 1px 0 #fff4c6,1px 2px 0 #b17b19,0 4px 5px rgba(63,35,0,.2)}
    .ace-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:Arial,sans-serif;font-size:128px;font-weight:900;line-height:1;
      text-shadow:0 2px 0 #fff4c6,2px 4px 0 #b17b19,0 8px 10px rgba(63,35,0,.22)}
    .court{position:absolute;left:50%;top:50%;width:118px;height:196px;transform:translate(-50%,-50%);overflow:hidden;border:3px solid #c88b18;border-radius:58px 58px 18px 18px;
      display:grid;place-items:center;background:radial-gradient(circle at 50% 38%,#fff9e8,#e4c97e 58%,#8f590a 100%);box-shadow:inset 0 0 0 2px #fff4c7,0 8px 16px rgba(65,35,0,.22)}
    .court:before{content:'';position:absolute;inset:10px;border:2px solid currentColor;border-radius:48px 48px 12px 12px;opacity:.52}
    .court span,.court i{position:absolute;font-family:Arial,sans-serif;font-size:64px;font-weight:950;font-style:normal;text-shadow:0 2px #fff5c8,2px 4px #aa7417}
    .court span{top:20px}.court i{bottom:20px;transform:rotate(180deg)}.court b{z-index:2;font-family:Arial,sans-serif;font-size:54px;text-shadow:0 2px #fff5c8,2px 4px #aa7417}
  </style></head><body><main class="card" role="img" aria-label="${rank} de ${label}">
    <div class="corner top"><strong>${rank}</strong><small>${symbol}</small></div>
    ${centerMarkup(rank, symbol)}
    <div class="corner bottom"><strong>${rank}</strong><small>${symbol}</small></div>
  </main></body></html>`;
}

for (const [suit] of Object.entries(suits)) {
  for (const rank of ranks) {
    const htmlPath = resolve(tempDir, `${rank}${suit}.html`);
    const outputPath = resolve(outputDir, `${rank}${suit}.png`);
    writeFileSync(htmlPath, documentFor(rank, suit));
    const result = spawnSync(chrome, [
      '--headless=new','--hide-scrollbars','--disable-gpu','--no-sandbox',
      '--default-background-color=00000000','--force-device-scale-factor=1',
      '--window-size=235,360',`--screenshot=${outputPath}`,`file://${htmlPath}`
    ], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Échec de génération ${rank}${suit}: ${result.stderr}`);
  }
}

rmSync(tempDir, { recursive: true, force: true });
console.log(`52 cartes générées dans ${outputDir}`);
