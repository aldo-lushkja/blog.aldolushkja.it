import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://blog.aldolushkja.it',
  output: 'static',
  integrations: [mdx(), sitemap()],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4200,
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
