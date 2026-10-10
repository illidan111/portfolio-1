import { defineConfig, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { features } from './src/site.config.ts';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const fileEnv = loadEnv(process.env.NODE_ENV || 'production', projectRoot, 'SITE_');
const configuredSite = process.env.SITE_URL || fileEnv.SITE_URL || 'https://portfolio.example';
const siteURL = new URL(configuredSite);
if (!['https:', 'http:'].includes(siteURL.protocol) || siteURL.username || siteURL.password ||
    siteURL.search || siteURL.hash || siteURL.pathname !== '/') {
  throw new Error('SITE_URL must be an HTTP(S) origin without credentials, a path, query, or hash.');
}

export default defineConfig({
  output: 'static',
  site: siteURL.origin,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Both graphics chunks stay behind the project-only visibility import.
  vite: { build: { rollupOptions: { output: {
    onlyExplicitManualChunks: true,
    manualChunks(id) {
      const path = id.replaceAll('\\', '/');
      if (features.voxels && path.includes('/node_modules/three/build/three.core.js')) return 'three-core';
      if (path.includes('/src/scripts/engine/') && !/\/(voxel|three-runtime)\.ts$/.test(path)) return 'game-engine';
    },
  } } } },
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
