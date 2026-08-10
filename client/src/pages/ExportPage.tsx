import { useEffect, useState } from 'react';
import { RangePicker, RangeState, defaultRange } from '../components/RangePicker';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import pageStyles from '../styles/page.module.scss';
import styles from './ExportPage.module.scss';

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function ExportPage() {
  const [limitRange, setLimitRange] = useState(false);
  const [range, setRange] = useState<RangeState>(defaultRange());
  const [includeWorkouts, setIncludeWorkouts] = useState(true);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const from = limitRange ? range.from : undefined;
  const to = limitRange ? range.to : undefined;

  useEffect(() => {
    let cancelled = false;
    api
      .getExportText({ from, to, includeWorkouts })
      .then((text) => {
        if (!cancelled) setPreview(text);
      })
      .catch(() => {
        if (!cancelled) setPreview('Could not load preview.');
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, includeWorkouts]);

  const copy = async (withPrompt: boolean) => {
    setBusy(true);
    try {
      const text = await api.getExportText({ from, to, prompt: withPrompt, includeWorkouts });
      await copyToClipboard(text);
      show(withPrompt ? 'Data + analysis prompt copied ✓' : 'Markdown data copied ✓');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Export</h1>
        <p className="muted">
          Raw daily data, exactly as entered — ready to paste into ChatGPT or analyze anywhere.
        </p>
      </div>

      <div className={`card ${styles.rangeCard}`}>
        <label className={pageStyles.checkboxLabel}>
          <input
            type="checkbox"
            checked={limitRange}
            onChange={(e) => setLimitRange(e.target.checked)}
          />
          Limit to a date range (otherwise all data is exported)
        </label>
        {limitRange && <RangePicker value={range} onChange={setRange} />}
        <label className={pageStyles.checkboxLabel}>
          <input
            type="checkbox"
            checked={includeWorkouts}
            onChange={(e) => setIncludeWorkouts(e.target.checked)}
          />
          Include the workout log in ChatGPT copies
        </label>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn--accent"
          disabled={busy}
          onClick={() => void copy(true)}
        >
          Copy Data + Analysis Prompt
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => void copy(false)}>
          Copy for ChatGPT
        </button>
        <a className="btn" href={api.exportUrl('csv', from, to)}>
          Download CSV
        </a>
        <a className="btn" href={api.exportUrl('json', from, to)}>
          Download JSON
        </a>
        <a className="btn" href={api.exportUrl('meals.csv', from, to)}>
          Meals CSV
        </a>
        <a className="btn" href={api.exportUrl('workouts.csv', from, to)}>
          Workouts CSV
        </a>
        <a className="btn" href={api.exportUrl('workouts.json', from, to)}>
          Workouts JSON
        </a>
      </div>

      <div className={`card ${styles.previewCard}`}>
        <h2>Preview</h2>
        <pre className={styles.preview}>{preview || 'Loading…'}</pre>
      </div>

      {toast}
    </div>
  );
}
