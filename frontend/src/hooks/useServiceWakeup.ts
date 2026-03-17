import { useState, useEffect } from 'react';

// Only active when deployed on Render free tier (set VITE_PLATFORM=render on Vercel)
const IS_RENDER = import.meta.env.VITE_PLATFORM === 'render';
const LOAN_SERVICE_URL = import.meta.env.VITE_LOAN_SERVICE_URL ?? '';

// Quick timeout for the initial probe — if the service doesn't respond within
// this window we assume it's sleeping and show the waking overlay.
const INITIAL_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 5000;

async function pingHealth(timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${LOAN_SERVICE_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export type WakeupStatus = 'idle' | 'waking' | 'awake';

export function useServiceWakeup(): WakeupStatus {
  const [status, setStatus] = useState<WakeupStatus>('idle');

  useEffect(() => {
    if (!IS_RENDER) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function poll() {
      const ok = await pingHealth(POLL_INTERVAL_MS);
      if (cancelled) return;
      if (ok) {
        setStatus('awake');
      } else {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    async function initialProbe() {
      const ok = await pingHealth(INITIAL_TIMEOUT_MS);
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
