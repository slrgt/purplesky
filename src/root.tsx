/**
 * Root component for PurpleSky.
 *
 * This is the outermost Qwik component – it wraps the entire app.
 * QwikCityProvider handles routing; the <head> includes PWA meta tags.
 *
 * HOW TO EDIT:
 *  - To change the page title, edit the <title> tag below
 *  - To add global meta tags (OG tags, etc.), add them inside <head>
 *  - The <body> renders RouterOutlet which shows the current route
 */

import { component$ } from '@builder.io/qwik';
import {
  QwikCityProvider,
  RouterOutlet,
  ServiceWorkerRegister,
} from '@builder.io/qwik-city';

import './global.css';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

        {/* PWA meta tags */}
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* App info */}
        <title>PurpleSky</title>
        <meta name="description" content="Bluesky PWA – feeds, forums, consensus, collaboration" />
        <link rel="manifest" href="./manifest.json" />
        <link rel="icon" type="image/svg+xml" href="./icon.svg" />
        <link rel="apple-touch-icon" href="./icon.svg" />
      </head>
      <body>
        {/* Skip link for keyboard users (accessibility) */}
        <a class="skip-link" href="#main-content">
          Skip to content
        </a>
        <RouterOutlet />
        <ServiceWorkerRegister />
      </body>
    </QwikCityProvider>
  );
});
