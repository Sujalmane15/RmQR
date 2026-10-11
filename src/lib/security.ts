// =============================================================================
// RMQR — Security, Safe URL Validation, Privacy Telemetry & Rate Limiting
// =============================================================================

import crypto from 'crypto';

const DANGEROUS_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
];

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  reason?: string;
}

/**
 * Validates a QR redirect destination URL on the server to prevent open redirects
 * to dangerous schemes (javascript:, data:, vbscript:, file:) or malformed targets.
 */
export function validateSafeRedirectUrl(rawUrl: string | undefined | null): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'Destination URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Destination URL cannot be empty.' };
  }

  // Block control characters or embedded newlines (CRLF injection prevention)
  if (/[\r\n\0]/.test(trimmed)) {
    return { valid: false, reason: 'URL contains invalid control characters.' };
  }

  const lower = trimmed.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { valid: false, reason: `Unsafe URL scheme "${scheme}" is blocked for security.` };
    }
  }

  // Allow internal application relative routes (/p/[slug], /m/[slug], /review/[slug], /agent/[slug])
  if (
    trimmed.startsWith('/p/') ||
    trimmed.startsWith('/m/') ||
    trimmed.startsWith('/review/') ||
    trimmed.startsWith('/agent/')
  ) {
    return { valid: true, sanitizedUrl: trimmed };
  }

  // Disallow protocol-relative open redirects like //evil.com
  if (trimmed.startsWith('//')) {
    return { valid: false, reason: 'Protocol-relative URLs are not allowed.' };
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'sms:'];
    if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
      return {
        valid: false,
        reason: `Protocol "${parsed.protocol}" is not permitted for redirects.`,
      };
    }
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) {
      return { valid: false, reason: 'Valid hostname is required.' };
    }
    return { valid: true, sanitizedUrl: parsed.toString() };
  } catch {
    return { valid: false, reason: 'Malformed URL. Include https:// or http://.' };
  }
}

/**
 * Sanitizes plain text input by stripping HTML tags and script vectors.
 */
export function sanitizeText(input: string | undefined | null, maxLength = 2000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalizes and validates a URL slug.
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/**
 * Generates a unique short slug if none is provided.
 */
export function generateShortSlug(prefix = ''): string {
  const randomPart = crypto.randomBytes(4).toString('hex').slice(0, 7);
  return prefix ? `${sanitizeSlug(prefix)}-${randomPart}` : randomPart;
}

/**
 * Hashes a password securely using PBKDF2-SHA256 with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored PBKDF2 salt:hash string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const candidateHash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(originalHash, 'hex'),
      Buffer.from(candidateHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Computes a privacy-conscious daily rotating visitor hash.
 * Raw IP addresses are NEVER persisted to the database.
 */
export function computeVisitorHash(ipHeader: string | null, userAgent: string | null): string {
  const dayBucket = new Date().toISOString().slice(0, 10); // Rotates every 24h
  // Truncate IP to subnet before hashing for additional privacy protection
  const anonymizedIp = (ipHeader || '0.0.0.0')
    .split(',')[0]
    .trim()
    .replace(/\.\d+$/, '.0');
  const raw = `${dayBucket}|${anonymizedIp}|${(userAgent || 'unknown').slice(0, 120)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

export interface ParsedClientTelemetry {
  isBot: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'other';
  os: string;
  browser: string;
}

const BOT_PATTERNS =
  /bot|crawler|spider|slurp|whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|pinterest|preview|curl|wget|python-requests|axios|go-http-client|headlesschrome|lighthouse/i;

/**
 * Parses User-Agent to separate estimated human scans from bot/crawler/preview-fetcher hits
 * and detect device category, operating system, and browser.
 */
export function parseUserAgent(uaString: string | null | undefined): ParsedClientTelemetry {
  const ua = uaString || '';
  if (!ua) {
    return { isBot: false, deviceType: 'other', os: 'Unknown', browser: 'Unknown' };
  }

  const isBot = BOT_PATTERNS.test(ua);

  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'other' = 'desktop';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated/i.test(ua)) {
    deviceType = 'mobile';
  }

  let os = 'Other';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\/|crios\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\/|fxios\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';

  return { isBot, deviceType, os, browser };
}

// In-memory sliding window rate limiter
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}
