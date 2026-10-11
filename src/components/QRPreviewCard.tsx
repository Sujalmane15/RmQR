'use client';

import React, { useMemo, useState } from 'react';
import {
  generateCustomQRSvg,
  generateQRPngDataUrl,
  validateQRScanReliability,
} from '@/lib/qr/renderer';
import { DEFAULT_QR_STYLE, QRStyleConfig } from '@/lib/types';
import {
  Download,
  FileCode2,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface QRPreviewCardProps {
  content: string;
  name?: string;
  styleConfig?: Partial<QRStyleConfig>;
  size?: number;
  showExportButtons?: boolean;
  showReliabilityReport?: boolean;
}

export function QRPreviewCard({
  content,
  name = 'rmqr-code',
  styleConfig,
  size = 260,
  showExportButtons = true,
  showReliabilityReport = true,
}: QRPreviewCardProps) {
  const [exporting, setExporting] = useState<'png' | 'svg' | 'pdf' | null>(null);
  const [exportResolution, setExportResolution] = useState<number>(1200);

  const mergedStyle: QRStyleConfig = useMemo(
    () => ({ ...DEFAULT_QR_STYLE, ...(styleConfig || {}) }),
    [styleConfig]
  );

  const svgMarkup = useMemo(
    () => generateCustomQRSvg(content || 'https://rmqr.app', mergedStyle, 512),
    [content, mergedStyle]
  );

  const reliability = useMemo(
    () => validateQRScanReliability(mergedStyle),
    [mergedStyle]
  );

  const cleanFileName = (name || 'rmqr-code')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');

  const handleDownloadSvg = () => {
    setExporting('svg');
    try {
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanFileName}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPng = async () => {
    setExporting('png');
    try {
      const pngDataUrl = await generateQRPngDataUrl(
        content || 'https://rmqr.app',
        mergedStyle,
        exportResolution
      );
      const a = document.createElement('a');
      a.href = pngDataUrl;
      a.download = `${cleanFileName}-${exportResolution}px.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting('pdf');
    try {
      const pngDataUrl = await generateQRPngDataUrl(
        content || 'https://rmqr.app',
        mergedStyle,
        1200
      );
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Branded print standee layout
      doc.setFillColor(11, 15, 25);
      doc.rect(0, 0, 210, 42, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text(name || 'RMQR Smart Code', 105, 22, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(167, 139, 250);
      doc.text('Print-Ready High Resolution QR Sheet — RMQR Platform', 105, 31, {
        align: 'center',
      });

      // QR image centered on A4 sheet
      doc.addImage(pngDataUrl, 'PNG', 45, 62, 120, 120);

      if (mergedStyle.frameStyle !== 'none' && mergedStyle.frameText) {
        doc.setFillColor(124, 58, 237);
        doc.roundedRect(55, 190, 100, 16, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.text(mergedStyle.frameText, 105, 200.5, { align: 'center' });
      }

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.text(`Encoded target: ${(content || '').slice(0, 90)}`, 105, 275, {
        align: 'center',
      });

      doc.save(`${cleanFileName}-print.pdf`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm">
      <div
        className="flex items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 shadow-inner"
        style={{ width: size + 32, minHeight: size + 32 }}
        data-testid="qr-live-preview"
      >
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:rounded-xl"
          style={{ maxWidth: size }}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>

      {showReliabilityReport && (
        <div className="mt-4 w-full space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Scan Reliability &amp; Contrast
            </span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                reliability.isReliable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {reliability.isReliable ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {reliability.contrastRatio}:1 Pass
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {reliability.contrastRatio}:1 Low Contrast
                </>
              )}
            </span>
          </div>

          {reliability.warnings.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1"
            >
              {reliability.warnings.map((w, idx) => (
                <p key={idx} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {showExportButtons && (
        <div className="mt-4 w-full space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor={`res-select-${cleanFileName}`}
              className="text-slate-500 dark:text-slate-400 font-medium"
            >
              Print Resolution:
            </label>
            <select
              id={`res-select-${cleanFileName}`}
              value={exportResolution}
              onChange={(e) => setExportResolution(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value={600}>Standard Web (600×600 px)</option>
              <option value={1200}>High-Res Print (1200×1200 px)</option>
              <option value={2048}>Ultra Print Poster (2048×2048 px)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={exporting !== null}
              data-testid="download-png-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={exporting !== null}
              data-testid="download-svg-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors disabled:opacity-50"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              SVG
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exporting !== null}
              data-testid="download-pdf-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
