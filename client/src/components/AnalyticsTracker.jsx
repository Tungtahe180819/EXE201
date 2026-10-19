import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef('');

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}`;
    if (lastTrackedPath.current === pagePath) return;

    lastTrackedPath.current = pagePath;
    trackPageView(pagePath);
  }, [location.pathname, location.search]);

  return null;
}
