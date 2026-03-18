import { useState, useEffect } from 'react';

// Only active when deployed on Render free tier (set VITE_PLATFORM=render on Vercel)
const IS_RENDER = import.meta.env.VITE_PLATFORM === 'render';
const LOAN_SERVICE_URL = import.meta.env.VITE_LOAN_SERVICE_URL ?? '';

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

// Wake all pipeline services in the background (fire-and-forget).
// Render only wakes a service when it gets HTTP traffic — without this,
// credit/risk/approval/account/notification services stay asleep and
// won't consume Kafka messages.
function wakeAllServices(): void {
  for (const url of ALL_SERVICE_URLS) {
    ping(url, 60_000).catch(() => {/* ignore */});
  }
}

export type WakeupStatus = 'idle' | 'waking' | 'awake';

export function useServiceWakeup(): WakeupStatus {
  const [status, setStatus] = useState<WakeupStatus>('idle');

  useEffect(() => {
    if (!IS_RENDER) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    // Kick all services awake immediately
    wakeAllServices();

    async function poll() {
      const ok = await ping(LOAN_SERVICE_URL, POLL_INTERVAL_MS);
      if (cancelled) return;
      if (ok) {
        setStatus('awake');
      } else {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    async function initialProbe() {
      const ok = await ping(LOAN_SERVICE_URL, INITIAL_TIMEOUT_MS);
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
