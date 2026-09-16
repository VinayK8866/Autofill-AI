export const ENV = {
  SUPABASE_URL: (import.meta.env.VITE_SUPABASE_URL as string) || '',
  SUPABASE_ANON_KEY: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
  POSTHOG_KEY: (import.meta.env.VITE_POSTHOG_KEY as string) || '',
  CLOUD_PROXY_URL: (import.meta.env.VITE_CLOUD_PROXY_URL as string) || 'https://autofill-ai-proxy.vinaykondabattula.workers.dev',
  LEMON_SQUEEZY_CHECKOUT_URL: (import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL as string) || '',
  PAYMENT_GATEWAY: (import.meta.env.VITE_PAYMENT_GATEWAY as string) || 'paddle',
  PADDLE_CHECKOUT_URL: (import.meta.env.VITE_PADDLE_CHECKOUT_URL as string) || '',
};

export function validateClientEnv(): void {
  const missing: string[] = [];
  if (!ENV.SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!ENV.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing required environment variables: ${missing.join(', ')}. Ensure .env is properly configured.`);
  }
}

