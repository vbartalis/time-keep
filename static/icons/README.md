# Icons

`mark.svg` is the one source: a time card in its rack (rack ink ground, card stock card,
violet punch). The PNGs are rendered from it, never edited by hand.

| File | Size | Used for |
|------|------|----------|
| `icon-192.png`, `icon-512.png` | 192, 512 | manifest, purpose `any` |
| `icon-maskable-512.png` | 512 | manifest, purpose `maskable` (the mark sits inside the central 80% circle) |
| `apple-touch-icon.png` | 180 | iOS home screen, linked from `src/app.html` |

Colours are the hex of DESIGN.md's `rack-ink` (`#172338`), `card-stock` (`#e7f2fa`),
`ribbon-violet` (`#72359d`) and a tint of card ink for the hairlines.

## Regenerate

Run from the repo root, with the Playwright browsers' libraries on the path (devcontainer):

```sh
LD_LIBRARY_PATH=$HOME/.cache/pw-libs FONTCONFIG_FILE=$HOME/.cache/pw-fonts/fonts.conf \
node --input-type=module -e "
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('static/icons/mark.svg', 'utf8');
const out = { 'icon-192': 192, 'icon-512': 512, 'icon-maskable-512': 512, 'apple-touch-icon': 180 };
const browser = await chromium.launch();
for (const [name, size] of Object.entries(out)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent('<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + svg);
  await page.screenshot({ path: 'static/icons/' + name + '.png' });
  await page.close();
}
await browser.close();
"
```
