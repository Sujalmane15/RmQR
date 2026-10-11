import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  AuthorizationError,
  mutateDb,
  readDb,
} from '@/lib/db/store';
import { sanitizeText, validateSafeRedirectUrl } from '@/lib/security';
import {
  AIAgentCategory,
  AIAgentStatus,
  AIAgentTone,
  AIKnowledgeEntry,
  AIKnowledgeSection,
} from '@/lib/types';

const VALID_SECTIONS = new Set<AIKnowledgeSection>([
  'about',
  'products_services',
  'pricing',
  'opening_hours',
  'faq',
  'policies',
  'contact',
  'menu_items',
  'custom_facts',
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await context.params;
    const db = readDb();
    const agent = (db.aiAgents || []).find((a) => a.id === id);

    if (!agent) {
      return NextResponse.json({ error: 'AI agent not found.' }, { status: 404 });
    }

    // Strict tenant isolation: verify current user belongs to agent's organization
    assertOrgAccess(db, session.user.id, agent.organizationId, [
      'owner',
      'admin',
      'editor',
      'viewer',
    ]);

    const qrCode = db.qrCodes.find((q) => q.id === agent.qrCodeId) || null;
    const knowledgeEntries = (db.aiKnowledgeEntries || []).filter(
      (k) => k.agentId === agent.id && k.organizationId === agent.organizationId
    );
    const conversations = (db.aiConversations || [])
      .filter((c) => c.agentId === agent.id && c.organizationId === agent.organizationId)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, 50)
      .map((conv) => ({
        ...conv,
        messages: (db.aiMessages || []).filter((m) => m.conversationId === conv.id),
      }));
    const leads = (db.aiLeads || [])
      .filter((l) => l.agentId === agent.id && l.organizationId === agent.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      agent,
      qrCode,
      knowledgeEntries,
      conversations,
      leads,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load AI agent details.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const action = body.action || 'update_agent';

    const result = mutateDb((db) => {
      const agent = (db.aiAgents || []).find((a) => a.id === id);
      if (!agent) {
        throw new AuthorizationError('AI agent not found.', 404);
      }

      // Enforce tenant isolation & write role
      assertOrgAccess(db, session.user.id, agent.organizationId, ['owner', 'admin', 'editor']);
      const now = new Date().toISOString();

      // Action 1: Add a Knowledge Base Entry
      if (action === 'add_knowledge') {
        const title = sanitizeText(body.title, 100);
        const content = sanitizeText(body.content, 2500);
        if (!title || !content) {
          throw new AuthorizationError('Knowledge title and content are required.', 400);
        }
        const rawSec = String(body.section || 'custom_facts') as AIKnowledgeSection;
        const section: AIKnowledgeSection = VALID_SECTIONS.has(rawSec) ? rawSec : 'custom_facts';

        const newEntry: AIKnowledgeEntry = {
          id: crypto.randomUUID(),
          agentId: agent.id,
          organizationId: agent.organizationId,
          section,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        };
        db.aiKnowledgeEntries.push(newEntry);
        agent.knowledgeUpdatedAt = now;
        agent.updatedAt = now;

        appendAuditLog(db, {
          organizationId: agent.organizationId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'ai_agent.knowledge_added',
          entityType: 'ai_agent',
          entityId: agent.id,
          metadata: { entryId: newEntry.id, section, title },
        });

        return {
          agent,
          entry: newEntry,
          knowledgeEntries: db.aiKnowledgeEntries.filter((k) => k.agentId === agent.id),
        };
      }

      // Action 2: Edit an Existing Knowledge Base Entry
      if (action === 'update_knowledge') {
        const entryId = String(body.entryId || '');
        const entry = db.aiKnowledgeEntries.find(
          (k) =>
            k.id === entryId &&
            k.agentId === agent.id &&
            k.organizationId === agent.organizationId
        );
        if (!entry) {
          throw new AuthorizationError('Knowledge entry not found.', 404);
        }
        if (body.title !== undefined) {
          const t = sanitizeText(body.title, 100);
          if (!t) throw new AuthorizationError('Knowledge title cannot be empty.', 400);
          entry.title = t;
        }
        if (body.content !== undefined) {
          const c = sanitizeText(body.content, 2500);
          if (!c) throw new AuthorizationError('Knowledge content cannot be empty.', 400);
          entry.content = c;
        }
        if (body.section !== undefined && VALID_SECTIONS.has(body.section)) {
          entry.section = body.section;
        }
        entry.updatedAt = now;
        agent.knowledgeUpdatedAt = now;
        agent.updatedAt = now;

        return {
          agent,
          entry,
          knowledgeEntries: db.aiKnowledgeEntries.filter((k) => k.agentId === agent.id),
        };
      }

      // Action 3: Delete a Knowledge Base Entry
      if (action === 'delete_knowledge') {
        const entryId = String(body.entryId || '');
        const beforeLen = db.aiKnowledgeEntries.length;
        db.aiKnowledgeEntries = db.aiKnowledgeEntries.filter(
          (k) =>
            !(
              k.id === entryId &&
              k.agentId === agent.id &&
              k.organizationId === agent.organizationId
            )
        );
        if (db.aiKnowledgeEntries.length === beforeLen) {
          throw new AuthorizationError('Knowledge entry not found.', 404);
        }
        agent.knowledgeUpdatedAt = now;
        agent.updatedAt = now;

        return {
          agent,
          knowledgeEntries: db.aiKnowledgeEntries.filter((k) => k.agentId === agent.id),
        };
      }

      // Default Action: Update Agent Settings / Status / Personality / Branding
      if (body.agentName !== undefined) {
        const name = sanitizeText(body.agentName, 80);
        if (!name) throw new AuthorizationError('Agent name cannot be empty.', 400);
        agent.agentName = name;
      }
      if (body.businessName !== undefined) {
        const biz = sanitizeText(body.businessName, 80);
        if (!biz) throw new AuthorizationError('Business name cannot be empty.', 400);
        agent.businessName = biz;
      }
      if (body.businessCategory !== undefined) {
        agent.businessCategory = body.businessCategory as AIAgentCategory;
      }
      if (body.businessDescription !== undefined) {
        agent.businessDescription = sanitizeText(body.businessDescription, 400);
      }
      if (body.websiteUrl !== undefined) {
        if (!body.websiteUrl) {
          agent.websiteUrl = '';
        } else {
          const check = validateSafeRedirectUrl(String(body.websiteUrl));
          if (check.valid && check.sanitizedUrl) agent.websiteUrl = check.sanitizedUrl;
        }
      }
      if (body.phone !== undefined) agent.phone = sanitizeText(body.phone, 40);
      if (body.address !== undefined) agent.address = sanitizeText(body.address, 200);
      if (body.defaultLanguage !== undefined) {
        agent.defaultLanguage = sanitizeText(body.defaultLanguage, 30) || 'English';
      }
      if (Array.isArray(body.supportedLanguages)) {
        const langs = body.supportedLanguages
          .map((l: unknown) => sanitizeText(String(l || ''), 30))
          .filter(Boolean);
        if (langs.length > 0) agent.supportedLanguages = langs;
      }
      if (body.linkedMenuId !== undefined) {
        if (!body.linkedMenuId) {
          agent.linkedMenuId = null;
        } else {
          const validMenu = db.menus.some(
            (m) => m.id === body.linkedMenuId && m.organizationId === agent.organizationId
          );
          if (validMenu) agent.linkedMenuId = String(body.linkedMenuId);
        }
      }
      if (body.linkedLandingPageId !== undefined) {
        if (!body.linkedLandingPageId) {
          agent.linkedLandingPageId = null;
        } else {
          const validLp = db.landingPages.some(
            (lp) => lp.id === body.linkedLandingPageId && lp.organizationId === agent.organizationId
          );
          if (validLp) agent.linkedLandingPageId = String(body.linkedLandingPageId);
        }
      }
      if (body.tone !== undefined) agent.tone = body.tone as AIAgentTone;
      if (body.responseLength === 'concise' || body.responseLength === 'detailed') {
        agent.responseLength = body.responseLength;
      }
      if (body.welcomeMessage !== undefined) {
        agent.welcomeMessage = sanitizeText(body.welcomeMessage, 300);
      }
      if (Array.isArray(body.suggestedQuestions)) {
        agent.suggestedQuestions = body.suggestedQuestions
          .map((q: unknown) => sanitizeText(String(q || ''), 120))
          .filter(Boolean)
          .slice(0, 6);
      }
      if (body.customInstructions !== undefined) {
        agent.customInstructions = sanitizeText(body.customInstructions, 500);
      }
      if (body.fallbackUnknownMessage !== undefined) {
        agent.fallbackUnknownMessage = sanitizeText(body.fallbackUnknownMessage, 300);
      }
      if (body.leadCollectionEnabled !== undefined) {
        agent.leadCollectionEnabled = Boolean(body.leadCollectionEnabled);
      }
      if (body.humanContactUrl !== undefined) {
        if (!body.humanContactUrl) {
          agent.humanContactUrl = '';
        } else {
          const check = validateSafeRedirectUrl(String(body.humanContactUrl));
          if (check.valid && check.sanitizedUrl) agent.humanContactUrl = check.sanitizedUrl;
        }
      }
      if (body.whatsappNumber !== undefined) {
        agent.whatsappNumber = sanitizeText(body.whatsappNumber, 30).replace(/[^\d+]/g, '');
      }
      if (body.logoUrl !== undefined) {
        agent.logoUrl = body.logoUrl ? sanitizeText(body.logoUrl, 200000) : undefined;
      }
      if (
        typeof body.brandColor === 'string' &&
        /^#[0-9A-Fa-f]{3,6}$/.test(body.brandColor.trim())
      ) {
        agent.brandColor = body.brandColor.trim();
      }
      if (body.welcomeTitle !== undefined) {
        agent.welcomeTitle = sanitizeText(body.welcomeTitle, 80);
      }
      if (body.chatbotDisplayName !== undefined) {
        agent.chatbotDisplayName = sanitizeText(body.chatbotDisplayName, 50);
      }
      if (body.contactButtonLabel !== undefined) {
        agent.contactButtonLabel = sanitizeText(body.contactButtonLabel, 40);
      }

      if (
        body.status === 'active' ||
        body.status === 'paused' ||
        body.status === 'inactive'
      ) {
        agent.status = body.status as AIAgentStatus;
        // Also synchronize linked QR code status if requested
        if (agent.qrCodeId && body.syncQrStatus !== false) {
          const qr = db.qrCodes.find((q) => q.id === agent.qrCodeId);
          if (qr) {
            qr.status =
              body.status === 'active'
                ? 'active'
                : body.status === 'paused'
                ? 'paused'
                : 'archived';
            qr.updatedAt = now;
          }
        }
      }

      agent.updatedAt = now;

      appendAuditLog(db, {
        organizationId: agent.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'ai_agent.updated',
        entityType: 'ai_agent',
        entityId: agent.id,
        metadata: { status: agent.status, agentName: agent.agentName },
      });

      return {
        agent,
        qrCode: db.qrCodes.find((q) => q.id === agent.qrCodeId) || null,
        knowledgeEntries: db.aiKnowledgeEntries.filter((k) => k.agentId === agent.id),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update AI agent.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await context.params;

    mutateDb((db) => {
      const agent = (db.aiAgents || []).find((a) => a.id === id);
      if (!agent) {
        throw new AuthorizationError('AI agent not found.', 404);
      }

      assertOrgAccess(db, session.user.id, agent.organizationId, ['owner', 'admin', 'editor']);

      if (agent.qrCodeId) {
        db.qrCodes = db.qrCodes.filter((q) => q.id !== agent.qrCodeId);
      }

      db.aiAgents = db.aiAgents.filter((a) => a.id !== id);
      db.aiKnowledgeEntries = db.aiKnowledgeEntries.filter((k) => k.agentId !== id);
      db.aiConversations = db.aiConversations.filter((c) => c.agentId !== id);
      db.aiMessages = db.aiMessages.filter((m) => m.agentId !== id);
      db.aiLeads = db.aiLeads.filter((l) => l.agentId !== id);

      appendAuditLog(db, {
        organizationId: agent.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'ai_agent.deleted',
        entityType: 'ai_agent',
        entityId: id,
        metadata: { agentName: agent.agentName, slug: agent.slug },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete AI agent.' }, { status: 500 });
  }
}
