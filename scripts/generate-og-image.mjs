// Regenerates public/og-default.png (the 1200x630 default social preview) from the profile photo.
// Run with `node scripts/generate-og-image.mjs` after changing the name, role or photo.
// Uses `sharp`, which is installed with Astro (no extra dependency).
import sharp from 'sharp';
import { SEO } from '../src/lib/seo-config.mjs';

const W = 1200;
const H = 630;
const SIZE = 300;

const photo = await sharp('src/assets/profile.jpg')
  .resize(SIZE, SIZE, { fit: 'cover' })
  .composite([{ input: Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="64" fill="#fff"/></svg>`), blend: 'dest-in' }])
  .png()
  .toBuffer();

const host = new URL(SEO.siteUrl).host;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#1b1f3a"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#e879f9"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#818cf8" stop-opacity="0.45"/><stop offset="1" stop-color="#818cf8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="290" cy="315" r="300" fill="url(#glow)"/>
  <g font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
    <text x="540" y="270" font-size="76" font-weight="700" fill="#ffffff">${SEO.siteName}</text>
    <rect x="540" y="296" width="120" height="6" rx="3" fill="url(#accent)"/>
    <text x="540" y="368" font-size="34" font-weight="500" fill="#c7d2fe">Principal Technical Marketing Engineer</text>
    <text x="540" y="416" font-size="30" fill="#9aa4bf">VMware by Broadcom</text>
    <text x="540" y="545" font-size="28" fill="#9aa4bf">${host}</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .composite([{ input: photo, left: 140, top: (H - SIZE) / 2 }])
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/og-default.png');
console.log('Wrote public/og-default.png');
