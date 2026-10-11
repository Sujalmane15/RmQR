import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mutateDb, readDb } from '@/lib/db/store';
import {
  checkRateLimit,
  computeVisitorHash,
  sanitizeText,
} from '@/lib/security';
import {
  AIConversation,
  AILeadRecord,
  AIMessage,
  PLAN_ENTITLEMENTS,
} from '@/lib/types';
import {
  generateAgentChatResponse,
  getAIProviderStatus,
} from '@/lib/ai/agent-engine';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const db = readDb();
    const agent = (db.aiAgents || []).find(
      (a) => a.slug.toLowerCase() === slug.toLowerCase()
    );

    if (!agent) {
      return NextResponse.json(
        { available: false, reason: 'not_found', error: 'AI agent not found.' },
        { status: 404 }
      );
    }

    const org = db.organizations.find((o) => o.id === agent.organizationId);
    if (org?.status === 'suspended' || agent.status !== 'active') {
      return NextResponse.json(
        {
          available: false,
          reason: agent.status === 'paused' ? 'paused' : 'inactive',
          agentName: agent.agentName,
          businessName: agent.businessName,
          brandColor: agent.brandColor,
          humanContactUrl: agent.humanContactUrl,
          whatsappNumber: agent.whatsappNumber,
          phone: agent.phone,
        },
        { status: 423 }
      );
    }

    const providerStatus = getAIProviderStatus();

    // Return ONLY public-safe fields (never expose customInstructions, organizationId, or private keys)
    return NextResponse.json({
      available: true,
      agent: {
        slug: agent.slug,
        agentName: agent.agentName,
        businessName: agent.businessName,
        businessCategory: agent.businessCategory,
        businessDescription: agent.businessDescription,
        websiteUrl: agent.websiteUrl,
        phone: agent.phone,
        address: agent.address,
        defaultLanguage: agent.defaultLanguage,
        supportedLanguages: agent.supportedLanguages,
        welcomeTitle: agent.welcomeTitle,
        welcomeMessage: agent.welcomeMessage,
        chatbotDisplayName: agent.chatbotDisplayName,
        brandColor: agent.brandColor,
        logoUrl: agent.logoUrl,
        suggestedQuestions: agent.suggestedQuestions,
        leadCollectionEnabled: agent.leadCollectionEnabled,
        humanContactUrl: agent.humanContactUrl,
        whatsappNumber: agent.whatsappNumber,
        contactButtonLabel: agent.contactButtonLabel,
      },
      aiProvider: {
        configured: providerStatus.configured,
        provider: providerStatus.provider,
      },
    });
  } catch {
    return NextResponse.json(
      { available: false, error: 'Failed to load AI assistant.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const visitorHash = computeVisitorHash(
      req.headers.get('x-forwarded-for'),
      req.headers.get('user-agent')
    );

    const rate = checkRateLimit(`ai-chat:${slug}:${visitorHash}`, 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before sending another message.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const action = body.action || 'chat';

    const dbSnapshot = readDb();
    const agentSnapshot = (dbSnapshot.aiAgents || []).find(
      (a) => a.slug.toLowerCase() === slug.toLowerCase()
    );

    if (!agentSnapshot) {
      return NextResponse.json({ error: 'AI agent not found.' }, { status: 404 });
    }

    const org = dbSnapshot.organizations.find((o) => o.id === agentSnapshot.organizationId);
    if (org?.status === 'suspended' || agentSnapshot.status !== 'active') {
      return NextResponse.json(
        { error: 'This AI assistant is currently paused or inactive.' },
        { status: 423 }
      );
    }

    // Action 1: Optional Lead Collection with Mandatory Consent Check
    if (action === 'submit_lead') {
      if (!agentSnapshot.leadCollectionEnabled) {
        return NextResponse.json(
          { error: 'Lead collection is not enabled for this assistant.' },
          { status: 400 }
        );
      }

      if (body.consentGiven !== true) {
        return NextResponse.json(
          { error: 'Explicit consent is required before sharing contact details.' },
          { status: 400 }
        );
      }

      const name = sanitizeText(body.name || '', 80);
      const email = sanitizeText(body.email || '', 100);
      const phone = sanitizeText(body.phone || '', 40);
      const note = sanitizeText(body.note || '', 300);

      if (!name && !email && !phone) {
        return NextResponse.json(
          { error: 'Please provide at least a name, email, or phone number.' },
          { status: 400 }
        );
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }

      const savedLead = mutateDb((db) => {
        const targetAgent = db.aiAgents.find((a) => a.id === agentSnapshot.id);
        if (!targetAgent) return null;

        const lead: AILeadRecord = {
          id: crypto.randomUUID(),
          agentId: targetAgent.id,
          organizationId: targetAgent.organizationId,
          conversationId: body.conversationId ? sanitizeText(body.conversationId, 60) : null,
          name,
          email,
          phone,
          note,
          consentGiven: true,
          consentText:
            sanitizeText(body.consentText, 240) ||
            `Visitor consented to share contact details with ${targetAgent.businessName}.`,
          createdAt: new Date().toISOString(),
        };

        db.aiLeads.unshift(lead);
        targetAgent.leadCount = (targetAgent.leadCount || 0) + 1;
        targetAgent.updatedAt = lead.createdAt;
        return lead;
      });

      return NextResponse.json({ ok: true, leadId: savedLead?.id }, { status: 201 });
    }

    // Action 2: Public Visitor Chat Message
    const rawMessage = String(body.message || '').trim();
    if (!rawMessage) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }
    if (rawMessage.length > 600) {
      return NextResponse.json(
        { error: 'Message exceeds maximum length of 600 characters.' },
        { status: 400 }
      );
    }

    // Check organization monthly AI message entitlement
    const sub = dbSnapshot.subscriptions.find(
      (s) => s.organizationId === agentSnapshot.organizationId
    );
    const planId = sub?.planId || 'free';
    const plan = PLAN_ENTITLEMENTS[planId];
    const orgMessageCount = (dbSnapshot.aiAgents || [])
      .filter((a) => a.organizationId === agentSnapshot.organizationId)
      .reduce((acc, a) => acc + (a.messageCount || 0), 0);

    if (orgMessageCount >= plan.limits.monthlyAiMessages) {
      return NextResponse.json(
        {
          error: `Monthly AI message limit reached for this workspace. Please contact ${agentSnapshot.businessName} directly.`,
        },
        { status: 429 }
      );
    }

    const visitorSessionId =
      sanitizeText(body.visitorSessionId || '', 64) || visitorHash;
    const requestedConvId = sanitizeText(body.conversationId || '', 64);

    const existingConv = requestedConvId
      ? (dbSnapshot.aiConversations || []).find(
          (c) => c.id === requestedConvId && c.agentId === agentSnapshot.id
        )
      : null;

    if (existingConv && existingConv.messageCount >= 40) {
      return NextResponse.json(
        {
          error:
            'Maximum messages for this conversation reached. Please start a new conversation.',
        },
        { status: 400 }
      );
    }

    const priorHistory: Pick<AIMessage, 'role' | 'content'>[] = existingConv
      ? (dbSnapshot.aiMessages || [])
          .filter((m) => m.conversationId === existingConv.id)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const chatResult = await generateAgentChatResponse({
      db: dbSnapshot,
      agent: agentSnapshot,
      userMessage: rawMessage,
      history: priorHistory,
    });

    const persisted = mutateDb((db) => {
      const targetAgent = db.aiAgents.find((a) => a.id === agentSnapshot.id);
      if (!targetAgent) return null;

      const now = new Date().toISOString();
      let conv: AIConversation | undefined = requestedConvId
        ? db.aiConversations.find(
            (c) => c.id === requestedConvId && c.agentId === targetAgent.id
          )
        : undefined;

      if (!conv) {
        conv = {
          id: crypto.randomUUID(),
          agentId: targetAgent.id,
          organizationId: targetAgent.organizationId,
          visitorSessionId,
          startedAt: now,
          lastMessageAt: now,
          messageCount: 0,
          status: 'active',
        };
        db.aiConversations.unshift(conv);
        targetAgent.conversationCount = (targetAgent.conversationCount || 0) + 1;
      }

      const userMsg: AIMessage = {
        id: crypto.randomUUID(),
        conversationId: conv.id,
        agentId: targetAgent.id,
        organizationId: targetAgent.organizationId,
        role: 'user',
        content: sanitizeText(rawMessage, 600),
        createdAt: now,
      };

      const assistantMsg: AIMessage = {
        id: crypto.randomUUID(),
        conversationId: conv.id,
        agentId: targetAgent.id,
        organizationId: targetAgent.organizationId,
        role: 'assistant',
        content: chatResult.reply,
        providerUsed: chatResult.providerUsed,
        groundedSources: chatResult.groundedSources,
        createdAt: now,
      };

      db.aiMessages.push(userMsg, assistantMsg);
      conv.messageCount += 2;
      conv.lastMessageAt = now;

      targetAgent.messageCount = (targetAgent.messageCount || 0) + 2;
      targetAgent.updatedAt = now;

      return {
        conversationId: conv.id,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
      };
    });

    return NextResponse.json({
      conversationId: persisted?.conversationId,
      reply: chatResult.reply,
      providerUsed: chatResult.providerUsed,
      aiConfigured: chatResult.aiConfigured,
      groundedSources: chatResult.groundedSources,
      providerWarning: chatResult.providerWarning,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to process message right now. Please try again.' },
      { status: 500 }
    );
  }
}
