import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import { assertOrgAccess, AuthorizationError, mutateDb, readDb } from '@/lib/db/store';
import { sanitizeText } from '@/lib/security';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id);
    const folders = db.qrFolders.filter((f) => f.organizationId === session.activeOrg.id);
    return NextResponse.json({ folders });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load folders.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const name = sanitizeText(body.name, 60);
    const color = sanitizeText(body.color || '#7C3AED', 16);

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
    }

    const folder = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      const newFolder = {
        id: crypto.randomUUID(),
        organizationId: session.activeOrg.id,
        name,
        color,
        createdAt: new Date().toISOString(),
      };
      db.qrFolders.push(newFolder);
      return newFolder;
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to create folder.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Folder ID is required.' }, { status: 400 });

    mutateDb((db) => {
      const folder = db.qrFolders.find((f) => f.id === id);
      if (!folder) throw new AuthorizationError('Folder not found.', 404);
      assertOrgAccess(db, session.user.id, folder.organizationId, ['owner', 'admin', 'editor']);
      db.qrFolders = db.qrFolders.filter((f) => f.id !== id);
      for (const q of db.qrCodes) {
        if (q.folderId === id) q.folderId = null;
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete folder.' }, { status: 500 });
  }
}
