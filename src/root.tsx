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

import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';

import './global.css';

/** Register the service worker only on mobile or when installed as PWA to avoid "persistent storage" prompts on desktop. */
const ServiceWorkerRegisterConditional = component$(() => {
  useVisibleTask$(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isMobile =
      /Mobi|Android|iPhone|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true;
    if (!isStandalone && !isMobile) return;
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((e) => console.error('SW register failed:', e));
  });
  return null;
});

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
        <link rel="manifest" href={`${import.meta.env.BASE_URL}manifest.json`} />
        <link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}icon.svg`} />
        <link rel="apple-touch-icon" href={`${import.meta.env.BASE_URL}icon.svg`} />
      </head>
      <body>
        {/* Skip link for keyboard users (accessibility) */}
        <a class="skip-link" href="#main-content">
          Skip to content
        </a>
        <RouterOutlet />
        <ServiceWorkerRegisterConditional />
      </body>
    </QwikCityProvider>
  );
});
