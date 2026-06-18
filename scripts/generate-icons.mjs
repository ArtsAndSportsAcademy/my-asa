import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const iconSvg = (size, padding) => {
  const featherScale = (size - padding * 2) / 100;
  const tx = padding + (size - padding * 2) * 0.0;
  const ty = padding - (size - padding * 2) * 0.03;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="fa" x1="${size*0.72}" y1="${size*0.06}" x2="${size*0.18}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E9D5FF"/>
      <stop offset="55%" stop-color="#C4B5FD"/>
      <stop offset="100%" stop-color="#BAE6FD"/>
    </linearGradient>
    <linearGradient id="fb" x1="${size*0.78}" y1="${size*0.22}" x2="${size*0.20}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#DDD6FE"/>
      <stop offset="100%" stop-color="#BFDBFE"/>
    </linearGradient>
    <linearGradient id="fc" x1="${size*0.80}" y1="${size*0.38}" x2="${size*0.22}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4B5FD"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
  </defs>

  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>

  <g transform="translate(${tx}, ${ty}) scale(${featherScale})">
    <path
      d="M 16,106 C 10,80 8,50 18,22 C 28,2 56,-2 76,10 C 62,18 46,34 36,58 C 28,76 22,92 16,106 Z"
      fill="url(#fa)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
    <path
      d="M 20,106 C 16,84 18,60 28,40 C 40,18 64,10 82,20 C 68,28 54,46 46,66 C 36,84 28,96 20,106 Z"
      fill="url(#fb)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
    <path
      d="M 24,106 C 20,88 22,70 32,54 C 44,36 68,28 84,38 C 72,46 60,60 52,78 C 44,92 34,100 24,106 Z"
      fill="url(#fc)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
  </g>
</svg>`;
};

const splashSvg = (size) => {
  const featherH = size * 0.55;
  const featherW = featherH * (100 / 112);
  const featherScale = featherH / 112;
  const tx = (size - featherW) / 2;
  const ty = (size - featherH) / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="fa" x1="${size*0.72}" y1="${size*0.06}" x2="${size*0.18}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E9D5FF"/>
      <stop offset="55%" stop-color="#C4B5FD"/>
      <stop offset="100%" stop-color="#BAE6FD"/>
    </linearGradient>
    <linearGradient id="fb" x1="${size*0.78}" y1="${size*0.22}" x2="${size*0.20}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#DDD6FE"/>
      <stop offset="100%" stop-color="#BFDBFE"/>
    </linearGradient>
    <linearGradient id="fc" x1="${size*0.80}" y1="${size*0.38}" x2="${size*0.22}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4B5FD"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="url(#bg)"/>

  <g transform="translate(${tx}, ${ty}) scale(${featherScale})">
    <path
      d="M 16,106 C 10,80 8,50 18,22 C 28,2 56,-2 76,10 C 62,18 46,34 36,58 C 28,76 22,92 16,106 Z"
      fill="url(#fa)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
    <path
      d="M 20,106 C 16,84 18,60 28,40 C 40,18 64,10 82,20 C 68,28 54,46 46,66 C 36,84 28,96 20,106 Z"
      fill="url(#fb)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
    <path
      d="M 24,106 C 20,88 22,70 32,54 C 44,36 68,28 84,38 C 72,46 60,60 52,78 C 44,92 34,100 24,106 Z"
      fill="url(#fc)"
      stroke="rgba(255,255,255,0.2)"
      stroke-width="${1.5 / featherScale}"
      stroke-linejoin="round"
    />
  </g>
</svg>`;
};

async function generate() {
  const outDir = 'artifacts/mobile/assets/images';

  // icon.png — 1024x1024 with rounded corners baked in
  await sharp(Buffer.from(iconSvg(1024, 112)))
    .png()
    .toFile(`${outDir}/icon.png`);
  console.log('✓ icon.png');

  // adaptive-icon.png — 1024x1024, no rounded corners (Android clips it)
  const adaptiveSvg = iconSvg(1024, 112).replace(`rx="${1024 * 0.2}"`, 'rx="0"');
  await sharp(Buffer.from(adaptiveSvg))
    .png()
    .toFile(`${outDir}/adaptive-icon.png`);
  console.log('✓ adaptive-icon.png');

  // splash-icon.png — 1024x1024, feather centered, full bleed background
  await sharp(Buffer.from(splashSvg(1024)))
    .png()
    .toFile(`${outDir}/splash-icon.png`);
  console.log('✓ splash-icon.png');
}

generate().catch(console.error);
