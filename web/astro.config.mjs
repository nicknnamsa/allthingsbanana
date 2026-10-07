import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://allthingsbanana.com',
  // old addresses keep working
  redirects: {
    '/banana-cube': '/more/banana-cube/',
    '/markets': '/bananalytics/',
    '/more/six-degrees': '/bananadle/',
  },
  // sitemap-index.xml for search engines: every page except redirects and the 404 page
  integrations: [
    sitemap({
      filter: page => !['/banana-cube/', '/markets/', '/more/six-degrees/'].includes(new URL(page).pathname) && !page.includes('/404'),
    }),
  ],
});
