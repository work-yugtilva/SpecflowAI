'use client';

import { useState } from 'react';
import { castToPRDExportData } from './types';
import { posthog } from '@/lib/posthog';
import { safeFilename } from '@/lib/artifact-export';

interface PRDExportButtonProps {
  prd: unknown;
  productName?: string;
  className?: string;
}

type Status = 'idle' | 'generating' | 'done' | 'error';

const LABELS: Record<Status, string> = {
  idle: 'Export PDF',
  generating: 'Building…',
  done: 'PDF Ready ✓',
  error: 'Export failed',
};

export function PRDExportButton({ prd, productName, className }: PRDExportButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  async function handleClick() {
    const prdData = castToPRDExportData(prd);
    if (!prdData) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }

    setStatus('generating');
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { PRDDocument } = await import('./PRDDocument');

      const name = productName ?? prdData.product_name ?? 'prd';
      const generatedAt = new Date().toLocaleDateString();

      // React.createElement-style JSX in a dynamic import context requires createElement
      const { createElement } = await import('react');
      const element = createElement(PRDDocument, { data: prdData, generatedAt }) as import('react').ReactElement<import('@react-pdf/renderer').DocumentProps>;
      const blob = await pdf(element).toBlob();

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeFilename(name)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        posthog.capture("prd_exported_pdf");
      } finally {
        URL.revokeObjectURL(url);
      }

      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('PDF export failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }

  const isGenerating = status === 'generating';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isGenerating}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        width: '6.5rem',
        padding: '0.4rem 0.5rem',
        borderRadius: 8,
        fontSize: '0.8125rem',
        fontWeight: 500,
        background: status === 'done' ? '#f0fdf4' : '#FFFFFF',
        border: `1.5px solid ${status === 'error' ? '#fca5a5' : status === 'done' ? '#86efac' : '#E4DDD4'}`,
        color: status === 'error' ? '#dc2626' : status === 'done' ? '#16a34a' : '#6B6B6B',
        cursor: isGenerating ? 'not-allowed' : 'pointer',
        opacity: isGenerating ? 0.6 : 1,
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
      }}
    >
      {LABELS[status]}
    </button>
  );
}
