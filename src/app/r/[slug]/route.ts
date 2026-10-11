import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mutateDb, readDb } from '@/lib/db/store';
import {
  checkRateLimit,
  computeVisitorHash,
  parseUserAgent,
  validateSafeRedirectUrl,
  verifyPassword,
} from '@/lib/security';

function renderStatusHtmlPage(params: {
  title: string;
  badge: string;
  message: string;
  slug: string;
  showPasswordForm?: boolean;
  passwordError?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title} — RMQR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0B0F19;
      color: #F9FAFB;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #111827;
      border: 1px solid rgba(124, 58, 237, 0.3);
      border-radius: 20px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(124, 58, 237, 0.18);
      color: #A78BFA;
      border: 1px solid rgba(124, 58, 237, 0.4);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; color: #FFFFFF; }
    p { font-size: 15px; line-height: 1.6; color: #9CA3AF; margin-bottom: 24px; }
    .slug { font-family: monospace; color: #E5E7EB; background: #1F2937; padding: 3px 8px; border-radius: 6px; }
    .btn {
      display: inline-block;
      background: #7C3AED;
      color: #FFFFFF;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      border: none;
      cursor: pointer;
      width: 100%;
    }
    .btn:hover { background: #6D28D9; }
    input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid #374151;
      background: #0B0F19;
      color: #FFFFFF;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .err { color: #F87171; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">${params.badge}</span>
    <h1>${params.title}</h1>
    <p>${params.message}</p>
    ${
      params.showPasswordForm
        ? `<form method="POST" action="/r/${encodeURIComponent(params.slug)}">
            ${params.passwordError ? `<div class="err">${params.passwordError}</div>` : ''}
            <input type="password" name="password" placeholder="Enter QR access password" required autofocus />
            <button type="submit" class="btn">Unlock Destination</button>
          </form>`
        : `<a href="/" class="btn">Powered by RMQR Platform</a>`
    }
  </main>
</body>
</html>`;
}

async function handleRedirectRequest(
  req: NextRequest,
  slug: string,
  submittedPassword?: string
): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = checkRateLimit(`redirect:${ip}`, 180, 60_000);
  if (!rl.allowed) {
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'Rate Limit Exceeded',
        badge: '429 Too Many Scans',
        message: 'Too many scan requests from this network in a short time. Please try again shortly.',
        slug,
      }),
      { status: 429, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const db = readDb();
  const qr = db.qrCodes.find((q) => q.slug.toLowerCase() === slug.toLowerCase());

  if (!qr) {
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'QR Code Not Found',
        badge: '404 Missing Link',
        message: `No active QR code was found for slug "${slug}". Verify the printed code or contact the business owner.`,
        slug,
      }),
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const org = db.organizations.find((o) => o.id === qr.organizationId);
  if (org?.status === 'suspended') {
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'QR Code Temporarily Unavailable',
        badge: 'Account Suspended',
        message: 'The workspace managing this QR code is currently suspended.',
        slug,
      }),
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Check Paused or Archived state
  if (qr.status === 'paused' || qr.status === 'archived') {
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'QR Code Paused',
        badge: 'Paused by Owner',
        message: 'This dynamic QR code has been temporarily paused by its owner and is not redirecting right now.',
        slug,
      }),
      { status: 423, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Check Expiration state or expiresAt timestamp
  const isPastExpiry =
    qr.status === 'expired' ||
    (qr.expiresAt && new Date(qr.expiresAt).getTime() <= Date.now());

  if (isPastExpiry) {
    // If a valid fallback URL is configured on an expired QR, redirect there safely
    if (qr.fallbackUrl) {
      const fbCheck = validateSafeRedirectUrl(qr.fallbackUrl);
      if (fbCheck.valid && fbCheck.sanitizedUrl) {
        const target = fbCheck.sanitizedUrl.startsWith('/')
          ? new URL(fbCheck.sanitizedUrl, req.url).toString()
          : fbCheck.sanitizedUrl;
        return NextResponse.redirect(target, { status: 307 });
      }
    }
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'QR Code Expired',
        badge: '410 Expired',
        message: 'This campaign or QR code has reached its expiration date and is no longer active.',
        slug,
      }),
      { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Check Optional Password Protection
  if (qr.passwordHash) {
    if (!submittedPassword) {
      return new NextResponse(
        renderStatusHtmlPage({
          title: 'Password Protected QR',
          badge: 'Protected Link',
          message: 'Please enter the access password to continue to the destination.',
          slug,
          showPasswordForm: true,
        }),
        { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    if (!verifyPassword(submittedPassword, qr.passwordHash)) {
      return new NextResponse(
        renderStatusHtmlPage({
          title: 'Password Protected QR',
          badge: 'Protected Link',
          message: 'Please enter the access password to continue to the destination.',
          slug,
          showPasswordForm: true,
          passwordError: 'Incorrect password. Please try again.',
        }),
        { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }

  // Parse User-Agent for bot detection and device-based smart routing
  const ua = req.headers.get('user-agent');
  const telemetry = parseUserAgent(ua);

  let rawTarget = qr.destinationUrl || qr.encodedContent;

  // Check device-specific routing rules if present
  if (Array.isArray(qr.routingRules) && qr.routingRules.length > 0) {
    for (const rule of qr.routingRules) {
      if (rule.type === 'device') {
        const cond = rule.condition.toLowerCase();
        if (
          (cond === 'ios' && telemetry.os === 'iOS') ||
          (cond === 'android' && telemetry.os === 'Android') ||
          (cond === 'desktop' && telemetry.deviceType === 'desktop')
        ) {
          rawTarget = rule.destinationUrl;
          break;
        }
      }
    }
  }

  // Append campaign UTM parameters if associated with an active campaign
  const campaign = qr.campaignId
    ? db.campaigns.find((c) => c.id === qr.campaignId)
    : undefined;

  // Validate destination URL safety (prevent open redirect / javascript: schemes)
  const urlValidation = validateSafeRedirectUrl(rawTarget);
  if (!urlValidation.valid || !urlValidation.sanitizedUrl) {
    return new NextResponse(
      renderStatusHtmlPage({
        title: 'Unsafe or Invalid Destination Blocked',
        badge: 'Security Policy',
        message: 'The configured destination URL did not pass RMQR safety validation.',
        slug,
      }),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  let finalTargetUrl = urlValidation.sanitizedUrl.startsWith('/')
    ? new URL(urlValidation.sanitizedUrl, req.url).toString()
    : urlValidation.sanitizedUrl;

  if (campaign && (finalTargetUrl.startsWith('http://') || finalTargetUrl.startsWith('https://'))) {
    try {
      const u = new URL(finalTargetUrl);
      if (campaign.utmSource && !u.searchParams.has('utm_source')) {
        u.searchParams.set('utm_source', campaign.utmSource);
      }
      if (campaign.utmMedium && !u.searchParams.has('utm_medium')) {
        u.searchParams.set('utm_medium', campaign.utmMedium);
      }
      if (campaign.utmCampaign && !u.searchParams.has('utm_campaign')) {
        u.searchParams.set('utm_campaign', campaign.utmCampaign);
      }
      finalTargetUrl = u.toString();
    } catch {
      // Keep sanitized target URL if UTM append fails
    }
  }

  // Derive country/region only from standard edge geo headers when available
  const country =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    'IN';
  const region = req.headers.get('x-vercel-ip-country-region') || 'MH';
  const referrer = (req.headers.get('referer') || 'Direct QR Scan').slice(0, 200);
  const visitorHash = computeVisitorHash(ip, ua);
  const now = new Date().toISOString();

  // Persist scan event in the database
  mutateDb((state) => {
    const targetQr = state.qrCodes.find((q) => q.id === qr.id);
    if (targetQr) {
      targetQr.scanCount = (targetQr.scanCount || 0) + 1;
      if (!telemetry.isBot) {
        targetQr.humanScanCount = (targetQr.humanScanCount || 0) + 1;
      }
      targetQr.lastScannedAt = now;
    }

    state.qrScanEvents.unshift({
      id: crypto.randomUUID(),
      qrCodeId: qr.id,
      organizationId: qr.organizationId,
      campaignId: qr.campaignId || null,
      scannedAt: now,
      visitorHash,
      isBot: telemetry.isBot,
      deviceType: telemetry.deviceType,
      os: telemetry.os,
      browser: telemetry.browser,
      country,
      region,
      referrer,
      destinationResolved: finalTargetUrl,
    });
  });

  // Use 307 Temporary Redirect with no-store cache headers so editing the destination
  // takes effect immediately on the same printed QR code!
  const response = NextResponse.redirect(finalTargetUrl, { status: 307 });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  return handleRedirectRequest(req, slug);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  let password = '';
  try {
    const formData = await req.formData();
    password = String(formData.get('password') || '');
  } catch {
    // Ignore malformed form data
  }
  return handleRedirectRequest(req, slug, password);
}
