// =============================================================================
// RMQR — Bulk QR Code CSV Parser, Row Validator & Duplicate Detector
// =============================================================================

import { generateShortSlug, sanitizeSlug, sanitizeText, validateSafeRedirectUrl } from '../security';

export interface BulkQRRowInput {
  rowNumber: number;
  name: string;
  destinationUrl: string;
  slug: string;
  qrType: 'static' | 'dynamic';
  tags: string[];
  description: string;
}

export interface BulkValidationError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
}

export interface BulkParseResult {
  validRows: BulkQRRowInput[];
  errors: BulkValidationError[];
  duplicateWarnings: Array<{ rowNumber: number; message: string }>;
}

export const BULK_CSV_TEMPLATE = `name,destination_url,slug,qr_type,tags,description
Table 1 Menu,https://example.com/menu?table=1,table-1-menu,dynamic,"menu,table-1",Front patio table 1
Table 2 Menu,https://example.com/menu?table=2,table-2-menu,dynamic,"menu,table-2",Front patio table 2
Google Review Standee,https://search.google.com/local/writereview,review-standee-main,dynamic,"reviews,counter",Checkout counter standee
Free Guest WiFi,https://example.com/wifi,guest-wifi-card,static,"wifi,lobby",Static lobby card`;

/**
 * RFC-4180 compliant single CSV line splitter supporting quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses and validates either a CSV string or a list of pasted URLs.
 * Performs row-level URL validation and duplicate slug/URL detection.
 */
export function parseAndValidateBulkInput(
  rawText: string,
  mode: 'csv' | 'urls',
  existingSlugs: Set<string>,
  existingUrls: Set<string>,
  maxRows = 100
): BulkParseResult {
  const validRows: BulkQRRowInput[] = [];
  const errors: BulkValidationError[] = [];
  const duplicateWarnings: Array<{ rowNumber: number; message: string }> = [];

  const seenSlugsInBatch = new Set<string>();
  const seenUrlsInBatch = new Set<string>();

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    errors.push({ rowNumber: 1, field: 'input', message: 'No rows provided to import.' });
    return { validRows, errors, duplicateWarnings };
  }

  let dataLines = lines;
  if (mode === 'csv' && lines[0].toLowerCase().includes('destination_url')) {
    dataLines = lines.slice(1);
  }

  if (dataLines.length > maxRows) {
    errors.push({
      rowNumber: maxRows + 1,
      field: 'limit',
      message: `Batch exceeds maximum limit of ${maxRows} rows per operation (${dataLines.length} provided).`,
    });
    return { validRows, errors, duplicateWarnings };
  }

  dataLines.forEach((line, idx) => {
    const rowNumber = mode === 'csv' && lines.length !== dataLines.length ? idx + 2 : idx + 1;

    let name = '';
    let destinationUrl = '';
    let rawSlug = '';
    let qrType: 'static' | 'dynamic' = 'dynamic';
    let tags: string[] = [];
    let description = '';

    if (mode === 'urls') {
      destinationUrl = line;
      try {
        const parsed = new URL(destinationUrl);
        name = `QR - ${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`.slice(0, 60);
      } catch {
        name = `Bulk QR #${rowNumber}`;
      }
      rawSlug = generateShortSlug(`bulk-${rowNumber}`);
    } else {
      const cols = parseCsvLine(line);
      name = sanitizeText(cols[0] || '', 80);
      destinationUrl = (cols[1] || '').trim();
      rawSlug = sanitizeSlug(cols[2] || '') || generateShortSlug(name || `qr-${rowNumber}`);
      const typeCol = (cols[3] || 'dynamic').toLowerCase().trim();
      if (typeCol === 'static' || typeCol === 'dynamic') {
        qrType = typeCol;
      } else {
        errors.push({
          rowNumber,
          field: 'qr_type',
          message: `Invalid qr_type "${cols[3]}". Must be "static" or "dynamic".`,
          rawValue: cols[3],
        });
        return;
      }
      tags = (cols[4] || '')
        .split(',')
        .map((t) => sanitizeText(t, 24))
        .filter(Boolean);
      description = sanitizeText(cols[5] || '', 240);
    }

    if (!name) {
      errors.push({
        rowNumber,
        field: 'name',
        message: 'QR name is required.',
      });
      return;
    }

    const urlCheck = validateSafeRedirectUrl(destinationUrl);
    if (!urlCheck.valid || !urlCheck.sanitizedUrl) {
      errors.push({
        rowNumber,
        field: 'destination_url',
        message: urlCheck.reason || 'Invalid destination URL.',
        rawValue: destinationUrl,
      });
      return;
    }

    const finalUrl = urlCheck.sanitizedUrl;
    let finalSlug = sanitizeSlug(rawSlug);
    if (!finalSlug) {
      finalSlug = generateShortSlug('qr');
    }

    if (existingSlugs.has(finalSlug) || seenSlugsInBatch.has(finalSlug)) {
      duplicateWarnings.push({
        rowNumber,
        message: `Slug "${finalSlug}" already exists; a unique suffix was automatically appended.`,
      });
      finalSlug = generateShortSlug(finalSlug);
    }

    if (existingUrls.has(finalUrl) || seenUrlsInBatch.has(finalUrl)) {
      duplicateWarnings.push({
        rowNumber,
        message: `Destination URL "${finalUrl}" duplicates an existing or earlier row.`,
      });
    }

    seenSlugsInBatch.add(finalSlug);
    seenUrlsInBatch.add(finalUrl);

    validRows.push({
      rowNumber,
      name,
      destinationUrl: finalUrl,
      slug: finalSlug,
      qrType,
      tags,
      description,
    });
  });

  return { validRows, errors, duplicateWarnings };
}
