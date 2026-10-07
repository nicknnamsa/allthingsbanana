import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://allthingsbanana.com',
  // old addresses keep working
  redirects: {
    '/banana-cube': '/more/banana-cube/',
    '/markets': '/bananalytics/',
  },
  // sitemap-index.xml for search engines: every page except redirects and the 404 page
  integrations: [
    sitemap({
      filter: page => !['/banana-cube/', '/markets/'].includes(new URL(page).pathname) && !page.includes('/404'),
    }),
  ],
});
