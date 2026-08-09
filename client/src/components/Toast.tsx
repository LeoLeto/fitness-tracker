import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Toast.module.scss';

export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toast = message ? (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  ) : null;

  return { toast, show };
}
