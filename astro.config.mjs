import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  fonts: [{
    name: 'Pixelify Sans',
    cssVariable: '--font-pixel',
    provider: fontProviders.local(),
    options: { variants: [
      { src: ['./node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-400-normal.woff2'], weight: '400', style: 'normal' },
      { src: ['./node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2'], weight: '700', style: 'normal' }
    ] },
    fallbacks: ['monospace']
  }]
});
