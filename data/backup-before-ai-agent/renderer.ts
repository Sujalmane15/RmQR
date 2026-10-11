// =============================================================================
// RMQR — QR Code Matrix Renderer, Content Formatter & Reliability Validator
// =============================================================================

import QRCode from 'qrcode';
import { DEFAULT_QR_STYLE, QRContentType, QRStyleConfig } from '../types';

export interface QRContentInput {
  contentType: QRContentType;
  url?: string;
  text?: string;
  email?: string;
  emailSubject?: string;
  emailBody?: string;
  phone?: string;
  smsMessage?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiEncryption?: 'WPA' | 'WEP' | 'nopass';
  wifiHidden?: boolean;
  vcardFirstName?: string;
  vcardLastName?: string;
  vcardOrg?: string;
  vcardTitle?: string;
  vcardPhone?: string;
  vcardEmail?: string;
  vcardWebsite?: string;
  vcardAddress?: string;
  latitude?: string;
  longitude?: string;
  locationQuery?: string;
  googleReviewUrl?: string;
  menuUrl?: string;
  socialUrl?: string;
  fileUrl?: string;
  landingPageUrl?: string;
}

/**
 * Formats any of the 14 supported QR content types into a standard scannable payload.
 */
export function formatQRContentPayload(input: QRContentInput): string {
  switch (input.contentType) {
    case 'url':
      return (input.url || 'https://example.com').trim();

    case 'text':
      return (input.text || 'Hello from RMQR').trim();

    case 'email': {
      const addr = (input.email || 'hello@example.com').trim();
      const params = new URLSearchParams();
      if (input.emailSubject) params.set('subject', input.emailSubject);
      if (input.emailBody) params.set('body', input.emailBody);
      const qs = params.toString();
      return qs ? `mailto:${addr}?${qs}` : `mailto:${addr}`;
    }

    case 'phone': {
      const cleaned = (input.phone || '+1234567890').replace(/[^\d+]/g, '');
      return `tel:${cleaned}`;
    }

    case 'sms': {
      const cleaned = (input.phone || '+1234567890').replace(/[^\d+]/g, '');
      const msg = input.smsMessage ? `:${input.smsMessage}` : '';
      return `SMSTO:${cleaned}${msg}`;
    }

    case 'whatsapp': {
      const num = (input.whatsappNumber || input.phone || '919876543210').replace(/[^\d]/g, '');
      const textParam = input.whatsappMessage
        ? `?text=${encodeURIComponent(input.whatsappMessage)}`
        : '';
      return `https://wa.me/${num}${textParam}`;
    }

    case 'wifi': {
      const ssid = (input.wifiSsid || 'GuestWiFi').replace(/[\\;,:]/g, '\\$&');
      const pass = (input.wifiPassword || '').replace(/[\\;,:]/g, '\\$&');
      const enc = input.wifiEncryption || 'WPA';
      const hidden = input.wifiHidden ? 'true' : 'false';
      return `WIFI:T:${enc};S:${ssid};P:${pass};H:${hidden};;`;
    }

    case 'vcard': {
      const fn = (input.vcardFirstName || 'Jane').trim();
      const ln = (input.vcardLastName || 'Doe').trim();
      const fullName = `${fn} ${ln}`.trim();
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${ln};${fn};;;`,
        `FN:${fullName}`,
      ];
      if (input.vcardOrg) lines.push(`ORG:${input.vcardOrg}`);
      if (input.vcardTitle) lines.push(`TITLE:${input.vcardTitle}`);
      if (input.vcardPhone) lines.push(`TEL;TYPE=CELL:${input.vcardPhone}`);
      if (input.vcardEmail) lines.push(`EMAIL:${input.vcardEmail}`);
      if (input.vcardWebsite) lines.push(`URL:${input.vcardWebsite}`);
      if (input.vcardAddress) lines.push(`ADR;TYPE=WORK:;;${input.vcardAddress};;;;`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }

    case 'location': {
      if (input.latitude && input.longitude) {
        return `https://maps.google.com/?q=${input.latitude.trim()},${input.longitude.trim()}`;
      }
      const q = encodeURIComponent(input.locationQuery || 'Mumbai, India');
      return `https://maps.google.com/?q=${q}`;
    }

    case 'google_review':
      return (input.googleReviewUrl || input.url || 'https://search.google.com/local/writereview').trim();

    case 'menu':
      return (input.menuUrl || input.url || 'https://example.com/menu').trim();

    case 'social':
      return (input.socialUrl || input.url || 'https://instagram.com').trim();

    case 'file':
      return (input.fileUrl || input.url || 'https://example.com/document.pdf').trim();

    case 'landing_page':
      return (input.landingPageUrl || input.url || 'https://example.com/page').trim();

    default:
      return (input.url || 'https://example.com').trim();
  }
}

export interface QRReliabilityReport {
  isReliable: boolean;
  contrastRatio: number;
  warnings: string[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Validates color contrast, quiet-zone margin, inversion, and logo size ratio
 * to warn users when styling choices could reduce scan reliability.
 */
export function validateQRScanReliability(style: Partial<QRStyleConfig>): QRReliabilityReport {
  const merged: QRStyleConfig = { ...DEFAULT_QR_STYLE, ...style };
  const warnings: string[] = [];

  const fgLum = getRelativeLuminance(merged.fgColor);
  const bgLum = getRelativeLuminance(merged.bgColor);

  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  const contrastRatio = Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));

  if (fgLum > bgLum) {
    warnings.push(
      'Inverted colors detected (foreground is lighter than background). Many phone cameras fail to scan inverted QR codes.'
    );
  }

  if (contrastRatio < 3.0) {
    warnings.push(
      `Low color contrast (${contrastRatio}:1). A minimum contrast ratio of 4.5:1 between foreground and background is strongly recommended.`
    );
  } else if (contrastRatio < 4.5) {
    warnings.push(
      `Moderate contrast (${contrastRatio}:1). High contrast (>= 4.5:1) improves scanning in dim restaurant or outdoor lighting.`
    );
  }

  if (merged.margin < 2) {
    warnings.push(
      'Quiet zone margin is below 2 modules. Scanners require a clear border around the QR matrix to detect finder patterns.'
    );
  }

  if (merged.logoDataUrl && (merged.logoSizeRatio || 0.2) > 0.24 && merged.errorCorrectionLevel !== 'H') {
    warnings.push(
      'Oversized center logo detected. Error correction should be set to High (H) or logo size reduced below 24% to prevent scan failure.'
    );
  }

  return {
    isReliable: contrastRatio >= 3.0 && fgLum < bgLum && merged.margin >= 2,
    contrastRatio,
    warnings,
  };
}

function isFinderPattern(row: number, col: number, matrixSize: number): boolean {
  // Top-left 7x7
  if (row < 7 && col < 7) return true;
  // Top-right 7x7
  if (row < 7 && col >= matrixSize - 7) return true;
  // Bottom-left 7x7
  if (row >= matrixSize - 7 && col < 7) return true;
  return false;
}

function renderFinderEyeSvg(
  x: number,
  y: number,
  cellSize: number,
  eyeStyle: QRStyleConfig['eyeStyle'],
  color: string,
  bgColor: string
): string {
  const outerSize = 7 * cellSize;
  const innerOffset = 1 * cellSize;
  const innerSize = 5 * cellSize;
  const coreOffset = 2 * cellSize;
  const coreSize = 3 * cellSize;

  if (eyeStyle === 'circle') {
    const cx = x + outerSize / 2;
    const cy = y + outerSize / 2;
    return `
      <circle cx="${cx}" cy="${cy}" r="${outerSize / 2}" fill="${color}" />
      <circle cx="${cx}" cy="${cy}" r="${innerSize / 2}" fill="${bgColor}" />
      <circle cx="${cx}" cy="${cy}" r="${coreSize / 2}" fill="${color}" />
    `;
  }

  const outerRx = eyeStyle === 'rounded' ? cellSize * 1.6 : 0;
  const innerRx = eyeStyle === 'rounded' ? cellSize * 1.1 : 0;
  const coreRx = eyeStyle === 'rounded' ? cellSize * 0.7 : 0;

  return `
    <rect x="${x}" y="${y}" width="${outerSize}" height="${outerSize}" rx="${outerRx}" fill="${color}" />
    <rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" rx="${innerRx}" fill="${bgColor}" />
    <rect x="${x + coreOffset}" y="${y + coreOffset}" width="${coreSize}" height="${coreSize}" rx="${coreRx}" fill="${color}" />
  `;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a customizable, standards-compliant SVG string for a QR code with support for:
 * - Custom module patterns (square, dots, rounded, classy)
 * - Custom finder eye styles (square, rounded, circle) & colors
 * - Optional center logo cutout & overlay
 * - Optional decorative frame & call-to-action label
 */
export function generateCustomQRSvg(
  content: string,
  styleInput?: Partial<QRStyleConfig>,
  sizePx = 512
): string {
  const style: QRStyleConfig = { ...DEFAULT_QR_STYLE, ...styleInput };
  const payload = content.trim() || 'https://rmqr.app';

  // Automatically upgrade error correction to 'H' when a center logo is used
  const ecl = style.logoDataUrl ? 'H' : style.errorCorrectionLevel || 'M';
  const qr = QRCode.create(payload, { errorCorrectionLevel: ecl });
  const matrixSize = qr.modules.size;
  const data = qr.modules.data;

  const marginModules = Math.max(1, style.margin ?? 4);
  const totalModules = matrixSize + marginModules * 2;
  const hasFrame = style.frameStyle && style.frameStyle !== 'none';
  const frameHeightPx = hasFrame ? Math.round(sizePx * 0.16) : 0;
  const svgWidth = sizePx;
  const svgHeight = sizePx + frameHeightPx;

  const cellSize = sizePx / totalModules;
  const offset = marginModules * cellSize;
  const eyeColor = style.eyeColor || style.fgColor;
  const frameColor = style.frameColor || style.fgColor;

  // Determine center logo exclusion zone if logo is present
  const logoRatio = Math.min(0.26, Math.max(0.12, style.logoSizeRatio || 0.2));
  const logoModules = style.logoDataUrl ? Math.ceil(matrixSize * logoRatio) : 0;
  const logoStartMod = Math.floor((matrixSize - logoModules) / 2);
  const logoEndMod = logoStartMod + logoModules;

  const elements: string[] = [];

  // Background & optional frame wrapper
  const topOffset = style.frameStyle === 'banner_top' ? frameHeightPx : 0;

  if (hasFrame) {
    elements.push(
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="24" fill="${frameColor}" />`
    );
    elements.push(
      `<rect x="8" y="${topOffset + 8}" width="${sizePx - 16}" height="${sizePx - 16}" rx="18" fill="${style.bgColor}" />`
    );
  } else {
    elements.push(
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${style.bgColor}" />`
    );
  }

  // Render the 3 Finder Eyes
  elements.push(
    renderFinderEyeSvg(offset, topOffset + offset, cellSize, style.eyeStyle, eyeColor, style.bgColor),
    renderFinderEyeSvg(
      offset + (matrixSize - 7) * cellSize,
      topOffset + offset,
      cellSize,
      style.eyeStyle,
      eyeColor,
      style.bgColor
    ),
    renderFinderEyeSvg(
      offset,
      topOffset + offset + (matrixSize - 7) * cellSize,
      cellSize,
      style.eyeStyle,
      eyeColor,
      style.bgColor
    )
  );

  // Render data modules
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (isFinderPattern(r, c, matrixSize)) continue;
      if (
        style.logoDataUrl &&
        r >= logoStartMod &&
        r < logoEndMod &&
        c >= logoStartMod &&
        c < logoEndMod
      ) {
        continue;
      }

      const isDark = data[r * matrixSize + c] === 1;
      if (!isDark) continue;

      const x = offset + c * cellSize;
      const y = topOffset + offset + r * cellSize;

      if (style.pattern === 'dots') {
        const radius = cellSize * 0.44;
        elements.push(
          `<circle cx="${(x + cellSize / 2).toFixed(2)}" cy="${(y + cellSize / 2).toFixed(2)}" r="${radius.toFixed(2)}" fill="${style.fgColor}" />`
        );
      } else if (style.pattern === 'rounded') {
        const rx = cellSize * 0.32;
        elements.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${style.fgColor}" />`
        );
      } else if (style.pattern === 'classy') {
        const rx = (r + c) % 2 === 0 ? cellSize * 0.38 : cellSize * 0.12;
        elements.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${style.fgColor}" />`
        );
      } else {
        // Default crisp square
        elements.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(cellSize + 0.35).toFixed(2)}" height="${(cellSize + 0.35).toFixed(2)}" fill="${style.fgColor}" />`
        );
      }
    }
  }

  // Render Center Logo if configured
  if (style.logoDataUrl) {
    const logoPx = logoModules * cellSize;
    const lx = offset + logoStartMod * cellSize;
    const ly = topOffset + offset + logoStartMod * cellSize;
    elements.push(
      `<rect x="${(lx - 4).toFixed(2)}" y="${(ly - 4).toFixed(2)}" width="${(logoPx + 8).toFixed(2)}" height="${(logoPx + 8).toFixed(2)}" rx="10" fill="${style.bgColor}" />`,
      `<image href="${escapeXml(style.logoDataUrl)}" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" width="${logoPx.toFixed(2)}" height="${logoPx.toFixed(2)}" preserveAspectRatio="xMidYMid meet" />`
    );
  }

  // Render Frame CTA Text
  if (hasFrame) {
    const cta = escapeXml((style.frameText || 'SCAN ME').slice(0, 32));
    const textY =
      style.frameStyle === 'banner_top'
        ? Math.round(frameHeightPx * 0.62)
        : Math.round(sizePx + frameHeightPx * 0.58);
    const fontSize = Math.round(sizePx * 0.055);
    elements.push(
      `<text x="${svgWidth / 2}" y="${textY}" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="1.5">${cta}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">${elements.join('')}</svg>`;
}

/**
 * Generates a high-resolution PNG Data URL on the server or client.
 * Uses standard QRCode.toDataURL for guaranteed decoder compatibility.
 */
export async function generateQRPngDataUrl(
  content: string,
  styleInput?: Partial<QRStyleConfig>,
  width = 600
): Promise<string> {
  const style: QRStyleConfig = { ...DEFAULT_QR_STYLE, ...styleInput };
  const payload = content.trim() || 'https://rmqr.app';
  const ecl = style.logoDataUrl ? 'H' : style.errorCorrectionLevel || 'M';

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: ecl,
    margin: Math.max(1, style.margin ?? 4),
    width,
    color: {
      dark: style.fgColor || '#0B0F19',
      light: style.bgColor || '#FFFFFF',
    },
  });
}

/**
 * Generates a raw PNG Buffer on the server (used for ZIP bulk export and automated jsqr tests).
 */
export async function generateQRPngBuffer(
  content: string,
  styleInput?: Partial<QRStyleConfig>,
  width = 600
): Promise<Buffer> {
  const style: QRStyleConfig = { ...DEFAULT_QR_STYLE, ...styleInput };
  const payload = content.trim() || 'https://rmqr.app';
  const ecl = style.logoDataUrl ? 'H' : style.errorCorrectionLevel || 'M';

  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: ecl,
    margin: Math.max(1, style.margin ?? 4),
    width,
    color: {
      dark: style.fgColor || '#0B0F19',
      light: style.bgColor || '#FFFFFF',
    },
  });
}
