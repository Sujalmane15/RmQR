// =============================================================================
// RMQR — Persistent Multi-Tenant Database Store & RBAC Authorization Engine
// =============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ApiKeyRecord,
  AuditLog,
  BillingInvoice,
  BusinessProfile,
  Campaign,
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
  Subscription,
  SupportTicket,
  UploadedAsset,
  WebhookEndpoint,
} from '../types';
import { hashPassword } from '../security';

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
  menus: RestaurantMenu[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
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
        scanCount: 0,
        googleClickCount: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ],
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

export function readDb(): DatabaseSchema {
  const dbPath = getDbFilePath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    const seed = createInitialSeedData();
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    const seed = createInitialSeedData();
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

export function writeDb(data: DatabaseSchema): void {
  const dbPath = getDbFilePath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, dbPath);
}

export function mutateDb<T>(mutator: (db: DatabaseSchema) => T): T {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
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
  resource: 'dynamicQrCodes' | 'landingPages' | 'menus' | 'reviewCampaigns' | 'teamMembers'
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
