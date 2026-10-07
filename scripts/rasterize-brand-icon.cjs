const fs = require('fs');
const path = require('path');
const { chromium } = require('D:/00. 학습센터/01. Note/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'design', 'brand-mark.svg'), 'utf8');
const sizes = [16, 32, 48, 180, 192, 512];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const out = path.join(root, 'design');
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px"><style>svg{display:block;width:100%;height:100%}</style>${svg}</body>`);
    await page.screenshot({ path: path.join(out, size === 180 ? 'apple-touch-icon.png' : size === 192 ? 'icon-192.png' : size === 512 ? 'icon-512.png' : `favicon-${size}.png`), type: 'png' });
  }
  const icoParts = [Buffer.from([0, 0, 1, 0, 3, 0])];
  const pngs = [16, 32, 48].map(size => fs.readFileSync(path.join(out, `favicon-${size}.png`)));
  let offset = 6 + 16 * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const size = [16, 32, 48][i];
    const entry = Buffer.alloc(16);
    entry[0] = size; entry[1] = size; entry[2] = 0; entry[3] = 0;
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngs[i].length, 8); entry.writeUInt32LE(offset, 12);
    icoParts.push(entry); offset += pngs[i].length;
  }
  icoParts.push(...pngs);
  fs.writeFileSync(path.join(out, 'favicon.ico'), Buffer.concat(icoParts));
  await browser.close();
})();
