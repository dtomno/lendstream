import { useState, useEffect } from 'react';

// Only active when deployed on Render free tier (set VITE_PLATFORM=render on Vercel)
const IS_RENDER = import.meta.env.VITE_PLATFORM === 'render';

// All pipeline services — pinged on startup so their Kafka consumers are running
// before the user submits a loan application.
const ALL_SERVICE_URLS: string[] = [
  import.meta.env.VITE_LOAN_SERVICE_URL ?? '',
  import.meta.env.VITE_CREDIT_SERVICE_URL ?? '',
  import.meta.env.VITE_RISK_SERVICE_URL ?? '',
  import.meta.env.VITE_APPROVAL_SERVICE_URL ?? '',
  import.meta.env.VITE_ACCOUNT_SERVICE_URL ?? '',
  import.meta.env.VITE_NOTIFICATION_SERVICE_URL ?? '',
].filter(Boolean);

const INITIAL_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 5000;

async function ping(baseUrl: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function pingAll(urls: string[], timeoutMs: number): Promise<boolean> {
  const results = await Promise.all(urls.map(url => ping(url, timeoutMs)));
  return results.every(Boolean);
}

export type WakeupStatus = 'idle' | 'waking' | 'awake';

export function useServiceWakeup(): WakeupStatus {
  const [status, setStatus] = useState<WakeupStatus>('idle');

  useEffect(() => {
    if (!IS_RENDER) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function poll() {
      const ok = await pingAll(ALL_SERVICE_URLS, POLL_INTERVAL_MS);
      if (cancelled) return;
      if (ok) {
        setStatus('awake');
      } else {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    async function initialProbe() {
      const ok = await pingAll(ALL_SERVICE_URLS, INITIAL_TIMEOUT_MS);
      if (cancelled) return;
      if (ok) {
        setStatus('awake');
      } else {
        setStatus('waking');
        poll();
      }
    }

    initialProbe();

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, []);

  return status;
}
