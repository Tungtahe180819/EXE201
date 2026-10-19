const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const isMeasurementIdValid = /^G-[A-Z0-9]+$/.test(measurementId || '');

let initialized = false;

export function trackPageView(pagePath) {
  if (!isMeasurementIdValid || typeof window === 'undefined') return;

  if (!initialized) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.id = 'google-analytics-gtag';
    document.head.appendChild(script);
    initialized = true;
  }

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: document.title,
    page_location: `${window.location.origin}${pagePath}`,
  });
}
