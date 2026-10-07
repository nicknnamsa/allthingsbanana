import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://allthingsbanana.com',
  // old addresses keep working
  redirects: {
    '/banana-cube': '/more/banana-cube/',
    '/markets': '/bananalytics/',
  },
});
