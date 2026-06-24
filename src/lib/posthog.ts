import posthog from 'posthog-js';

const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string) || '';
const PROXY_HOST = 'https://autofill-ai-proxy.vinaykondabattula.workers.dev/posthog';

if (POSTHOG_KEY && typeof window !== 'undefined') {
  posthog.init(POSTHOG_KEY, {
    api_host: PROXY_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_performance: true,
    persistence: 'localStorage',
    enable_recording_console_log: true,
    loaded: () => {
      console.log('PostHog telemetry initialized via Cloudflare proxy');
    }
  });
}

export { posthog };
