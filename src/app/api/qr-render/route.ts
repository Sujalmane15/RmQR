import { NextRequest, NextResponse } from 'next/server';
import {
  generateCustomQRSvg,
  generateQRPngBuffer,
  validateQRScanReliability,
} from '@/lib/qr/renderer';
import { DEFAULT_QR_STYLE, QRStyleConfig } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const content = (
      searchParams.get('data') ||
      searchParams.get('content') ||
      'https://rmqr.app'
    ).trim();
    const format = (searchParams.get('format') || 'png').toLowerCase();
    const size = Math.min(2048, Math.max(200, Number(searchParams.get('size')) || 512));

    if (format === 'svg') {
      const svg = generateCustomQRSvg(content, DEFAULT_QR_STYLE, size);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const pngBuffer = await generateQRPngBuffer(content, DEFAULT_QR_STYLE, size);
    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('QR GET render error:', err);
    return NextResponse.json({ error: 'Failed to render QR code.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const content = String(body.content || 'https://rmqr.app').trim();
    const style: QRStyleConfig = { ...DEFAULT_QR_STYLE, ...(body.styleConfig || {}) };
    const size = Math.min(2048, Math.max(200, Number(body.size) || 600));

    const reliability = validateQRScanReliability(style);
    const svg = generateCustomQRSvg(content, style, 512);
    const pngBuffer = await generateQRPngBuffer(content, style, size);
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return NextResponse.json({
      svg,
      pngDataUrl,
      reliability,
    });
  } catch (err) {
    console.error('QR render error:', err);
    return NextResponse.json({ error: 'Failed to render QR code.' }, { status: 500 });
  }
}
