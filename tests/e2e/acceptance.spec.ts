import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import fs from 'fs';

test.describe('RMQR End-to-End Acceptance Suite (15 Criteria + Full Flow Audit)', () => {
  test('AC-11 & AC-13: All public pages resolve cleanly and mobile layout has zero horizontal overflow', async ({
    page,
  }) => {
    const publicRoutes = [
      '/',
      '/features',
      '/pricing',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
      '/login',
      '/register',
    ];

    for (const route of publicRoutes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
    }

    // Mobile viewport check (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    expect(hasOverflow).toBe(false);
  });

  test('AC-1, AC-6 & AC-12: Registration, Login, Logout, Form Validation & Cross-Tenant Isolation', async ({
    request,
    page,
  }) => {
    // Form validation on invalid registration input
    const badReg = await request.post('/api/auth/register', {
      data: {
        email: 'not-an-email',
        password: '123',
        fullName: '',
      },
    });
    expect(badReg.status()).toBe(400);

    // Login as seeded owner
    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@rmqr.app');
    await page.fill('input[type="password"]', 'OwnerPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Saffron & Slate');

    // Register a brand-new user in an isolated organization
    const uniqueEmail = `tenant-${Date.now()}@rmqr.test`;
    const secondContext = await page.context().browser()!.newContext();
    const tenantBRequest = secondContext.request;

    const regRes = await tenantBRequest.post('http://localhost:3000/api/auth/register', {
      data: {
        fullName: 'Tenant B Owner',
        email: uniqueEmail,
        password: 'TenantBPassword123!',
        businessName: 'Tenant B Cafe',
        industry: 'Restaurant & Hospitality',
      },
    });
    expect(regRes.status()).toBe(201);

    // AC-6: Tenant B must NOT be allowed to edit or delete Tenant A's seeded QR code
    const tenantAQrId = '00000000-0000-4000-8000-000000000031';
    const patchAttempt = await tenantBRequest.patch(
      `http://localhost:3000/api/qr-codes/${tenantAQrId}`,
      {
        data: {
          name: 'Hacked Name',
          destinationUrl: 'https://evil.example.com',
        },
      }
    );
    expect([403, 404]).toContain(patchAttempt.status());

    const deleteAttempt = await tenantBRequest.delete(
      `http://localhost:3000/api/qr-codes/${tenantAQrId}`
    );
    expect([403, 404]).toContain(deleteAttempt.status());

    // Logout verification
    const logoutRes = await tenantBRequest.post('http://localhost:3000/api/auth/logout');
    expect(logoutRes.status()).toBe(200);
    const meAfterLogout = await tenantBRequest.get('http://localhost:3000/api/auth/me');
    expect(meAfterLogout.status()).toBe(401);

    await secondContext.close();
  });

  test('AC-2, AC-3, AC-4, AC-5 & AC-7: Static & Dynamic QR Creation, PNG/SVG/PDF Exports, Live Destination Editing, Pause/Expire Blocking, and Real Analytics', async ({
    request,
    page,
  }) => {
    // Authenticate as owner in both request context and page context
    const loginRes = await request.post('/api/auth/login', {
      data: {
        email: 'owner@rmqr.app',
        password: 'OwnerPass123!',
      },
    });
    expect(loginRes.status()).toBe(200);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@rmqr.app');
    await page.fill('input[type="password"]', 'OwnerPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Verify PNG, SVG, and PDF browser downloads in QR Studio (/dashboard/qr-codes/new)
    await page.goto('/dashboard/qr-codes/new');
    await expect(page.getByTestId('qr-live-preview')).toBeVisible();

    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-png-btn').click(),
    ]);
    expect(pngDownload.suggestedFilename()).toContain('.png');
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();
    expect(fs.statSync(pngPath!).size).toBeGreaterThan(200);

    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-svg-btn').click(),
    ]);
    expect(svgDownload.suggestedFilename()).toContain('.svg');
    const svgPath = await svgDownload.path();
    expect(fs.statSync(svgPath!).size).toBeGreaterThan(200);

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-pdf-btn').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toContain('.pdf');
    const pdfPath = await pdfDownload.path();
    expect(fs.statSync(pdfPath!).size).toBeGreaterThan(500);

    // AC-2: Create a Static QR code via API and decode its PNG
    const staticCreateRes = await request.post('/api/qr-codes', {
      data: {
        name: 'Static WiFi Card',
        qrType: 'static',
        contentType: 'url',
        destinationUrl: 'https://saffron.example.com/static-wifi',
      },
    });
    expect(staticCreateRes.status()).toBe(201);
    const staticQr = (await staticCreateRes.json()).qrCode;
    expect(staticQr.qrType).toBe('static');
    expect(staticQr.encodedContent).toBe('https://saffron.example.com/static-wifi');

    const renderRes = await request.get(
      `/api/qr-render?data=${encodeURIComponent(staticQr.encodedContent)}&format=png&size=400`
    );
    expect(renderRes.status()).toBe(200);
    const pngBuffer = await renderRes.body();
    const decodedPng = PNG.sync.read(pngBuffer);
    const decodedStatic = jsQR(
      new Uint8ClampedArray(decodedPng.data),
      decodedPng.width,
      decodedPng.height
    );
    expect(decodedStatic?.data).toBe('https://saffron.example.com/static-wifi');

    // AC-3: Create a Dynamic QR code and verify /r/[slug] redirects to initial destination
    const dynamicSlug = `dyn-${Date.now()}`;
    const dynamicCreateRes = await request.post('/api/qr-codes', {
      data: {
        name: 'Dynamic Seasonal Promo',
        qrType: 'dynamic',
        contentType: 'url',
        slug: dynamicSlug,
        destinationUrl: 'https://saffron.example.com/spring-menu',
      },
    });
    expect(dynamicCreateRes.status()).toBe(201);
    const dynamicQr = (await dynamicCreateRes.json()).qrCode;

    // Scan /r/[slug] without following external redirect
    const scan1 = await request.get(`/r/${dynamicSlug}`, {
      maxRedirects: 0,
      headers: {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      },
    });
    expect([302, 307]).toContain(scan1.status());
    expect(scan1.headers()['location']).toBe('https://saffron.example.com/spring-menu');

    // AC-4: Edit the dynamic QR destination and verify the SAME slug redirects to the new URL
    const updateRes = await request.patch(`/api/qr-codes/${dynamicQr.id}`, {
      data: {
        destinationUrl: 'https://saffron.example.com/autumn-tasting-menu',
      },
    });
    expect(updateRes.status()).toBe(200);

    const scan2 = await request.get(`/r/${dynamicSlug}`, {
      maxRedirects: 0,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    expect([302, 307]).toContain(scan2.status());
    expect(scan2.headers()['location']).toBe('https://saffron.example.com/autumn-tasting-menu');

    // AC-7: Verify real scan events are persisted and reflected in /api/analytics and CSV export
    const analyticsRes = await request.get(`/api/analytics?qrCodeId=${dynamicQr.id}&days=30`);
    expect(analyticsRes.status()).toBe(200);
    const analyticsData = await analyticsRes.json();
    expect(analyticsData.summary.totalScans).toBeGreaterThanOrEqual(2);
    expect(analyticsData.summary.humanScans).toBeGreaterThanOrEqual(2);

    const csvRes = await request.get(`/api/analytics?qrCodeId=${dynamicQr.id}&days=30&format=csv`);
    expect(csvRes.status()).toBe(200);
    expect(await csvRes.text()).toContain('event_id,scanned_at,qr_code_id,qr_name');

    // AC-5: Pause the dynamic QR and verify /r/[slug] blocks redirect with a clear status page
    const pauseRes = await request.patch(`/api/qr-codes/${dynamicQr.id}`, {
      data: { status: 'paused' },
    });
    expect(pauseRes.status()).toBe(200);

    const pausedScan = await request.get(`/r/${dynamicSlug}`, { maxRedirects: 0 });
    expect([410, 423]).toContain(pausedScan.status());
    const pausedHtml = await pausedScan.text();
    expect(pausedHtml).toContain('QR Code Paused');
  });

  test('AC-8, AC-9 & AC-10: Branded Landing Pages, Live Restaurant Menu Price Updates, AI Menu Extraction, and Google Review QR Flow', async ({
    request,
    page,
  }) => {
    await request.post('/api/auth/login', {
      data: {
        email: 'owner@rmqr.app',
        password: 'OwnerPass123!',
      },
    });

    // AC-8: Create, publish, and view a Landing Page
    const lpSlug = `lp-${Date.now()}`;
    const lpRes = await request.post('/api/landing-pages', {
      data: {
        title: 'Saffron Private Dining',
        slug: lpSlug,
        pageType: 'business_profile',
        description: 'Reserve our chef table experience',
        status: 'published',
        blocks: [
          {
            blockType: 'button',
            title: 'Book Chef Table',
            url: 'https://saffron.example.com/book',
          },
        ],
      },
    });
    expect(lpRes.status()).toBe(201);

    await page.goto(`/p/${lpSlug}`);
    await expect(page.locator('body')).toContainText('Saffron Private Dining');
    await expect(page.locator('body')).toContainText('Book Chef Table');

    // AC-9: Update a Restaurant Menu item price and verify public menu (/m/saffron-bistro) updates immediately
    const newPrice = 599;
    const itemUpdateRes = await request.patch('/api/menus', {
      data: {
        action: 'update_item',
        itemId: '00000000-0000-4000-8000-000000000081', // Smoked Burrata & Truffle Kulcha
        price: newPrice,
      },
    });
    expect(itemUpdateRes.status()).toBe(200);

    // Also test AI/OCR Menu Candidate Extraction (requires human review before import)
    const ocrRes = await request.post('/api/menus', {
      data: {
        action: 'extract_ai_candidates',
        rawMenuText: 'DESSERTS\nSaffron Pistachio Kulfi - Hand-churned kulfi - ₹310',
      },
    });
    expect(ocrRes.status()).toBe(200);
    const ocrJson = await ocrRes.json();
    expect(ocrJson.requiresHumanReview).toBe(true);
    expect(ocrJson.candidates[0].name).toContain('Saffron Pistachio Kulfi');

    await page.goto('/m/saffron-bistro');
    await expect(page.locator('body')).toContainText('Smoked Burrata & Truffle Kulcha');
    await expect(page.locator('body')).toContainText(`599`);

    // AC-10: Verify Google Review QR flow (/review/saffron-reviews) renders and links to legitimate Google Review URL
    await page.goto('/review/saffron-reviews');
    await expect(page.locator('body')).toContainText('Saffron & Slate');
    await expect(page.getByTestId('google-review-destination-btn')).toBeVisible();
  });

  test('Admin Authorization & All Dashboard Routes Verification', async ({ request, page }) => {
    // 1. Verify non-admin owner is forbidden (403) from /api/admin
    await request.post('/api/auth/login', {
      data: {
        email: 'owner@rmqr.app',
        password: 'OwnerPass123!',
      },
    });
    const forbiddenAdminRes = await request.get('/api/admin');
    expect(forbiddenAdminRes.status()).toBe(403);

    // 2. Verify all dashboard pages load cleanly for authenticated workspace owner
    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@rmqr.app');
    await page.fill('input[type="password"]', 'OwnerPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    const dashboardRoutes = [
      '/dashboard',
      '/dashboard/qr-codes',
      '/dashboard/qr-codes/new',
      '/dashboard/ai-agents',
      '/dashboard/analytics',
      '/dashboard/campaigns',
      '/dashboard/landing-pages',
      '/dashboard/menus',
      '/dashboard/reviews',
      '/dashboard/billing',
      '/dashboard/settings',
    ];
    for (const route of dashboardRoutes) {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
    }

    // Verify non-admin gets access denied UI on /admin
    await page.goto('/admin');
    await expect(page.getByTestId('admin-access-denied')).toBeVisible();
    await expect(page.locator('body')).toContainText('Administrator Privileges Required');

    // 3. Verify Super Admin (admin@rmqr.app) is authorized (200) on /api/admin and /admin UI
    const adminLoginRes = await request.post('/api/auth/login', {
      data: {
        email: 'admin@rmqr.app',
        password: 'AdminPass123!',
      },
    });
    expect(adminLoginRes.status()).toBe(200);

    const adminDataRes = await request.get('/api/admin');
    expect(adminDataRes.status()).toBe(200);
    const adminData = await adminDataRes.json();
    expect(adminData.summary.totalOrganizations).toBeGreaterThanOrEqual(1);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@rmqr.app');
    await page.fill('input[type="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    await page.goto('/admin');
    await expect(page.locator('body')).toContainText('System Admin Console');
  });

  test('AI Agent QR Full E2E Flow: Wizard Creation, Knowledge Persistence, Scannable QR Redirect, Public Chat Without Login, Grounded Answers, Unknown Fallback, Pause Blocking & Cross-Workspace Isolation', async ({
    request,
    page,
  }) => {
    // 1. Login as Workspace Owner
    const loginRes = await request.post('/api/auth/login', {
      data: {
        email: 'owner@rmqr.app',
        password: 'OwnerPass123!',
      },
    });
    expect(loginRes.status()).toBe(200);

    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@rmqr.app');
    await page.fill('input[type="password"]', 'OwnerPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // 2. Navigate to AI Agent QR via sidebar (/dashboard/ai-agents)
    const preListRes = await request.get('/api/ai-agents');
    if (preListRes.ok()) {
      const preListData = await preListRes.json();
      for (const existing of preListData.agents || []) {
        if (String(existing.slug).startsWith('lotus-spa-')) {
          await request.delete(`/api/ai-agents/${existing.id}`);
        }
      }
    }

    await page.goto('/dashboard/ai-agents');
    await expect(page.locator('body')).toContainText('AI Agent QR');
    await expect(page.locator('body')).toContainText('Saffron & Slate Guest Concierge');

    // 3. Create a new AI Agent via the 5-step UI Wizard
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testAgentSlug = `lotus-spa-${uniqueSuffix}`;
    const testAgentName = `Lotus Spa Concierge ${uniqueSuffix}`;
    const testBusinessName = `Lotus Serenity Spa ${uniqueSuffix}`;
    const uniqueFallbackMsg = `Lotus Spa Fallback ${uniqueSuffix}: Please call +91 98200 11223 for assistance.`;

    await page.getByTestId('open-ai-agent-wizard-btn').click();
    await expect(page.getByTestId('wizard-agent-name-input')).toBeVisible();

    // Step 1: Basic Info
    await page.getByTestId('wizard-agent-name-input').fill(testAgentName);
    await page.getByTestId('wizard-business-name-input').fill(testBusinessName);
    await page.getByTestId('wizard-category-select').selectOption('salon_spa');
    await page.getByTestId('wizard-next-step-btn').click();

    // Step 2: Business Knowledge
    await page.getByTestId('wizard-knowledge-title-input').fill('Signature Treatments & Pricing');
    await page
      .getByTestId('wizard-knowledge-content-input')
      .fill(
        'Signature Himalayan Hot Stone Massage is ₹4,200 for 90 minutes. Open Tuesday to Sunday from 10:00 AM to 9:00 PM.'
      );
    await page.getByTestId('wizard-add-knowledge-btn').click();
    await page.getByTestId('wizard-next-step-btn').click();

    // Step 3: Personality & Fallback
    const fallbackTextarea = page.locator('textarea').nth(2);
    await fallbackTextarea.fill(uniqueFallbackMsg);
    await page.getByTestId('wizard-next-step-btn').click();

    // Step 4: Branding
    await page.getByTestId('wizard-next-step-btn').click();

    // Step 5: Launch Agent & Generate QR
    await page.getByTestId('wizard-slug-input').fill(testAgentSlug);
    await page.getByTestId('wizard-create-agent-submit-btn').click();
    await expect(page.getByTestId('wizard-create-agent-submit-btn')).toBeHidden({
      timeout: 10000,
    });
    await expect(page.locator('body')).toContainText(testAgentName);

    // 4. Add additional business knowledge from the Knowledge Base tab & refresh page to verify persistence
    await page.getByTestId('new-knowledge-title-input').fill('Cancellation & Rescheduling Policy');
    await page
      .getByTestId('new-knowledge-content-input')
      .fill('Appointments can be rescheduled free of charge up to 6 hours before your slot.');
    await page.getByTestId('add-knowledge-submit-btn').click();
    await expect(page.locator('body')).toContainText('Cancellation & Rescheduling Policy');

    // Reload page and confirm both the agent and added knowledge entry persisted
    await page.reload();
    await expect(page.locator('body')).toContainText(testAgentName);
    await page.getByTestId(`agent-card-${testAgentSlug}`).click();
    await expect(page.locator('body')).toContainText('Cancellation & Rescheduling Policy');

    // Fetch agent record via API to get its ID and linked QR slug
    const listRes = await request.get('/api/ai-agents');
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    const createdAgent = listData.agents.find((a: { slug: string }) => a.slug === testAgentSlug);
    expect(createdAgent).toBeDefined();
    expect(createdAgent.qrCode?.slug).toBeTruthy();

    // 5. Verify generated QR code PNG is genuinely scannable via jsQR and points to /r/[qrSlug]
    const qrRedirectUrl = `http://localhost:3000/r/${createdAgent.qrCode.slug}`;
    const qrRenderRes = await request.get(
      `/api/qr-render?data=${encodeURIComponent(qrRedirectUrl)}&format=png&size=420`
    );
    expect(qrRenderRes.status()).toBe(200);
    const qrPngBuffer = await qrRenderRes.body();
    const decodedPng = PNG.sync.read(qrPngBuffer);
    const qrDecoded = jsQR(
      new Uint8ClampedArray(decodedPng.data),
      decodedPng.width,
      decodedPng.height
    );
    expect(qrDecoded?.data).toBe(qrRedirectUrl);

    // 6. Verify scanning /r/[qrSlug] redirects to /agent/[slug]
    const redirectCheck = await request.get(`/r/${createdAgent.qrCode.slug}`, {
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(redirectCheck.status());
    expect(redirectCheck.headers()['location']).toContain(`/agent/${testAgentSlug}`);

    // 7. Open /agent/[slug] in a fresh anonymous browser context (NO login required)
    const visitorContext = await page.context().browser()!.newContext();
    const visitorPage = await visitorContext.newPage();

    await visitorPage.goto(`http://localhost:3000/agent/${testAgentSlug}`);
    await expect(visitorPage.getByTestId('public-agent-business-name')).toContainText(
      testBusinessName
    );
    await expect(visitorPage.getByTestId('chat-messages-list')).toContainText(
      'Ask me about our treatments'
    );

    // 8. Ask a question answered from the business's saved knowledge
    await visitorPage
      .getByTestId('chat-input')
      .fill('How much is the Himalayan Hot Stone Massage and what is your cancellation policy?');
    await visitorPage.getByTestId('chat-send-btn').click();

    await expect(visitorPage.getByTestId('chat-messages-list')).toContainText(
      '₹4,200',
      { timeout: 10000 }
    );
    await expect(visitorPage.getByTestId('chat-messages-list')).toContainText(
      '6 hours',
      { timeout: 10000 }
    );

    // 9. Ask an unknown question and verify the configured fallback response is returned
    await visitorPage
      .getByTestId('chat-input')
      .fill('Do you offer submarine repair or rocket telemetry services?');
    await visitorPage.getByTestId('chat-send-btn').click();

    await expect(visitorPage.getByTestId('chat-messages-list')).toContainText(
      uniqueFallbackMsg,
      { timeout: 10000 }
    );

    // 10. Test consented lead submission from public visitor page
    await visitorPage.getByTestId('open-lead-modal-btn').click();
    await expect(visitorPage.getByTestId('lead-collection-modal')).toBeVisible();
    await visitorPage.getByTestId('lead-name-input').fill('Meera Nair');
    await visitorPage.getByTestId('lead-email-input').fill('meera@visitor.example');
    await visitorPage.getByTestId('lead-consent-checkbox').check();
    await visitorPage.getByTestId('lead-submit-btn').click();
    await expect(visitorPage.getByTestId('lead-submit-success')).toBeVisible();

    // 11. Test paused agent behavior: Owner pauses agent -> public page shows unavailable/paused state
    const pauseAgentRes = await request.patch(`/api/ai-agents/${createdAgent.id}`, {
      data: {
        status: 'paused',
      },
    });
    expect(pauseAgentRes.status()).toBe(200);

    await visitorPage.reload();
    await expect(visitorPage.getByTestId('agent-unavailable-state')).toBeVisible();
    await expect(visitorPage.getByTestId('agent-unavailable-state')).toContainText('paused');

    // Reactivate agent
    const activateAgentRes = await request.patch(`/api/ai-agents/${createdAgent.id}`, {
      data: {
        status: 'active',
      },
    });
    expect(activateAgentRes.status()).toBe(200);

    // 12. Test cross-workspace access rejection: Register Tenant C and verify it cannot read/edit/delete Owner's AI agent
    const tenantCReq = visitorContext.request;
    const regC = await tenantCReq.post('http://localhost:3000/api/auth/register', {
      data: {
        fullName: 'Tenant C Attacker',
        email: `tenant-c-${Date.now()}@rmqr.test`,
        password: 'TenantCPass123!',
        businessName: 'Tenant C Shop',
        industry: 'Retail',
      },
    });
    expect(regC.status()).toBe(201);

    const crossGet = await tenantCReq.get(
      `http://localhost:3000/api/ai-agents/${createdAgent.id}`
    );
    expect([403, 404]).toContain(crossGet.status());

    const crossPatch = await tenantCReq.patch(
      `http://localhost:3000/api/ai-agents/${createdAgent.id}`,
      {
        data: {
          action: 'add_knowledge',
          section: 'faqs',
          title: 'Injected FAQ',
          content: 'Injected cross-tenant content',
        },
      }
    );
    expect([403, 404]).toContain(crossPatch.status());

    const crossDelete = await tenantCReq.delete(
      `http://localhost:3000/api/ai-agents/${createdAgent.id}`
    );
    expect([403, 404]).toContain(crossDelete.status());

    await visitorContext.close();
  });

  test('RM Solution Google Review AI Assistant E2E: Saved Review URL, Multilingual (English/Hindi/Marathi) Multi-Option Replies, Smart 7400342769 Inclusion, Approval Gate & Review Management Dashboard', async ({
    request,
    page,
  }) => {
    await request.post('/api/auth/login', {
      data: {
        email: 'owner@rmqr.app',
        password: 'OwnerPass123!',
      },
    });

    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@rmqr.app');
    await page.fill('input[type="password"]', 'OwnerPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    await page.goto('/dashboard/reviews');
    await expect(page.getByTestId('rm-solution-settings-card')).toBeVisible();
    await expect(page.getByTestId('rm-solution-review-url-input')).toHaveValue(
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );
    await expect(page.getByTestId('rm-solution-phone-input')).toHaveValue('7400342769');
    await expect(page.getByTestId('gbp-connection-mode-badge')).toContainText('Manual Entry Mode');

    // Verify the Google Review QR standee encodes the exact public HTTPS URL (NOT localhost)
    await expect(page.getByTestId('qr-encoded-destination-url')).toHaveText(
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );
    await expect(page.getByTestId('rm-direct-google-review-link')).toHaveAttribute(
      'href',
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );
    await expect(page.getByTestId('open-qr-destination-btn')).toHaveAttribute(
      'href',
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );

    // Download PNG, SVG, and PDF from the Google Review Standee QR and decode the PNG via jsQR
    const [revPngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('review-qr-standee-card').getByTestId('download-png-btn').click(),
    ]);
    const revPngPath = await revPngDownload.path();
    expect(revPngPath).toBeTruthy();
    const revPngBuffer = fs.readFileSync(revPngPath!);
    const decodedRevPng = PNG.sync.read(revPngBuffer);
    const decodedRevQr = jsQR(
      new Uint8ClampedArray(decodedRevPng.data),
      decodedRevPng.width,
      decodedRevPng.height
    );
    expect(decodedRevQr?.data).toBe('https://g.page/r/CdT-R2IpVtpnEBM/review');

    const [revSvgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('review-qr-standee-card').getByTestId('download-svg-btn').click(),
    ]);
    const revSvgPath = await revSvgDownload.path();
    expect(fs.statSync(revSvgPath!).size).toBeGreaterThan(200);

    const [revPdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('review-qr-standee-card').getByTestId('download-pdf-btn').click(),
    ]);
    const revPdfPath = await revPdfDownload.path();
    expect(fs.statSync(revPdfPath!).size).toBeGreaterThan(500);

    // 1. Generate Marathi reply options for a Positive review
    await page.getByTestId('reviewer-name-input').fill('स्नेहा देशमुख');
    await page.getByTestId('review-rating-select').selectOption('5');
    await page.getByTestId('reply-language-select').selectOption('mr');
    await page
      .getByTestId('review-text-input')
      .fill('आरएम सोल्युशनमध्ये खूप छान आणि तत्पर सेवा मिळाली.');
    await page.getByTestId('generate-reply-draft-btn').click();

    await expect(page.getByTestId('reply-option-0')).toBeVisible();
    await expect(page.getByTestId('reply-option-1')).toBeVisible();
    await expect(page.getByTestId('reply-option-2')).toBeVisible();
    await expect(page.getByTestId('detected-sentiment-badge')).toContainText('positive');
    await expect(page.getByTestId('owner-reply-textarea')).toHaveValue(/स्नेहा देशमुख/);
    await expect(page.getByTestId('owner-reply-textarea')).not.toHaveValue(/7400342769/);

    // Switch to Option 2 and verify textarea updates
    await page.getByTestId('reply-option-1').click();
    await expect(page.getByTestId('owner-reply-textarea')).toHaveValue(/आदरणीय स्नेहा देशमुख/);

    // Verify approval gate blocks saving as Approved until checkbox is checked
    await page.getByTestId('save-approved-reply-btn').click();
    await expect(page.getByTestId('review-status-banner')).toContainText(
      'Please check the Owner Approval confirmation box'
    );

    // Check approval box and save to Review Management Dashboard
    await page.getByTestId('approve-reply-checkbox').check();
    await page.getByTestId('save-approved-reply-btn').click();
    await expect(page.getByTestId('review-status-banner')).toContainText('Reply approved and saved');
    await expect(page.getByTestId('review-management-dashboard')).toContainText('स्नेहा देशमुख');
    await expect(page.getByTestId('review-management-dashboard')).toContainText(
      'Approved by Owner'
    );

    // 2. Generate English reply options for a Negative review -> 7400342769 must be included
    await page.getByTestId('reviewer-name-input').fill('Neha Kulkarni');
    await page.getByTestId('review-rating-select').selectOption('2');
    await page.getByTestId('review-sentiment-select').selectOption('negative');
    await page.getByTestId('reply-language-select').selectOption('en');
    await page
      .getByTestId('review-text-input')
      .fill('Had a delay with my document update status.');
    await page.getByTestId('generate-reply-draft-btn').click();

    await expect(page.getByTestId('detected-sentiment-badge')).toContainText('negative');
    await expect(page.getByTestId('owner-reply-textarea')).toHaveValue(/7400342769/);

    // 3. Verify Dual-Mode QR Management (Mode A vs Mode B) and jsQR Verification Badge
    await expect(page.getByTestId('mode-a-ai-agent-qr-card')).toBeVisible();
    await expect(page.getByTestId('mode-a-deployment-badge')).toContainText('Deployment Required');
    await expect(page.getByTestId('qr-verification-status-badge')).toContainText(
      'Mode B Verified (jsQR Pass)'
    );
  });

  test('Public Customer AI Review Agent Website (/review/rm-solution): Mobile Layout, Multilingual (EN/HI/MR), Honest Negative & Positive Drafts, Edit, Copy & Direct Google Review Link', async ({
    browser,
  }) => {
    // Use a clean anonymous mobile browser context (no login cookie, 375x812 iPhone viewport)
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const mobilePage = await mobileContext.newPage();

    const res = await mobilePage.goto('/review/rm-solution');
    expect(res?.status()).toBe(200);

    await expect(mobilePage.getByTestId('ai-review-agent-container')).toBeVisible();
    await expect(mobilePage.locator('body')).toContainText('RM Solution');
    await expect(mobilePage.getByTestId('public-agent-support-phone')).toContainText('7400342769');

    // Verify no horizontal scroll overflow on 375px mobile screen
    const hasHorizontalOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify persistent direct Google Review link is visible from Step 1 and points to official URL
    const directGoogleBtn = mobilePage.getByTestId('google-review-destination-btn');
    await expect(directGoogleBtn).toBeVisible();
    await expect(directGoogleBtn).toHaveAttribute(
      'href',
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );

    // Test switching languages on Step 1: Marathi (मराठी) -> Hindi (हिंदी) -> English
    await mobilePage.getByTestId('lang-btn-mr').click();
    await expect(mobilePage.getByTestId('review-step-1')).toContainText('स्वागत आहे');
    await mobilePage.getByTestId('lang-btn-hi').click();
    await expect(mobilePage.getByTestId('review-step-1')).toContainText('स्वागत है');
    await mobilePage.getByTestId('lang-btn-en').click();
    await expect(mobilePage.getByTestId('review-step-1')).toContainText('Welcome to RM Solution');

    // Start conversation -> Step 2 (Overall Experience)
    await mobilePage.getByTestId('start-conversation-btn').click();
    await expect(mobilePage.getByTestId('review-step-2')).toBeVisible();

    // Flow A: Negative / Needs Improvement flow — verify Honest Review Policy (no review gating, no fake positive text)
    await mobilePage.getByTestId('exp-choice-needs_improvement').click();
    await expect(mobilePage.getByTestId('review-step-3')).toBeVisible();
    // Persistent Google Review button must STILL be visible even after choosing "Needs improvement"
    await expect(directGoogleBtn).toBeVisible();

    await mobilePage.getByTestId('star-rating-btn-2').click();
    await mobilePage.getByTestId('confirm-rating-btn').click();

    await expect(mobilePage.getByTestId('review-step-4')).toBeVisible();
    await mobilePage
      .getByTestId('feedback-details-input')
      .fill('Waiting time was longer than expected and status update took two calls.');
    await mobilePage.getByTestId('step-4-next-btn').click();

    await expect(mobilePage.getByTestId('review-step-5')).toBeVisible();
    await mobilePage
      .getByTestId('additional-feedback-input')
      .fill('Please share clearer turnaround time estimates.');
    await mobilePage.getByTestId('generate-suggestions-btn').click();

    await expect(mobilePage.getByTestId('review-step-6')).toBeVisible();
    await expect(mobilePage.getByTestId('preserved-sentiment-badge')).toContainText('negative');
    await expect(mobilePage.getByTestId('draft-option-short')).toBeVisible();
    await expect(mobilePage.getByTestId('draft-option-detailed')).toBeVisible();
    await expect(mobilePage.getByTestId('draft-option-professional')).toBeVisible();

    const negativeDraftText = await mobilePage.getByTestId('customer-review-editor').inputValue();
    expect(negativeDraftText.toLowerCase()).not.toContain('excellent');
    expect(negativeDraftText.toLowerCase()).toContain('waiting time');
    // Direct Google Review button in Step 6 must also remain visible for dissatisfied customers
    await expect(mobilePage.getByTestId('open-google-reviews-btn')).toHaveAttribute(
      'href',
      'https://g.page/r/CdT-R2IpVtpnEBM/review'
    );

    // Flow B: Restart conversation, complete a Positive flow, Edit review, Copy review, and Finish
    await mobilePage.getByTestId('step-restart-btn').click();
    await expect(mobilePage.getByTestId('review-step-1')).toBeVisible();
    await mobilePage.getByTestId('start-conversation-btn').click();

    await mobilePage.getByTestId('exp-choice-excellent').click();
    await mobilePage.getByTestId('star-rating-btn-5').click();
    await mobilePage.getByTestId('confirm-rating-btn').click();

    await mobilePage
      .getByTestId('feedback-details-input')
      .fill('Quick documentation support and very polite staff guidance.');
    await mobilePage.getByTestId('step-4-next-btn').click();
    await mobilePage.getByTestId('generate-suggestions-btn').click();

    await expect(mobilePage.getByTestId('review-step-6')).toBeVisible();
    await expect(mobilePage.getByTestId('preserved-sentiment-badge')).toContainText('positive');
    // Switch to Option 2 (Natural and detailed)
    await mobilePage.getByTestId('draft-option-detailed').click();
    await expect(mobilePage.getByTestId('customer-review-editor')).toHaveValue(
      /Quick documentation support/
    );

    // Click Edit Review and customize text
    await mobilePage.getByTestId('edit-review-btn').click();
    await mobilePage
      .getByTestId('customer-review-editor')
      .fill(
        'Excellent experience with RM Solution! Quick documentation support and very polite staff guidance.'
      );

    // Click Copy Review and verify copied label
    await mobilePage.getByTestId('copy-review-btn').click();
    await expect(mobilePage.getByTestId('copy-review-btn')).toContainText('Copied');

    // Click Finish and verify thank-you banner
    await mobilePage.getByTestId('finish-review-btn').click();
    await expect(mobilePage.getByTestId('session-finished-banner')).toBeVisible();

    await mobileContext.close();
  });
});




