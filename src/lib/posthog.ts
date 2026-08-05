import posthog from 'posthog-js/dist/module.no-external';
import { ENV } from '../config/env';

const POSTHOG_KEY = ENV.POSTHOG_KEY;
const PROXY_HOST = `${ENV.CLOUD_PROXY_URL.replace(/\/$/, '')}/posthog`;

if (POSTHOG_KEY && typeof window !== 'undefined') {
  posthog.init(POSTHOG_KEY, {
    api_host: PROXY_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_performance: true,
    persistence: 'localStorage',
    enable_recording_console_log: true,
    disable_external_dependency_loading: true,
    loaded: () => {
      console.log('PostHog telemetry initialized via Cloudflare proxy');
    }
  });
}

export { posthog };
