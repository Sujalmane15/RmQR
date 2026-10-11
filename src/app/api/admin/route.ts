import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db/store';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: System Administrator privileges required.' },
        { status: 403 }
      );
    }

    const db = readDb();

    const organizations = db.organizations.map((org) => {
      const sub = db.subscriptions.find((s) => s.organizationId === org.id);
      const qrCount = db.qrCodes.filter((q) => q.organizationId === org.id).length;
      const scanCount = db.qrScanEvents.filter((e) => e.organizationId === org.id).length;
      const memberCount = db.organizationMembers.filter(
        (m) => m.organizationId === org.id
      ).length;
      return {
        ...org,
        planId: sub?.planId || 'free',
        subscriptionStatus: sub?.status || 'active',
        qrCount,
        scanCount,
        memberCount,
      };
    });

    const users = db.profiles.map(({ passwordHash: _omitted, ...u }) => {
      void _omitted;
      return u;
    });

    return NextResponse.json({
      summary: {
        totalUsers: db.profiles.length,
        totalOrganizations: db.organizations.length,
        totalQrCodes: db.qrCodes.length,
        totalDynamicQrCodes: db.qrCodes.filter((q) => q.qrType === 'dynamic').length,
        totalScanEvents: db.qrScanEvents.length,
        openSupportTickets: db.supportTickets.filter((t) => t.status !== 'resolved').length,
        suspendedOrgs: db.organizations.filter((o) => o.status === 'suspended').length,
      },
      organizations,
      users,
      supportTickets: db.supportTickets,
      auditLogs: db.auditLogs.slice(0, 100),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load admin console.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: System Administrator privileges required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = body.action || '';

    // 1. Suspend or Restore Organization Account
    if (action === 'set_org_status') {
      const orgId = String(body.organizationId || '');
      const status = body.status === 'suspended' ? 'suspended' : 'active';
      const updated = mutateDb((db) => {
        const org = db.organizations.find((o) => o.id === orgId);
        if (!org) return null;
        org.status = status;
        org.updatedAt = new Date().toISOString();
        appendAuditLog(db, {
          organizationId: orgId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: status === 'suspended' ? 'admin.org_suspended' : 'admin.org_restored',
          entityType: 'organization',
          entityId: orgId,
          metadata: { status },
        });
        return org;
      });
      if (!updated) {
        return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
      }
      return NextResponse.json({ organization: updated });
    }

    // 2. Update Support Ticket Status
    if (action === 'update_ticket_status') {
      const ticketId = String(body.ticketId || '');
      const status = body.status as 'open' | 'in_progress' | 'resolved';
      const updated = mutateDb((db) => {
        const ticket = db.supportTickets.find((t) => t.id === ticketId);
        if (!ticket) return null;
        ticket.status = status;
        appendAuditLog(db, {
          organizationId: ticket.organizationId || null,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'admin.ticket_status_updated',
          entityType: 'support_ticket',
          entityId: ticketId,
          metadata: { status },
        });
        return ticket;
      });
      if (!updated) {
        return NextResponse.json({ error: 'Support ticket not found.' }, { status: 404 });
      }
      return NextResponse.json({ ticket: updated });
    }

    return NextResponse.json({ error: 'Invalid admin action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Admin operation failed.' }, { status: 500 });
  }
}
