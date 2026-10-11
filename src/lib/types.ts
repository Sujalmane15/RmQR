// =============================================================================
// RMQR — Core Domain Types & Plan Entitlements
// =============================================================================

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type PlanId = 'free' | 'pro' | 'business';

export type QRType = 'static' | 'dynamic';

export type QRContentType =
  | 'url'
  | 'text'
  | 'email'
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'wifi'
  | 'vcard'
  | 'location'
  | 'google_review'
  | 'menu'
  | 'social'
  | 'file'
  | 'landing_page'
  | 'ai_agent';

export type QRStatus = 'active' | 'paused' | 'expired' | 'archived';

export type QRPatternType = 'square' | 'dots' | 'rounded' | 'classy';
export type QREyeStyle = 'square' | 'rounded' | 'circle';
export type QRFrameStyle = 'none' | 'banner_bottom' | 'banner_top' | 'card' | 'review_badge' | 'menu_standee';

export interface QRStyleConfig {
  fgColor: string;
  bgColor: string;
  pattern: QRPatternType;
  eyeStyle: QREyeStyle;
  eyeColor?: string;
  frameStyle: QRFrameStyle;
  frameText?: string;
  frameColor?: string;
  logoDataUrl?: string;
  logoSizeRatio?: number; // 0.12 to 0.28
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number; // Quiet zone modules (recommended >= 4)
}

export interface QRRoutingRule {
  id: string;
  type: 'device' | 'time' | 'ab';
  condition: string; // e.g., 'ios' | 'android' | 'desktop' | '09:00-17:00' | '50%'
  destinationUrl: string;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
  resetToken?: string;
  resetTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string;
  logoUrl?: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  customDomain?: string;
  whiteLabelEnabled: boolean;
  status: 'active' | 'suspended';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId?: string;
  invitedEmail: string;
  role: OrgRole;
  status: 'active' | 'invited' | 'revoked';
  createdAt: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  paymentProvider?: 'stripe' | 'razorpay' | 'manual';
  externalSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  organizationId: string;
  planId: PlanId;
  amountInr: number;
  amountUsd: number;
  status: 'paid' | 'pending' | 'failed';
  billingCycle: 'monthly' | 'annual';
  description: string;
  createdAt: string;
}

export interface QRFolder {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface QRCodeRecord {
  id: string;
  organizationId: string;
  folderId?: string | null;
  campaignId?: string | null;
  name: string;
  description: string;
  slug: string;
  qrType: QRType;
  contentType: QRContentType;
  status: QRStatus;
  encodedContent: string; // For static: raw payload; for dynamic: /r/[slug] full URL
  destinationUrl?: string; // For dynamic QRs: target URL
  fallbackUrl?: string;
  expiresAt?: string | null;
  passwordHash?: string | null;
  routingRules: QRRoutingRule[];
  styleConfig: QRStyleConfig;
  tags: string[];
  scanCount: number;
  humanScanCount: number;
  lastScannedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QRDestinationHistory {
  id: string;
  qrCodeId: string;
  organizationId: string;
  destinationUrl: string;
  isActive: boolean;
  weight: number;
  deviceRule?: 'all' | 'ios' | 'android' | 'desktop';
  createdBy: string;
  createdAt: string;
}

export interface QRScanEvent {
  id: string;
  qrCodeId: string;
  organizationId: string;
  campaignId?: string | null;
  scannedAt: string;
  visitorHash: string;
  isBot: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'other';
  os: string;
  browser: string;
  country: string;
  region: string;
  referrer: string;
  destinationResolved: string;
}

export type LandingPageType =
  | 'link_in_bio'
  | 'business_profile'
  | 'product_service'
  | 'contact_card'
  | 'event'
  | 'restaurant_menu'
  | 'promotion'
  | 'google_review';

export interface LandingPageBlock {
  id: string;
  landingPageId: string;
  organizationId: string;
  blockType: 'button' | 'text' | 'image' | 'hours' | 'map' | 'whatsapp' | 'social';
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  sortOrder: number;
  clickCount: number;
  isEnabled: boolean;
}

export interface LandingPage {
  id: string;
  organizationId: string;
  qrCodeId?: string | null;
  slug: string;
  title: string;
  description: string;
  pageType: LandingPageType;
  status: 'draft' | 'published';
  themeConfig: {
    primaryColor: string;
    bgColor: string;
    textColor: string;
    logoUrl?: string;
    coverUrl?: string;
    buttonStyle: 'rounded' | 'pill' | 'sharp';
  };
  socialLinks: Array<{ platform: string; url: string }>;
  contactInfo: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    website?: string;
    openingHours?: string;
  };
  viewCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  id: string;
  organizationId: string;
  businessName: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  googleReviewUrl: string;
  googlePlaceId: string;
  logoUrl?: string;
  coverUrl?: string;
  openingHours: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type ReviewReplyLanguage = 'en' | 'hi' | 'mr';
export type ReviewSentiment = 'positive' | 'neutral' | 'negative';
export type ReviewReplyTone = 'warm' | 'professional' | 'apologetic' | 'concise';
export type ExperienceLevel = 'excellent' | 'good' | 'average' | 'needs_improvement';

export interface CustomerReviewDraftOption {
  id: 'short' | 'detailed' | 'professional';
  label: string;
  text: string;
}

export interface CustomerReviewSession {
  id: string;
  sessionToken: string;
  organizationId: string;
  campaignId: string;
  slug: string;
  language: ReviewReplyLanguage;
  experienceLevel?: ExperienceLevel;
  starRating?: number | null;
  feedbackDetails?: string;
  selectedTopics?: string[];
  additionalFeedback?: string;
  draftOptions: CustomerReviewDraftOption[];
  selectedDraft?: string;
  aiProviderUsed?: 'gemini' | 'openai' | 'grounded_fallback';
  regenerationCount: number;
  status: 'in_progress' | 'drafts_ready' | 'copied' | 'google_opened' | 'completed';
  googleReviewSubmitted: false;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface ReviewCampaign {
  id: string;
  organizationId: string;
  businessProfileId?: string | null;
  qrCodeId?: string | null;
  slug: string;
  name: string;
  businessName: string;
  googleReviewUrl: string;
  contactPhone?: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  brandColor: string;
  logoUrl?: string;
  suggestedHighlights: string[];
  aiDraftsEnabled: boolean;
  reviewAgentEnabled?: boolean;
  defaultLanguage?: ReviewReplyLanguage;
  supportedLanguages?: ReviewReplyLanguage[];
  scanCount: number;
  googleClickCount: number;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewResponseLogItem {
  id: string;
  organizationId: string;
  campaignId?: string | null;
  businessName: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  sentiment: ReviewSentiment;
  language: ReviewReplyLanguage;
  tone: ReviewReplyTone;
  replyOptions: string[];
  selectedReply: string;
  includeContactPhone: boolean;
  contactPhoneUsed?: string;
  approvalStatus: 'draft' | 'approved';
  approvedAt?: string | null;
  approvedBy?: string | null;
  gbpPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  menuId: string;
  organizationId: string;
  name: string;
  description: string;
  sortOrder: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  menuId: string;
  categoryId: string;
  organizationId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isVeg: boolean;
  dietaryTags: string[];
  isBestseller: boolean;
  isRecommended: boolean;
  isHighMargin: boolean;
  showHighMarginBadge: boolean;
  isTodaysSpecial: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantMenu {
  id: string;
  organizationId: string;
  qrCodeId?: string | null;
  slug: string;
  restaurantName: string;
  description: string;
  currency: string;
  currencySymbol: string;
  logoUrl?: string;
  coverUrl?: string;
  themeConfig: {
    primaryColor: string;
    accentColor: string;
    layout: 'grid' | 'list' | 'classic';
  };
  status: 'draft' | 'published';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedAsset {
  id: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
  assetType: 'logo' | 'menu_image' | 'cover' | 'ocr_upload' | 'document';
  createdBy: string;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  organizationId?: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
}

export type AIAgentCategory =
  | 'restaurant_cafe'
  | 'retail_shop'
  | 'salon_spa'
  | 'real_estate'
  | 'hotel_hospitality'
  | 'professional_services'
  | 'education_training'
  | 'general_business';

export type AIAgentStatus = 'active' | 'paused' | 'inactive';

export type AIAgentTone =
  | 'friendly_professional'
  | 'warm_hospitality'
  | 'concise_direct'
  | 'formal_executive';

export type AIKnowledgeSection =
  | 'about'
  | 'products_services'
  | 'pricing'
  | 'opening_hours'
  | 'faq'
  | 'policies'
  | 'contact'
  | 'menu_items'
  | 'custom_facts';

export interface AIAgentRecord {
  id: string;
  organizationId: string;
  qrCodeId?: string | null;
  slug: string;
  status: AIAgentStatus;

  // Step A — Basic Information
  agentName: string;
  businessName: string;
  businessCategory: AIAgentCategory;
  businessDescription: string;
  websiteUrl?: string;
  phone?: string;
  address?: string;
  defaultLanguage: string;
  supportedLanguages: string[];

  // Step B — Optional Safe Workspace Knowledge Links
  linkedMenuId?: string | null;
  linkedLandingPageId?: string | null;

  // Step C — Personality & Behavior
  tone: AIAgentTone;
  responseLength: 'concise' | 'detailed';
  welcomeMessage: string;
  suggestedQuestions: string[];
  customInstructions: string;
  fallbackUnknownMessage: string;
  leadCollectionEnabled: boolean;
  humanContactUrl?: string;
  whatsappNumber?: string;

  // Step D — Branding
  logoUrl?: string;
  brandColor: string;
  welcomeTitle: string;
  chatbotDisplayName: string;
  contactButtonLabel?: string;

  // Usage Statistics & Timestamps
  conversationCount: number;
  messageCount: number;
  leadCount: number;
  knowledgeUpdatedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIKnowledgeEntry {
  id: string;
  agentId: string;
  organizationId: string;
  section: AIKnowledgeSection;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversation {
  id: string;
  agentId: string;
  organizationId: string;
  visitorSessionId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  status: 'active' | 'closed';
}

export interface AIMessage {
  id: string;
  conversationId: string;
  agentId: string;
  organizationId: string;
  role: 'user' | 'assistant';
  content: string;
  providerUsed?: 'gemini' | 'openai' | 'knowledge_grounded_local' | 'unconfigured';
  groundedSources?: string[];
  createdAt: string;
}

export interface AILeadRecord {
  id: string;
  agentId: string;
  organizationId: string;
  conversationId?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
  consentGiven: boolean;
  consentText: string;
  createdAt: string;
}

export interface PlanEntitlement {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceInr: number;
  annualPriceInr: number;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  limits: {
    dynamicQrCodes: number;
    monthlyScanEvents: number;
    landingPages: number;
    menus: number;
    reviewCampaigns: number;
    aiAgents: number;
    monthlyAiMessages: number;
    teamMembers: number;
    bulkRowLimit: number;
    storageMb: number;
    customDomains: boolean;
    apiAccess: boolean;
    smartRouting: boolean;
  };
  features: string[];
}

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlement> = {
  free: {
    id: 'free',
    name: 'Free Starter',
    tagline: 'For individuals and small shops testing QR workflows',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    limits: {
      dynamicQrCodes: 5,
      monthlyScanEvents: 1000,
      landingPages: 2,
      menus: 1,
      reviewCampaigns: 1,
      aiAgents: 2,
      monthlyAiMessages: 300,
      teamMembers: 1,
      bulkRowLimit: 10,
      storageMb: 25,
      customDomains: false,
      apiAccess: false,
      smartRouting: false,
    },
    features: [
      'Unlimited Static QR Codes',
      'Up to 5 Dynamic QR Codes',
      '1,000 Tracked Scans / month',
      '2 AI Agent QR Assistants (300 msgs/mo)',
      '1 Digital Restaurant Menu',
      '1 Google Review Growth QR',
      '2 Mobile Landing Pages',
      'PNG & SVG Exports',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Growth',
    tagline: 'For growing restaurants, clinics, retailers & agencies',
    monthlyPriceInr: 799,
    annualPriceInr: 649,
    monthlyPriceUsd: 15,
    annualPriceUsd: 12,
    limits: {
      dynamicQrCodes: 100,
      monthlyScanEvents: 50000,
      landingPages: 25,
      menus: 10,
      reviewCampaigns: 10,
      aiAgents: 15,
      monthlyAiMessages: 5000,
      teamMembers: 5,
      bulkRowLimit: 100,
      storageMb: 500,
      customDomains: true,
      apiAccess: true,
      smartRouting: true,
    },
    features: [
      'Everything in Free',
      '100 Dynamic QR Codes',
      '50,000 Tracked Scans / month',
      '15 AI Agent QR Assistants (5,000 msgs/mo)',
      '10 Digital Menus + AI Menu Import',
      '10 Google Review Growth Flows + AI Reply Drafts',
      'Bulk CSV Generation & ZIP Export',
      'Print-Ready PDF Export & Custom Frames',
      'Password-Protected & Expiring QRs',
      '5 Workspace Team Members',
    ],
  },
  business: {
    id: 'business',
    name: 'Business Scale',
    tagline: 'For multi-location brands, franchises, and enterprise teams',
    monthlyPriceInr: 2499,
    annualPriceInr: 1999,
    monthlyPriceUsd: 49,
    annualPriceUsd: 39,
    limits: {
      dynamicQrCodes: 1000,
      monthlyScanEvents: 500000,
      landingPages: 200,
      menus: 100,
      reviewCampaigns: 100,
      aiAgents: 100,
      monthlyAiMessages: 50000,
      teamMembers: 25,
      bulkRowLimit: 500,
      storageMb: 5000,
      customDomains: true,
      apiAccess: true,
      smartRouting: true,
    },
    features: [
      'Everything in Pro',
      '1,000 Dynamic QR Codes',
      '500,000 Tracked Scans / month',
      '100 AI Agent QR Assistants (50,000 msgs/mo)',
      'Smart Device & Time-Based Multi-URL Routing',
      'Custom Domains & White-Label Branding',
      'Scoped REST API Keys & Webhooks',
      '25 Team Members with RBAC & Audit Logs',
      'Priority Support',
    ],
  },
};

export const DEFAULT_QR_STYLE: QRStyleConfig = {
  fgColor: '#0B0F19',
  bgColor: '#FFFFFF',
  pattern: 'square',
  eyeStyle: 'square',
  eyeColor: '#7C3AED',
  frameStyle: 'none',
  frameText: 'SCAN ME',
  frameColor: '#7C3AED',
  logoSizeRatio: 0.2,
  errorCorrectionLevel: 'M',
  margin: 4,
};

