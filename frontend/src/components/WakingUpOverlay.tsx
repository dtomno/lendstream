import type { WakeupStatus } from '../hooks/useServiceWakeup';

interface Props {
  status: WakeupStatus;
}

export default function WakingUpOverlay({ status }: Props) {
  const IS_RENDER = import.meta.env.VITE_PLATFORM === 'render';
  // console.log('WakingUpOverlay status:', status, 'IS_RENDER:', IS_RENDER);
  //return loading spinner if status is 'idle'
 if (status === 'idle' && IS_RENDER) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <span className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-900" />
            <span className="absolute inset-0 rounded-full border-4 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
            <span className="absolute inset-2 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Checking service status...
          </p>
        </div>
      </div>
    );
  }

  if (status !== 'waking') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-8 w-full max-w-sm mx-4 text-center">

        {/* Animated rings */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <span className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-blue-900" />
          <span className="absolute inset-0 rounded-full border-4 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <span className="absolute inset-2 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          Services are starting up
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          The backend services are waking up from sleep. This usually takes{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">30–60 seconds</span>.
        </p>

        {/* Animated dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-5">
          Powered by Render free tier · will redirect automatically
        </p>
      </div>
    </div>
  );
}
