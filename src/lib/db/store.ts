// =============================================================================
// RMQR — Persistent Multi-Tenant Database Store & RBAC Authorization Engine
// =============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AIAgentRecord,
  AIConversation,
  AIKnowledgeEntry,
  AILeadRecord,
  AIMessage,
  ApiKeyRecord,
  AuditLog,
  BillingInvoice,
  BusinessProfile,
  Campaign,
  CustomerReviewSession,
  DEFAULT_QR_STYLE,
  LandingPage,
  LandingPageBlock,
  MenuCategory,
  MenuItem,
  Organization,
  OrganizationMember,
  OrgRole,
  PLAN_ENTITLEMENTS,
  Profile,
  QRCodeRecord,
  QRDestinationHistory,
  QRFolder,
  QRScanEvent,
  RestaurantMenu,
  ReviewCampaign,
  ReviewResponseLogItem,
  Subscription,
  SupportTicket,
  UploadedAsset,
  WebhookEndpoint,
} from '../types';
import { hashPassword } from '../security';
import {
  getSupabaseConfigStatus,
  loadStateFromSupabase,
  syncStateToSupabase,
} from '../supabase/server';

export interface DatabaseSchema {
  profiles: Profile[];
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  subscriptions: Subscription[];
  billingInvoices: BillingInvoice[];
  qrFolders: QRFolder[];
  campaigns: Campaign[];
  qrCodes: QRCodeRecord[];
  qrDestinations: QRDestinationHistory[];
  qrScanEvents: QRScanEvent[];
  landingPages: LandingPage[];
  landingPageBlocks: LandingPageBlock[];
  businessProfiles: BusinessProfile[];
  reviewCampaigns: ReviewCampaign[];
  reviewResponseLogs: ReviewResponseLogItem[];
  customerReviewSessions: CustomerReviewSession[];
  menus: RestaurantMenu[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  aiAgents: AIAgentRecord[];
  aiKnowledgeEntries: AIKnowledgeEntry[];
  aiConversations: AIConversation[];
  aiMessages: AIMessage[];
  aiLeads: AILeadRecord[];
  uploadedAssets: UploadedAsset[];
  apiKeys: ApiKeyRecord[];
  webhookEndpoints: WebhookEndpoint[];
  auditLogs: AuditLog[];
  supportTickets: SupportTicket[];
}

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

function getDbFilePath(): string {
  if (process.env.RMQR_DB_PATH) {
    return path.resolve(process.env.RMQR_DB_PATH);
  }
  return path.join(process.cwd(), 'data', 'rmqr-db.json');
}

function createInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const adminUserId = '00000000-0000-4000-8000-000000000001';
  const ownerUserId = '00000000-0000-4000-8000-000000000002';
  const defaultOrgId = '00000000-0000-4000-8000-000000000010';
  const defaultFolderId = '00000000-0000-4000-8000-000000000020';
  const defaultCampaignId = '00000000-0000-4000-8000-000000000030';
  const defaultQrId = '00000000-0000-4000-8000-000000000040';
  const defaultLandingPageId = '00000000-0000-4000-8000-000000000050';
  const defaultMenuId = '00000000-0000-4000-8000-000000000060';
  const catStartersId = '00000000-0000-4000-8000-000000000061';
  const catMainsId = '00000000-0000-4000-8000-000000000062';
  const catBeveragesId = '00000000-0000-4000-8000-000000000063';
  const defaultReviewId = '00000000-0000-4000-8000-000000000070';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    profiles: [
      {
        id: adminUserId,
        email: 'admin@rmqr.app',
        fullName: 'RMQR Platform Admin',
        passwordHash: hashPassword('AdminPass123!'),
        isSuperAdmin: true,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 6,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ownerUserId,
        email: 'owner@rmqr.app',
        fullName: 'Aarav Mehta',
        passwordHash: hashPassword('OwnerPass123!'),
        isSuperAdmin: false,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 6,
        createdAt: now,
        updatedAt: now,
      },
    ],
    organizations: [
      {
        id: defaultOrgId,
        name: 'Saffron & Slate Hospitality',
        slug: 'saffron-slate',
        industry: 'Restaurant & Hospitality',
        brandPrimaryColor: '#7C3AED',
        brandSecondaryColor: '#0B0F19',
        whiteLabelEnabled: false,
        status: 'active',
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    organizationMembers: [
      {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        userId: ownerUserId,
        invitedEmail: 'owner@rmqr.app',
        role: 'owner',
        status: 'active',
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        userId: adminUserId,
        invitedEmail: 'admin@rmqr.app',
        role: 'admin',
        status: 'active',
        createdAt: now,
      },
    ],
    subscriptions: [
      {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        planId: 'pro',
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: thirtyDaysLater,
        paymentProvider: 'manual',
        createdAt: now,
        updatedAt: now,
      },
    ],
    billingInvoices: [],
    qrFolders: [
      {
        id: defaultFolderId,
        organizationId: defaultOrgId,
        name: 'Table Standees & Menus',
        color: '#7C3AED',
        createdAt: now,
      },
    ],
    campaigns: [
      {
        id: defaultCampaignId,
        organizationId: defaultOrgId,
        name: 'Dine-In Table Experience',
        description: 'Tabletop QR standees for digital menu and Google reviews',
        startDate: now.slice(0, 10),
        utmSource: 'qr_standee',
        utmMedium: 'tabletop',
        utmCampaign: 'dine_in_2026',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    qrCodes: [
      {
        id: defaultQrId,
        organizationId: defaultOrgId,
        folderId: defaultFolderId,
        campaignId: defaultCampaignId,
        name: 'Saffron & Slate Digital Menu QR',
        description: 'Dynamic QR linked to our live digital restaurant menu',
        slug: 'saffron-menu',
        qrType: 'dynamic',
        contentType: 'menu',
        status: 'active',
        encodedContent: `${appUrl}/r/saffron-menu`,
        destinationUrl: '/m/saffron-bistro',
        routingRules: [],
        styleConfig: {
          ...DEFAULT_QR_STYLE,
          fgColor: '#0B0F19',
          eyeColor: '#7C3AED',
          pattern: 'rounded',
          eyeStyle: 'rounded',
          frameStyle: 'banner_bottom',
          frameText: 'SCAN FOR MENU',
          frameColor: '#7C3AED',
        },
        tags: ['menu', 'tabletop'],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    qrDestinations: [
      {
        id: crypto.randomUUID(),
        qrCodeId: defaultQrId,
        organizationId: defaultOrgId,
        destinationUrl: '/m/saffron-bistro',
        isActive: true,
        weight: 100,
        deviceRule: 'all',
        createdBy: ownerUserId,
        createdAt: now,
      },
    ],
    // Strictly empty scan events initially — no fabricated analytics
    qrScanEvents: [],
    landingPages: [
      {
        id: defaultLandingPageId,
        organizationId: defaultOrgId,
        qrCodeId: null,
        slug: 'saffron-hub',
        title: 'Saffron & Slate — Modern Indian Kitchen',
        description: 'View our live digital menu, reserve a table, connect on WhatsApp, or share your review.',
        pageType: 'business_profile',
        status: 'published',
        themeConfig: {
          primaryColor: '#7C3AED',
          bgColor: '#0B0F19',
          textColor: '#FFFFFF',
          buttonStyle: 'rounded',
        },
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'website', url: 'https://example.com' },
        ],
        contactInfo: {
          phone: '+91 98200 12345',
          whatsapp: '919820012345',
          email: 'hello@saffronslate.in',
          address: 'Bandra West, Mumbai, Maharashtra 400050',
          openingHours: 'Mon–Sun: 12:00 PM – 11:30 PM',
        },
        viewCount: 0,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    landingPageBlocks: [
      {
        id: '00000000-0000-4000-8000-000000000051',
        landingPageId: defaultLandingPageId,
        organizationId: defaultOrgId,
        blockType: 'button',
        title: 'Explore Live Digital Menu',
        subtitle: 'Updated daily with chef specials',
        url: '/m/saffron-bistro',
        icon: 'utensils',
        sortOrder: 1,
        clickCount: 0,
        isEnabled: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000052',
        landingPageId: defaultLandingPageId,
        organizationId: defaultOrgId,
        blockType: 'button',
        title: 'Leave Us a Google Review',
        subtitle: 'Takes less than 15 seconds',
        url: '/review/saffron-reviews',
        icon: 'star',
        sortOrder: 2,
        clickCount: 0,
        isEnabled: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000053',
        landingPageId: defaultLandingPageId,
        organizationId: defaultOrgId,
        blockType: 'whatsapp',
        title: 'Reserve Table on WhatsApp',
        subtitle: 'Instant booking confirmation',
        url: 'https://wa.me/919820012345?text=Hi%2C%20I%20would%20like%20to%20reserve%20a%20table',
        icon: 'message-circle',
        sortOrder: 3,
        clickCount: 0,
        isEnabled: true,
      },
    ],
    businessProfiles: [
      {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        businessName: 'Saffron & Slate Bistro',
        category: 'Restaurant',
        description: 'Contemporary Indian plates & craft coffee.',
        address: 'Bandra West, Mumbai 400050',
        phone: '+91 98200 12345',
        whatsapp: '919820012345',
        email: 'hello@saffronslate.in',
        website: 'https://example.com',
        googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJwe1EZjDG5zsRaYxkjY_tpF0',
        googlePlaceId: 'ChIJwe1EZjDG5zsRaYxkjY_tpF0',
        openingHours: {
          Monday: '12:00 PM - 11:30 PM',
          Tuesday: '12:00 PM - 11:30 PM',
          Wednesday: '12:00 PM - 11:30 PM',
          Thursday: '12:00 PM - 11:30 PM',
          Friday: '12:00 PM - 12:00 AM',
          Saturday: '12:00 PM - 12:00 AM',
          Sunday: '12:00 PM - 11:30 PM',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    reviewCampaigns: [
      {
        id: '00000000-0000-4000-8000-000000000075',
        organizationId: defaultOrgId,
        businessProfileId: null,
        qrCodeId: '00000000-0000-4000-8000-000000000076',
        slug: 'rm-solution-reviews',
        name: 'RM Solution — Google Review AI Assistant',
        businessName: 'RM Solution',
        googleReviewUrl: 'https://g.page/r/CdT-R2IpVtpnEBM/review',
        contactPhone: '7400342769',
        headline: 'How was your experience with RM Solution?',
        subheadline: 'Share your honest review on Google. Your feedback helps us serve you better.',
        ctaText: 'Continue to Google Reviews',
        brandColor: '#7C3AED',
        suggestedHighlights: ['Helpful Guidance', 'Quick Service', 'Polite Support', 'Reliable Assistance'],
        aiDraftsEnabled: true,
        reviewAgentEnabled: true,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'mr'],
        scanCount: 0,
        googleClickCount: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: defaultReviewId,
        organizationId: defaultOrgId,
        businessProfileId: null,
        qrCodeId: null,
        slug: 'saffron-reviews',
        name: 'Dine-In Feedback & Google Review Flow',
        businessName: 'Saffron & Slate Bistro',
        googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJwe1EZjDG5zsRaYxkjY_tpF0',
        headline: 'How was your meal at Saffron & Slate?',
        subheadline: 'Share your honest experience on Google. Optional review drafts are available if you want a quick starting point.',
        ctaText: 'Open Google Reviews',
        brandColor: '#7C3AED',
        suggestedHighlights: ['Warm Service', 'Truffle Kulcha', 'Great Ambience', 'Quick Seating', 'Filter Coffee'],
        aiDraftsEnabled: true,
        reviewAgentEnabled: true,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'hi', 'mr'],
        scanCount: 0,
        googleClickCount: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
    reviewResponseLogs: [],
    customerReviewSessions: [],
    menus: [
      {
        id: defaultMenuId,
        organizationId: defaultOrgId,
        qrCodeId: defaultQrId,
        slug: 'saffron-bistro',
        restaurantName: 'Saffron & Slate Bistro',
        description: 'Artisanal Wood-Fired Small Plates, Tandoor Signatures & Specialty Coffee',
        currency: 'INR',
        currencySymbol: '₹',
        themeConfig: {
          primaryColor: '#7C3AED',
          accentColor: '#10B981',
          layout: 'grid',
        },
        status: 'published',
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    menuCategories: [
      {
        id: catStartersId,
        menuId: defaultMenuId,
        organizationId: defaultOrgId,
        name: 'Small Plates & Appetizers',
        description: 'Crisp, shareable starters fresh from our wood-fired oven',
        sortOrder: 1,
        isAvailable: true,
        createdAt: now,
      },
      {
        id: catMainsId,
        menuId: defaultMenuId,
        organizationId: defaultOrgId,
        name: 'Signature Mains & Curries',
        description: 'Slow-simmered gravies and regional classics',
        sortOrder: 2,
        isAvailable: true,
        createdAt: now,
      },
      {
        id: catBeveragesId,
        menuId: defaultMenuId,
        organizationId: defaultOrgId,
        name: 'Craft Beverages & Desserts',
        description: 'Cold brews, botanical tonics, and handcrafted sweets',
        sortOrder: 3,
        isAvailable: true,
        createdAt: now,
      },
    ],
    menuItems: [
      {
        id: '00000000-0000-4000-8000-000000000081',
        menuId: defaultMenuId,
        categoryId: catStartersId,
        organizationId: defaultOrgId,
        name: 'Smoked Burrata & Truffle Kulcha',
        description: 'Wood-fired sourdough kulcha stuffed with creamy burrata, black truffle oil, and charred garlic.',
        price: 495,
        isVeg: true,
        dietaryTags: ['Vegetarian', 'Chef Signature'],
        isBestseller: true,
        isRecommended: true,
        isHighMargin: true,
        showHighMarginBadge: false,
        isTodaysSpecial: true,
        isAvailable: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000082',
        menuId: defaultMenuId,
        categoryId: catStartersId,
        organizationId: defaultOrgId,
        name: 'Charcoal Malai Broccoli',
        description: 'Tandoor-roasted broccoli florets marinated in cardamom cream and toasted almond flakes.',
        price: 385,
        isVeg: true,
        dietaryTags: ['Vegetarian', 'Gluten-Free'],
        isBestseller: false,
        isRecommended: true,
        isHighMargin: true,
        showHighMarginBadge: false,
        isTodaysSpecial: false,
        isAvailable: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000083',
        menuId: defaultMenuId,
        categoryId: catStartersId,
        organizationId: defaultOrgId,
        name: 'Guntur Chilli Prawns',
        description: 'Pan-seared tiger prawns tossed in fiery Guntur chilli butter and crispy curry leaves.',
        price: 625,
        isVeg: false,
        dietaryTags: ['Spicy', 'Seafood'],
        isBestseller: true,
        isRecommended: false,
        isHighMargin: false,
        showHighMarginBadge: false,
        isTodaysSpecial: true,
        isAvailable: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000084',
        menuId: defaultMenuId,
        categoryId: catMainsId,
        organizationId: defaultOrgId,
        name: '24-Hour Dal Makhani',
        description: 'Whole black lentils slow-cooked overnight over charcoal embers, finished with white butter.',
        price: 445,
        isVeg: true,
        dietaryTags: ['Vegetarian', 'Rich'],
        isBestseller: true,
        isRecommended: true,
        isHighMargin: true,
        showHighMarginBadge: false,
        isTodaysSpecial: false,
        isAvailable: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000085',
        menuId: defaultMenuId,
        categoryId: catMainsId,
        organizationId: defaultOrgId,
        name: 'Old Delhi Butter Chicken',
        description: 'Tandoori chicken tikka simmered in velvety heirloom tomato and fenugreek gravy.',
        price: 565,
        isVeg: false,
        dietaryTags: ['Contains Dairy'],
        isBestseller: true,
        isRecommended: true,
        isHighMargin: false,
        showHighMarginBadge: false,
        isTodaysSpecial: false,
        isAvailable: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000086',
        menuId: defaultMenuId,
        categoryId: catBeveragesId,
        organizationId: defaultOrgId,
        name: 'Coorg Jaggery Cold Brew',
        description: '18-hour single-estate Arabica cold brew sweetened with organic palm jaggery and orange peel.',
        price: 265,
        isVeg: true,
        dietaryTags: ['Vegan', 'Dairy-Free'],
        isBestseller: false,
        isRecommended: true,
        isHighMargin: true,
        showHighMarginBadge: false,
        isTodaysSpecial: true,
        isAvailable: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    aiAgents: [
      {
        id: '00000000-0000-4000-8000-000000000090',
        organizationId: defaultOrgId,
        qrCodeId: '00000000-0000-4000-8000-000000000044',
        slug: 'saffron-concierge',
        status: 'active',
        agentName: 'Saffron & Slate Guest Concierge',
        businessName: 'Saffron & Slate Hospitality',
        businessCategory: 'restaurant_cafe',
        businessDescription:
          'Modern Indian dining and craft cocktail kitchen in Bandra West, Mumbai.',
        websiteUrl: 'https://saffronslate.in',
        phone: '+91 98200 12345',
        address: '14th Road, Bandra West, Mumbai, Maharashtra 400050',
        defaultLanguage: 'English',
        supportedLanguages: ['English', 'Hindi'],
        linkedMenuId: defaultMenuId,
        linkedLandingPageId: defaultLandingPageId,
        tone: 'warm_hospitality',
        responseLength: 'concise',
        welcomeMessage:
          'Welcome to Saffron & Slate! Ask me about our dishes, dietary options, opening hours, table reservations, or parking.',
        suggestedQuestions: [
          'What are your opening hours and address?',
          'Which vegetarian or vegan dishes do you recommend?',
          'What is the price of Smoked Burrata & Truffle Kulcha?',
          'Do you take reservations or private dining bookings?',
        ],
        customInstructions:
          'Only state prices, dishes, hours, and policies explicitly listed in the knowledge base or linked menu. Never invent dishes or discounts.',
        fallbackUnknownMessage:
          'I do not have that specific detail in our verified restaurant guide right now. Please reach out to our host desk at +91 98200 12345 or WhatsApp us directly.',
        leadCollectionEnabled: true,
        humanContactUrl: 'https://wa.me/919820012345',
        whatsappNumber: '919820012345',
        brandColor: '#7C3AED',
        welcomeTitle: 'Ask Saffron & Slate AI Concierge',
        chatbotDisplayName: 'Saffron Concierge',
        contactButtonLabel: 'WhatsApp Host Desk',
        conversationCount: 0,
        messageCount: 0,
        leadCount: 0,
        knowledgeUpdatedAt: now,
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    aiKnowledgeEntries: [
      {
        id: '00000000-0000-4000-8000-000000000091',
        agentId: '00000000-0000-4000-8000-000000000090',
        organizationId: defaultOrgId,
        section: 'about',
        title: 'About Saffron & Slate',
        content:
          'Saffron & Slate is a modern Indian bistro and craft bar in Bandra West, Mumbai, specializing in wood-fired kulchas, coastal seafood, and single-estate cold brews.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000092',
        agentId: '00000000-0000-4000-8000-000000000090',
        organizationId: defaultOrgId,
        section: 'opening_hours',
        title: 'Opening Hours & Location',
        content:
          'Open daily Monday through Sunday from 12:00 PM to 11:30 PM. Last kitchen order is at 11:00 PM. Address: 14th Road, Bandra West, Mumbai, Maharashtra 400050. Valet parking is available at the main gate.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000093',
        agentId: '00000000-0000-4000-8000-000000000090',
        organizationId: defaultOrgId,
        section: 'policies',
        title: 'Reservations, Dietary & Pet Policy',
        content:
          'Walk-ins are welcome, and table reservations are recommended for Friday–Sunday dinner. We offer clearly labeled Vegetarian, Vegan, and Gluten-Free dishes. Outdoor patio seating is pet-friendly.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000094',
        agentId: '00000000-0000-4000-8000-000000000090',
        organizationId: defaultOrgId,
        section: 'faq',
        title: 'Private Dining & Events FAQ',
        content:
          'We host private chef-table dinners for 8 to 24 guests. All menu prices are in INR and subject to applicable GST and optional 5% service charge.',
        createdAt: now,
        updatedAt: now,
      },
    ],
    aiConversations: [],
    aiMessages: [],
    aiLeads: [],
    uploadedAssets: [],
    apiKeys: [],
    webhookEndpoints: [],
    auditLogs: [
      {
        id: crypto.randomUUID(),
        organizationId: defaultOrgId,
        actorId: ownerUserId,
        actorEmail: 'owner@rmqr.app',
        action: 'organization.initialized',
        entityType: 'organization',
        entityId: defaultOrgId,
        metadata: { plan: 'pro' },
        createdAt: now,
      },
    ],
    supportTickets: [],
  };
}

/**
 * Ensures existing `data/rmqr-db.json` files from prior versions are safely upgraded in-place
 * with the new AI Agent collections without losing or modifying any existing user records.
 */
function ensureBackwardCompatibleCollections(db: DatabaseSchema): boolean {
  let mutated = false;
  const seed = createInitialSeedData();

  if (!Array.isArray(db.aiAgents)) {
    db.aiAgents = seed.aiAgents;
    mutated = true;
  }
  if (!Array.isArray(db.aiKnowledgeEntries)) {
    db.aiKnowledgeEntries = seed.aiKnowledgeEntries;
    mutated = true;
  }
  if (!Array.isArray(db.aiConversations)) {
    db.aiConversations = [];
    mutated = true;
  }
  if (!Array.isArray(db.aiMessages)) {
    db.aiMessages = [];
    mutated = true;
  }
  if (!Array.isArray(db.aiLeads)) {
    db.aiLeads = [];
    mutated = true;
  }
  if (!Array.isArray(db.reviewResponseLogs)) {
    db.reviewResponseLogs = [];
    mutated = true;
  }
  if (!Array.isArray(db.customerReviewSessions)) {
    db.customerReviewSessions = [];
    mutated = true;
  } else if (pruneExpiredReviewSessions(db)) {
    mutated = true;
  }
  if (!Array.isArray(db.reviewCampaigns)) {
    db.reviewCampaigns = seed.reviewCampaigns;
    mutated = true;
  } else {
    const rmCampaign = db.reviewCampaigns.find(
      (r) =>
        r.slug === 'rm-solution-reviews' ||
        r.slug === 'rm-solution' ||
        r.businessName.toLowerCase() === 'rm solution'
    );
    if (!rmCampaign) {
      const rmSeed = seed.reviewCampaigns.find((r) => r.slug === 'rm-solution-reviews');
      if (rmSeed) {
        db.reviewCampaigns.unshift(rmSeed);
        mutated = true;
      }
    } else {
      if (!rmCampaign.googleReviewUrl) {
        rmCampaign.googleReviewUrl = 'https://g.page/r/CdT-R2IpVtpnEBM/review';
        mutated = true;
      }
      if (!rmCampaign.contactPhone) {
        rmCampaign.contactPhone = '7400342769';
        mutated = true;
      }
      if (!rmCampaign.qrCodeId) {
        rmCampaign.qrCodeId = '00000000-0000-4000-8000-000000000076';
        mutated = true;
      }
      if (rmCampaign.reviewAgentEnabled === undefined) {
        rmCampaign.reviewAgentEnabled = true;
        mutated = true;
      }
      if (!rmCampaign.defaultLanguage) {
        rmCampaign.defaultLanguage = 'en';
        mutated = true;
      }
      if (!Array.isArray(rmCampaign.supportedLanguages)) {
        rmCampaign.supportedLanguages = ['en', 'hi', 'mr'];
        mutated = true;
      }
    }
  }

  // Ensure the dedicated RM Solution Google Review QR code exists in db.qrCodes and encodes the public HTTPS Google Review URL
  const rmReviewQrId = '00000000-0000-4000-8000-000000000076';
  const rmCampForQr = db.reviewCampaigns.find(
    (r) => r.slug === 'rm-solution-reviews' || r.businessName.toLowerCase() === 'rm solution'
  );
  const targetGoogleUrl =
    rmCampForQr?.googleReviewUrl || 'https://g.page/r/CdT-R2IpVtpnEBM/review';
  const existingRmQr = db.qrCodes.find(
    (q) => q.id === rmReviewQrId || q.slug === 'rm-solution-google-review'
  );
  if (!existingRmQr) {
    const now = new Date().toISOString();
    db.qrCodes.unshift({
      id: rmReviewQrId,
      organizationId: rmCampForQr?.organizationId || '00000000-0000-4000-8000-000000000010',
      folderId: '00000000-0000-4000-8000-000000000020',
      campaignId: null,
      name: 'RM Solution — Official Google Review QR',
      description: 'Direct Google Review QR code for RM Solution (https://g.page/r/CdT-R2IpVtpnEBM/review)',
      slug: 'rm-solution-google-review',
      qrType: 'static',
      contentType: 'google_review',
      status: 'active',
      encodedContent: targetGoogleUrl,
      destinationUrl: targetGoogleUrl,
      routingRules: [],
      styleConfig: {
        ...DEFAULT_QR_STYLE,
        fgColor: '#0B0F19',
        bgColor: '#FFFFFF',
        eyeColor: '#7C3AED',
        pattern: 'rounded',
        eyeStyle: 'rounded',
        frameStyle: 'banner_bottom',
        frameText: 'REVIEW US ON GOOGLE',
        frameColor: '#7C3AED',
      },
      tags: ['google-reviews', 'rm-solution'],
      scanCount: 0,
      humanScanCount: 0,
      lastScannedAt: null,
      createdBy: '00000000-0000-4000-8000-000000000002',
      createdAt: now,
      updatedAt: now,
    });
    mutated = true;
  } else if (existingRmQr.encodedContent !== targetGoogleUrl) {
    existingRmQr.encodedContent = targetGoogleUrl;
    existingRmQr.destinationUrl = targetGoogleUrl;
    mutated = true;
  }

  // Ensure the linked QR code for the seeded Saffron AI Concierge exists if saffron-concierge is present
  const defaultAgent = db.aiAgents.find((a) => a.slug === 'saffron-concierge');
  if (
    defaultAgent &&
    defaultAgent.qrCodeId &&
    !db.qrCodes.some((q) => q.id === defaultAgent.qrCodeId || q.slug === 'saffron-ai')
  ) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const now = new Date().toISOString();
    db.qrCodes.push({
      id: defaultAgent.qrCodeId,
      organizationId: defaultAgent.organizationId,
      folderId: '00000000-0000-4000-8000-000000000020',
      campaignId: '00000000-0000-4000-8000-000000000030',
      name: 'Saffron & Slate AI Concierge QR',
      description: 'Dynamic QR linked to our public AI Agent chat page (/agent/saffron-concierge)',
      slug: 'saffron-ai',
      qrType: 'dynamic',
      contentType: 'ai_agent',
      status: 'active',
      encodedContent: `${appUrl}/r/saffron-ai`,
      destinationUrl: '/agent/saffron-concierge',
      routingRules: [],
      styleConfig: {
        ...DEFAULT_QR_STYLE,
        fgColor: '#0B0F19',
        eyeColor: '#7C3AED',
        pattern: 'rounded',
        eyeStyle: 'rounded',
        frameStyle: 'banner_bottom',
        frameText: 'ASK AI CONCIERGE',
        frameColor: '#7C3AED',
      },
      tags: ['ai-agent', 'concierge'],
      scanCount: 0,
      humanScanCount: 0,
      lastScannedAt: null,
      createdBy: defaultAgent.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    mutated = true;
  }

  return mutated;
}

let memoryDbCache: DatabaseSchema | null = null;
let lastSupabaseHydratedAt = 0;

function tryWriteLocalJsonFile(data: DatabaseSchema): void {
  // Never fail on read-only serverless filesystems (such as Vercel /var/task)
  if (process.env.VERCEL === '1') {
    return;
  }
  try {
    const dbPath = getDbFilePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${dbPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, dbPath);
  } catch {
    // Ignore EROFS / read-only filesystem errors in serverless environments
  }
}

export function readDb(): DatabaseSchema {
  const dbPath = getDbFilePath();
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (ensureBackwardCompatibleCollections(parsed)) {
        tryWriteLocalJsonFile(parsed);
      }
      memoryDbCache = parsed;
      return parsed;
    }
  } catch {
    // Fall through to memoryDbCache or seed initialization
  }

  if (memoryDbCache) {
    ensureBackwardCompatibleCollections(memoryDbCache);
    return memoryDbCache;
  }

  const seed = createInitialSeedData();
  ensureBackwardCompatibleCollections(seed);
  memoryDbCache = seed;
  tryWriteLocalJsonFile(seed);
  return seed;
}

export function writeDb(data: DatabaseSchema): void {
  memoryDbCache = data;
  tryWriteLocalJsonFile(data);

  if (getSupabaseConfigStatus().configured) {
    void syncStateToSupabase(data);
  }
}

export function mutateDb<T>(mutator: (db: DatabaseSchema) => T): T {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

/**
 * Asynchronously reads the database, hydrating from Supabase PostgreSQL first when configured.
 * CRITICAL SAFETY GUARANTEE:
 * - NEVER automatically initializes, seeds, or writes to remote Supabase on read.
 * - Handles errors, unapplied migrations, network failures, and empty states without overwriting data.
 */
export async function readDbAsync(): Promise<DatabaseSchema> {
  const sbStatus = getSupabaseConfigStatus();
  if (sbStatus.configured) {
    const now = Date.now();
    // Refresh from Supabase if cache is empty or older than 2 seconds
    if (!memoryDbCache || now - lastSupabaseHydratedAt > 2000) {
      const loadResult = await loadStateFromSupabase();
      if (loadResult.status === 'ok') {
        ensureBackwardCompatibleCollections(loadResult.data);
        memoryDbCache = loadResult.data;
        lastSupabaseHydratedAt = now;
        tryWriteLocalJsonFile(loadResult.data);
        return loadResult.data;
      }

      // If remote state is genuinely empty, return local readDb() in memory WITHOUT automatically overwriting remote Supabase
      if (loadResult.status === 'empty') {
        const local = readDb();
        memoryDbCache = local;
        return local;
      }

      // If Supabase encountered an error, missing table, or network failure:
      // DO NOT overwrite remote data with initial seed!
      if (loadResult.status === 'missing_table' || loadResult.status === 'error') {
        console.warn(`[RMQR Database] Supabase query notice: ${loadResult.error}. Using local/cached state without remote overwrite.`);
      }
    }
    if (memoryDbCache) {
      return memoryDbCache;
    }
  }

  return readDb();
}

/**
 * Explicit, guarded, idempotent initialization for Supabase PostgreSQL.
 * Only writes to Supabase if the remote state is confirmed 'empty' AND confirmed is explicitly true.
 */
export async function initializeSupabaseDatabase(options: {
  confirmed: boolean;
  sourceDb?: DatabaseSchema;
}): Promise<{ ok: boolean; status: string; message: string }> {
  if (!options.confirmed) {
    return {
      ok: false,
      status: 'unconfirmed',
      message: 'Explicit confirmation (confirmed: true) is required to initialize remote database.',
    };
  }

  const sbStatus = getSupabaseConfigStatus();
  if (!sbStatus.configured) {
    return {
      ok: false,
      status: 'unconfigured',
      message: 'Supabase credentials are not configured in environment.',
    };
  }

  const loadResult = await loadStateFromSupabase();
  if (loadResult.status === 'ok') {
    return {
      ok: false,
      status: 'already_initialized',
      message: 'Remote Supabase database already contains existing state. Refusing to overwrite.',
    };
  }

  if (loadResult.status === 'missing_table') {
    return {
      ok: false,
      status: 'missing_table',
      message: `Cannot initialize: rmqr_app_state table does not exist (${loadResult.error}). Please apply database migrations first.`,
    };
  }

  if (loadResult.status === 'error') {
    return {
      ok: false,
      status: 'error',
      message: `Cannot initialize: error checking remote database state (${loadResult.error}).`,
    };
  }

  // Remote database is confirmed empty
  const stateToSync = options.sourceDb || readDb();
  const syncResult = await syncStateToSupabase(stateToSync);
  if (syncResult.ok) {
    memoryDbCache = stateToSync;
    lastSupabaseHydratedAt = Date.now();
    return {
      ok: true,
      status: 'initialized',
      message: 'Supabase PostgreSQL database successfully initialized.',
    };
  }

  return {
    ok: false,
    status: 'sync_failed',
    message: syncResult.error || 'Failed to sync initial state to Supabase.',
  };
}

/**
 * Asynchronously mutates the database and awaits persistence to Supabase PostgreSQL when configured.
 * Guarantees serverless functions on Vercel do not terminate before the Supabase write finishes.
 * Throws or reports errors on write failures when running in production with Supabase configured.
 */
export async function mutateDbAsync<T>(
  mutator: (db: DatabaseSchema) => T | Promise<T>
): Promise<T> {
  const db = await readDbAsync();
  const result = await mutator(db);
  memoryDbCache = db;
  tryWriteLocalJsonFile(db);

  if (getSupabaseConfigStatus().configured) {
    const syncRes = await syncStateToSupabase(db);
    if (!syncRes.ok) {
      console.error('[RMQR Database] Failed to persist state to Supabase PostgreSQL:', syncRes.error);
      if (process.env.VERCEL === '1') {
        throw new Error(`Database persistence error on Vercel: ${syncRes.error || 'Failed to sync state to Supabase'}`);
      }
    } else {
      lastSupabaseHydratedAt = Date.now();
    }
  }

  return result;
}

/**
 * Server-side Row Level Security (RLS) & RBAC enforcement.
 * Ensures a user belongs to the target organization with one of the allowed roles.
 */
export function assertOrgAccess(
  db: DatabaseSchema,
  userId: string | null | undefined,
  organizationId: string,
  allowedRoles: OrgRole[] = ['owner', 'admin', 'editor', 'viewer']
): { profile: Profile; organization: Organization; role: OrgRole } {
  if (!userId) {
    throw new AuthorizationError('Authentication required.', 401);
  }

  const profile = db.profiles.find((p) => p.id === userId);
  if (!profile) {
    throw new AuthorizationError('Authenticated profile not found.', 401);
  }

  const organization = db.organizations.find((o) => o.id === organizationId);
  if (!organization) {
    throw new AuthorizationError('Organization not found.', 404);
  }

  if (organization.status === 'suspended' && !profile.isSuperAdmin) {
    throw new AuthorizationError(
      'This organization workspace is currently suspended. Contact support.',
      403
    );
  }

  if (profile.isSuperAdmin) {
    return { profile, organization, role: 'owner' };
  }

  const membership = db.organizationMembers.find(
    (m) =>
      m.organizationId === organizationId &&
      m.userId === userId &&
      m.status === 'active'
  );

  if (!membership) {
    throw new AuthorizationError(
      'Forbidden: You do not have access to this organization workspace.',
      403
    );
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new AuthorizationError(
      `Forbidden: Role "${membership.role}" is not permitted to perform this action. Required: ${allowedRoles.join(', ')}.`,
      403
    );
  }

  return { profile, organization, role: membership.role };
}

/**
 * Enforces subscription plan entitlements on the server before creating new tenant resources.
 */
export function assertPlanEntitlement(
  db: DatabaseSchema,
  organizationId: string,
  resource: 'dynamicQrCodes' | 'landingPages' | 'menus' | 'reviewCampaigns' | 'aiAgents' | 'teamMembers'
): void {
  const sub = db.subscriptions.find((s) => s.organizationId === organizationId);
  const planId = sub?.planId || 'free';
  const plan = PLAN_ENTITLEMENTS[planId];

  if (resource === 'dynamicQrCodes') {
    const count = db.qrCodes.filter(
      (q) => q.organizationId === organizationId && q.qrType === 'dynamic' && q.status !== 'archived'
    ).length;
    if (count >= plan.limits.dynamicQrCodes) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.dynamicQrCodes} active Dynamic QR codes. Upgrade your plan in Billing to create more.`,
        402
      );
    }
  } else if (resource === 'landingPages') {
    const count = db.landingPages.filter((l) => l.organizationId === organizationId).length;
    if (count >= plan.limits.landingPages) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.landingPages} Landing Pages. Upgrade your plan in Billing.`,
        402
      );
    }
  } else if (resource === 'menus') {
    const count = db.menus.filter((m) => m.organizationId === organizationId).length;
    if (count >= plan.limits.menus) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.menus} Digital Menus. Upgrade your plan in Billing.`,
        402
      );
    }
  } else if (resource === 'reviewCampaigns') {
    const count = db.reviewCampaigns.filter((r) => r.organizationId === organizationId).length;
    if (count >= plan.limits.reviewCampaigns) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.reviewCampaigns} Google Review Flows. Upgrade your plan in Billing.`,
        402
      );
    }
  } else if (resource === 'aiAgents') {
    const count = (db.aiAgents || []).filter((a) => a.organizationId === organizationId).length;
    if (count >= plan.limits.aiAgents) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.aiAgents} AI Agent QR assistants. Upgrade your plan in Billing.`,
        402
      );
    }
  } else if (resource === 'teamMembers') {
    const count = db.organizationMembers.filter(
      (m) => m.organizationId === organizationId && m.status !== 'revoked'
    ).length;
    if (count >= plan.limits.teamMembers) {
      throw new AuthorizationError(
        `Plan limit reached: The ${plan.name} plan supports up to ${plan.limits.teamMembers} workspace members. Upgrade your plan in Billing.`,
        402
      );
    }
  }
}

export function appendAuditLog(
  db: DatabaseSchema,
  params: {
    organizationId?: string | null;
    actorId?: string | null;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }
): void {
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: params.organizationId || null,
    actorId: params.actorId || null,
    actorEmail: params.actorEmail,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString(),
  });
  // Keep audit log bounded to latest 1000 entries
  if (db.auditLogs.length > 1000) {
    db.auditLogs.length = 1000;
  }
}

/**
 * Prunes expired anonymous customer review sessions (older than expiresAt / 24h)
 * and caps the total session list to 200 entries so anonymous customer conversations
 * are never retained indefinitely.
 */
export function pruneExpiredReviewSessions(db: DatabaseSchema): boolean {
  if (!Array.isArray(db.customerReviewSessions)) {
    db.customerReviewSessions = [];
    return true;
  }
  const nowMs = Date.now();
  const initialLen = db.customerReviewSessions.length;
  db.customerReviewSessions = db.customerReviewSessions
    .filter((s) => {
      if (!s.expiresAt) return false;
      const exp = new Date(s.expiresAt).getTime();
      return !Number.isNaN(exp) && exp > nowMs;
    })
    .slice(0, 200);
  return db.customerReviewSessions.length !== initialLen;
}

/**
 * Resolves a ReviewCampaign by slug, supporting both `/review/rm-solution` and
 * `/review/rm-solution-reviews` for RM Solution without breaking existing links.
 */
export function findReviewCampaignBySlug(
  db: DatabaseSchema,
  slugInput: string
): ReviewCampaign | undefined {
  const clean = (slugInput || '').trim().toLowerCase();
  if (!clean) return undefined;

  const exact = db.reviewCampaigns.find((r) => r.slug.toLowerCase() === clean);
  if (exact) return exact;

  if (clean === 'rm-solution' || clean === 'rm-solution-reviews') {
    return db.reviewCampaigns.find(
      (r) =>
        r.slug.toLowerCase() === 'rm-solution-reviews' ||
        r.slug.toLowerCase() === 'rm-solution' ||
        r.businessName.toLowerCase() === 'rm solution'
    );
  }

  return undefined;
}


