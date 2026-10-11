import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { assertOrgAccess, AuthorizationError, readDb } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organizationId') || session.activeOrg.id;
    const qrCodeId = searchParams.get('qrCodeId') || 'all';
    const campaignId = searchParams.get('campaignId') || 'all';
    const days = parseInt(searchParams.get('days') || '30', 10);
    const excludeBots = searchParams.get('excludeBots') !== 'false';
    const format = searchParams.get('format') || 'json';

    const db = readDb();
    assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin', 'editor', 'viewer']);

    const cutoffTime =
      days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

    const allOrgEvents = db.qrScanEvents.filter((e) => {
      if (e.organizationId !== orgId) return false;
      if (cutoffTime > 0 && new Date(e.scannedAt).getTime() < cutoffTime) return false;
      if (qrCodeId !== 'all' && e.qrCodeId !== qrCodeId) return false;
      if (campaignId !== 'all' && e.campaignId !== campaignId) return false;
      return true;
    });

    const totalRawScans = allOrgEvents.length;
    const botScans = allOrgEvents.filter((e) => e.isBot).length;
    const humanScans = totalRawScans - botScans;

    const filteredEvents = excludeBots
      ? allOrgEvents.filter((e) => !e.isBot)
      : allOrgEvents;

    if (format === 'csv') {
      const qrMap = new Map(db.qrCodes.map((q) => [q.id, q.name]));
      const rows = [
        'event_id,scanned_at,qr_code_id,qr_name,is_bot,device_type,os,browser,country,region,destination_resolved',
        ...filteredEvents.map((e) =>
          [
            e.id,
            e.scannedAt,
            e.qrCodeId,
            `"${(qrMap.get(e.qrCodeId) || 'QR').replace(/"/g, '""')}"`,
            e.isBot,
            e.deviceType,
            e.os,
            e.browser,
            e.country,
            e.region,
            `"${e.destinationResolved.replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n');

      return new NextResponse(rows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="rmqr-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const uniqueVisitors = new Set(filteredEvents.map((e) => e.visitorHash)).size;

    // Group by Day
    const scansByDayMap = new Map<string, number>();
    const scansByHourMap = new Map<number, number>();
    const deviceMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const qrCountMap = new Map<string, number>();

    for (let h = 0; h < 24; h++) scansByHourMap.set(h, 0);

    for (const ev of filteredEvents) {
      const dayKey = ev.scannedAt.slice(0, 10);
      scansByDayMap.set(dayKey, (scansByDayMap.get(dayKey) || 0) + 1);

      const hourKey = new Date(ev.scannedAt).getUTCHours();
      scansByHourMap.set(hourKey, (scansByHourMap.get(hourKey) || 0) + 1);

      deviceMap.set(ev.deviceType, (deviceMap.get(ev.deviceType) || 0) + 1);
      osMap.set(ev.os, (osMap.get(ev.os) || 0) + 1);
      browserMap.set(ev.browser, (browserMap.get(ev.browser) || 0) + 1);
      countryMap.set(ev.country, (countryMap.get(ev.country) || 0) + 1);
      qrCountMap.set(ev.qrCodeId, (qrCountMap.get(ev.qrCodeId) || 0) + 1);
    }

    const scansByDay = Array.from(scansByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const scansByHour = Array.from(scansByHourMap.entries()).map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count,
    }));

    const orgQrs = db.qrCodes.filter((q) => q.organizationId === orgId);
    const qrRanking = orgQrs
      .map((q) => ({
        id: q.id,
        name: q.name,
        slug: q.slug,
        qrType: q.qrType,
        contentType: q.contentType,
        scans: qrCountMap.get(q.id) ?? 0,
        totalAllTimeScans: q.scanCount || 0,
      }))
      .sort((a, b) => b.scans - a.scans || b.totalAllTimeScans - a.totalAllTimeScans);

    const orgCampaigns = db.campaigns.filter((c) => c.organizationId === orgId);
    const campaignPerformance = orgCampaigns.map((c) => {
      const cEvents = filteredEvents.filter((e) => e.campaignId === c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        scans: cEvents.length,
        uniqueVisitors: new Set(cEvents.map((e) => e.visitorHash)).size,
      };
    });

    const mapToSortedArray = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const qrLookup = new Map(orgQrs.map((q) => [q.id, { name: q.name, slug: q.slug }]));

    return NextResponse.json({
      summary: {
        totalScans: filteredEvents.length,
        totalRawScans,
        humanScans,
        botScans,
        uniqueVisitors,
        activeQrCount: orgQrs.filter((q) => q.status === 'active').length,
      },
      scansByDay,
      scansByHour,
      qrRanking,
      campaignPerformance,
      devices: mapToSortedArray(deviceMap),
      operatingSystems: mapToSortedArray(osMap),
      browsers: mapToSortedArray(browserMap),
      countries: mapToSortedArray(countryMap),
      recentEvents: filteredEvents.slice(0, 50).map((e) => ({
        ...e,
        qrName: qrLookup.get(e.qrCodeId)?.name || 'QR Code',
        qrSlug: qrLookup.get(e.qrCodeId)?.slug || '',
      })),
      qrCodes: orgQrs.map((q) => ({ id: q.id, name: q.name, slug: q.slug })),
      campaigns: orgCampaigns.map((c) => ({ id: c.id, name: c.name })),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load analytics.' }, { status: 500 });
  }
}
