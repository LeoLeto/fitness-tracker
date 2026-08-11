import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import styles from './Toast.module.scss';

export interface ToastAction {
  label: string;
  /** Runs when tapped. The toast closes first, so the action can show its own. */
  onAction: () => void;
}

interface ShowOptions {
  action?: ToastAction;
  /** Overrides the hook's default lifetime (5s when an action is attached). */
  durationMs?: number;
}

interface ToastState {
  message: string;
  action?: ToastAction;
  /** Whole seconds left — an action is only trustworthy if its window is visible. */
  secondsLeft: number;
}

const ACTION_DURATION_MS = 5000;

export function useToast(durationMs = 2200): {
  toast: ReactNode;
  show: (message: string, options?: ShowOptions) => void;
  dismiss: () => void;
} {
  const [state, setState] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ticker = useRef<number | undefined>(undefined);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearInterval(ticker.current);
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setState(null);
  }, [clearTimers]);

  const show = useCallback(
    (message: string, options?: ShowOptions) => {
      const action = options?.action;
      const life = options?.durationMs ?? (action ? ACTION_DURATION_MS : durationMs);
      clearTimers();
      setState({ message, action, secondsLeft: Math.ceil(life / 1000) });
      timer.current = window.setTimeout(() => {
        clearTimers();
        setState(null);
      }, life);
      if (action) {
        ticker.current = window.setInterval(() => {
          setState((s) => (s ? { ...s, secondsLeft: Math.max(0, s.secondsLeft - 1) } : s));
        }, 1000);
      }
    },
    [clearTimers, durationMs]
  );

  useEffect(() => clearTimers, [clearTimers]);

  const action = state?.action;
  const toast = state ? (
    <div className={action ? `${styles.toast} ${styles.withAction}` : styles.toast}>
      {/* Only the message is live: a countdown inside the region would make a
          screen reader re-announce the whole toast every second. */}
      <span className={styles.message} role="status" aria-live="polite">
        {state.message}
      </span>
      {action && (
        <button
          type="button"
          className={styles.action}
          aria-label={action.label}
          onClick={() => {
            dismiss();
            action.onAction();
          }}
        >
          {action.label}
          <span className={styles.countdown} aria-hidden="true">
            {state.secondsLeft}
          </span>
        </button>
      )}
    </div>
  ) : null;

  return { toast, show, dismiss };
}
