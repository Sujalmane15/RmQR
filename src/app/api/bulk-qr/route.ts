import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import JSZip from 'jszip';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  AuthorizationError,
  mutateDb,
  readDb,
} from '@/lib/db/store';
import { BULK_CSV_TEMPLATE, parseAndValidateBulkInput } from '@/lib/qr/bulk';
import { generateCustomQRSvg, generateQRPngBuffer } from '@/lib/qr/renderer';
import { DEFAULT_QR_STYLE, PLAN_ENTITLEMENTS, QRCodeRecord } from '@/lib/types';

export async function GET() {
  return new NextResponse(BULK_CSV_TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rmqr-bulk-template.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'validate'; // 'validate' | 'import' | 'zip'

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);

    // Action: Export ZIP archive of selected QR code IDs
    if (action === 'zip') {
      const qrIds: string[] = Array.isArray(body.qrIds) ? body.qrIds : [];
      const qrs = db.qrCodes.filter(
        (q) => q.organizationId === session.activeOrg.id && qrIds.includes(q.id)
      );

      if (qrs.length === 0) {
        return NextResponse.json(
          { error: 'Select at least one QR code to download as ZIP.' },
          { status: 400 }
        );
      }

      const zip = new JSZip();
      for (const qr of qrs) {
        const pngBuf = await generateQRPngBuffer(qr.encodedContent, qr.styleConfig, 600);
        const svgStr = generateCustomQRSvg(qr.encodedContent, qr.styleConfig, 512);
        zip.file(`${qr.slug}.png`, pngBuf);
        zip.file(`${qr.slug}.svg`, svgStr);
      }

      const manifestCsv = [
        'name,slug,qr_type,encoded_content,destination_url',
        ...qrs.map(
          (q) =>
            `"${q.name.replace(/"/g, '""')}",${q.slug},${q.qrType},${q.encodedContent},"${(q.destinationUrl || '').replace(/"/g, '""')}"`
        ),
      ].join('\n');
      zip.file('manifest.csv', manifestCsv);

      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      return NextResponse.json({
        fileName: `rmqr-batch-${qrs.length}-codes.zip`,
        zipBase64,
        count: qrs.length,
      });
    }

    const rawText = String(body.rawText || '');
    const mode = body.mode === 'urls' ? 'urls' : 'csv';
    const sub = db.subscriptions.find((s) => s.organizationId === session.activeOrg.id);
    const plan = PLAN_ENTITLEMENTS[sub?.planId || 'free'];

    const existingSlugs = new Set(db.qrCodes.map((q) => q.slug.toLowerCase()));
    const existingUrls = new Set(
      db.qrCodes
        .filter((q) => q.organizationId === session.activeOrg.id && q.destinationUrl)
        .map((q) => q.destinationUrl!)
    );

    const parsed = parseAndValidateBulkInput(
      rawText,
      mode,
      existingSlugs,
      existingUrls,
      plan.limits.bulkRowLimit
    );

    if (action === 'validate' || parsed.errors.length > 0) {
      return NextResponse.json(parsed, { status: parsed.errors.length > 0 ? 400 : 200 });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const createdQrs = mutateDb((state) => {
      const now = new Date().toISOString();
      const created: QRCodeRecord[] = [];

      for (const row of parsed.validRows) {
        const qrId = crypto.randomUUID();
        const encodedContent =
          row.qrType === 'dynamic' ? `${origin}/r/${row.slug}` : row.destinationUrl;

        const record: QRCodeRecord = {
          id: qrId,
          organizationId: session.activeOrg.id,
          folderId: body.folderId || null,
          campaignId: body.campaignId || null,
          name: row.name,
          description: row.description,
          slug: row.slug,
          qrType: row.qrType,
          contentType: 'url',
          status: 'active',
          encodedContent,
          destinationUrl: row.qrType === 'dynamic' ? row.destinationUrl : undefined,
          routingRules: [],
          styleConfig: { ...DEFAULT_QR_STYLE },
          tags: row.tags,
          scanCount: 0,
          humanScanCount: 0,
          lastScannedAt: null,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        };

        state.qrCodes.unshift(record);
        created.push(record);
      }

      appendAuditLog(state, {
        organizationId: session.activeOrg.id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'qr_code.bulk_created',
        entityType: 'qr_code',
        entityId: session.activeOrg.id,
        metadata: { count: created.length },
      });

      return created;
    });

    return NextResponse.json({
      createdCount: createdQrs.length,
      qrCodes: createdQrs,
      duplicateWarnings: parsed.duplicateWarnings,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Bulk QR operation failed.' }, { status: 500 });
  }
}
