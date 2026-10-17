'use client';
import { useState } from 'react';
import type { ReportBreakdownRow } from '@/lib/server/reports/types';
import { previewSources, usablePreviewDimensions } from '@/lib/shared/media/preview';
import styles from './Sections.module.css';
export function CreativePreview({ row }: { row: ReportBreakdownRow }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = previewSources(row.creativePreview ?? undefined, failed)[0];
  return <div className={styles.preview}>{src ?
    // Source URLs are already resolved and sanitized on the server; dimensions are verified on load.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Creative for ${row.name}`} loading="lazy" referrerPolicy="no-referrer"
      onError={() => setFailed(values => [...values, src])}
      onLoad={e => { if (!usablePreviewDimensions(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)) setFailed(values => [...values, src]); }} />
    : <span>Preview unavailable</span>}</div>;
}
