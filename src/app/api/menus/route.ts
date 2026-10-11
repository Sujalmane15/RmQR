import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  assertPlanEntitlement,
  AuthorizationError,
  mutateDb,
  readDb,
} from '@/lib/db/store';
import { generateShortSlug, sanitizeSlug, sanitizeText } from '@/lib/security';
import { extractMenuCandidates } from '@/lib/ai/services';
import { DEFAULT_QR_STYLE, MenuCategory, MenuItem, RestaurantMenu } from '@/lib/types';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id);

    const menus = db.menus
      .filter((m) => m.organizationId === session.activeOrg.id)
      .map((m) => ({
        ...m,
        categories: db.menuCategories
          .filter((c) => c.menuId === m.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
        items: db.menuItems
          .filter((i) => i.menuId === m.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

    return NextResponse.json({ menus });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load menus.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'create_menu';

    // Action 1: AI / OCR Menu Candidate Extraction (returns candidates for human review)
    if (action === 'extract_ai_candidates') {
      const db = readDb();
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      const extraction = await extractMenuCandidates({
        rawMenuText: body.rawMenuText,
        fileName: body.fileName,
        imageBase64: body.imageBase64,
        mimeType: body.mimeType,
      });
      return NextResponse.json(extraction);
    }

    // Action 2: Import human-approved candidate items into a menu
    if (action === 'import_approved_items') {
      const menuId = String(body.menuId || '');
      const approvedItems = Array.isArray(body.items) ? body.items : [];
      if (!menuId || approvedItems.length === 0) {
        return NextResponse.json(
          { error: 'Menu ID and at least one approved item are required.' },
          { status: 400 }
        );
      }

      const result = mutateDb((db) => {
        const menu = db.menus.find((m) => m.id === menuId);
        if (!menu) throw new AuthorizationError('Menu not found.', 404);
        assertOrgAccess(db, session.user.id, menu.organizationId, ['owner', 'admin', 'editor']);

        const now = new Date().toISOString();
        let importedCount = 0;

        for (const item of approvedItems) {
          const catName = sanitizeText(String(item.categoryName || 'General'), 60);
          let cat = db.menuCategories.find(
            (c) => c.menuId === menu.id && c.name.toLowerCase() === catName.toLowerCase()
          );
          if (!cat) {
            cat = {
              id: crypto.randomUUID(),
              menuId: menu.id,
              organizationId: menu.organizationId,
              name: catName,
              description: '',
              sortOrder: db.menuCategories.filter((c) => c.menuId === menu.id).length + 1,
              isAvailable: true,
              createdAt: now,
            };
            db.menuCategories.push(cat);
          }

          const cleanPrice = Math.max(0, Number(item.price) || 0);
          const newItem: MenuItem = {
            id: crypto.randomUUID(),
            menuId: menu.id,
            categoryId: cat.id,
            organizationId: menu.organizationId,
            name: sanitizeText(String(item.name || 'Dish'), 80),
            description: sanitizeText(String(item.description || ''), 240),
            price: cleanPrice,
            isVeg: item.isVeg !== false,
            dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags : [],
            isBestseller: Boolean(item.isBestseller),
            isRecommended: Boolean(item.isRecommended),
            isHighMargin: Boolean(item.isHighMargin),
            showHighMarginBadge: false,
            isTodaysSpecial: Boolean(item.isTodaysSpecial),
            isAvailable: true,
            sortOrder:
              db.menuItems.filter((i) => i.menuId === menu.id && i.categoryId === cat!.id).length + 1,
            createdAt: now,
            updatedAt: now,
          };
          db.menuItems.push(newItem);
          importedCount++;
        }

        menu.updatedAt = now;
        appendAuditLog(db, {
          organizationId: menu.organizationId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'menu.ai_items_imported',
          entityType: 'menu',
          entityId: menu.id,
          metadata: { importedCount },
        });

        return { importedCount };
      });

      return NextResponse.json(result);
    }

    // Action 3: Add a Category
    if (action === 'add_category') {
      const menuId = String(body.menuId || '');
      const name = sanitizeText(body.name, 60);
      if (!menuId || !name) {
        return NextResponse.json({ error: 'Menu ID and category name are required.' }, { status: 400 });
      }
      const createdCat = mutateDb((db) => {
        const menu = db.menus.find((m) => m.id === menuId);
        if (!menu) throw new AuthorizationError('Menu not found.', 404);
        assertOrgAccess(db, session.user.id, menu.organizationId, ['owner', 'admin', 'editor']);
        const cat: MenuCategory = {
          id: crypto.randomUUID(),
          menuId: menu.id,
          organizationId: menu.organizationId,
          name,
          description: sanitizeText(body.description || '', 160),
          sortOrder: db.menuCategories.filter((c) => c.menuId === menu.id).length + 1,
          isAvailable: true,
          createdAt: new Date().toISOString(),
        };
        db.menuCategories.push(cat);
        menu.updatedAt = new Date().toISOString();
        return cat;
      });
      return NextResponse.json({ category: createdCat }, { status: 201 });
    }

    // Action 4: Add a Menu Item
    if (action === 'add_item') {
      const menuId = String(body.menuId || '');
      const categoryId = String(body.categoryId || '');
      const name = sanitizeText(body.name, 80);
      const price = Number(body.price);
      if (!menuId || !categoryId || !name || Number.isNaN(price) || price < 0) {
        return NextResponse.json(
          { error: 'Valid item name, category, and non-negative price are required.' },
          { status: 400 }
        );
      }

      const createdItem = mutateDb((db) => {
        const menu = db.menus.find((m) => m.id === menuId);
        if (!menu) throw new AuthorizationError('Menu not found.', 404);
        assertOrgAccess(db, session.user.id, menu.organizationId, ['owner', 'admin', 'editor']);
        const now = new Date().toISOString();
        const item: MenuItem = {
          id: crypto.randomUUID(),
          menuId: menu.id,
          categoryId,
          organizationId: menu.organizationId,
          name,
          description: sanitizeText(body.description || '', 260),
          price,
          imageUrl: body.imageUrl ? sanitizeText(body.imageUrl, 200000) : undefined,
          isVeg: body.isVeg !== false,
          dietaryTags: Array.isArray(body.dietaryTags)
            ? body.dietaryTags.map((t: string) => sanitizeText(t, 30)).filter(Boolean)
            : [],
          isBestseller: Boolean(body.isBestseller),
          isRecommended: Boolean(body.isRecommended),
          isHighMargin: Boolean(body.isHighMargin),
          showHighMarginBadge: Boolean(body.showHighMarginBadge),
          isTodaysSpecial: Boolean(body.isTodaysSpecial),
          isAvailable: body.isAvailable !== false,
          sortOrder:
            db.menuItems.filter((i) => i.menuId === menu.id && i.categoryId === categoryId).length + 1,
          createdAt: now,
          updatedAt: now,
        };
        db.menuItems.push(item);
        menu.updatedAt = now;
        return item;
      });
      return NextResponse.json({ item: createdItem }, { status: 201 });
    }

    // Default Action: Create a new Restaurant Menu + Linked Dynamic QR
    const restaurantName = sanitizeText(body.restaurantName, 80);
    if (!restaurantName) {
      return NextResponse.json({ error: 'Restaurant name is required.' }, { status: 400 });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const createdMenu = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      assertPlanEntitlement(db, session.activeOrg.id, 'menus');

      let slug = body.slug ? sanitizeSlug(body.slug) : generateShortSlug(restaurantName);
      if (!slug) slug = generateShortSlug('menu');
      if (db.menus.some((m) => m.slug.toLowerCase() === slug.toLowerCase())) {
        slug = generateShortSlug(slug);
      }

      const now = new Date().toISOString();
      const menuId = crypto.randomUUID();
      const qrId = crypto.randomUUID();
      const qrSlug = generateShortSlug(`menu-${slug}`);

      db.qrCodes.unshift({
        id: qrId,
        organizationId: session.activeOrg.id,
        folderId: null,
        campaignId: null,
        name: `${restaurantName} QR Menu`,
        description: `Dynamic QR code for digital menu /m/${slug}`,
        slug: qrSlug,
        qrType: 'dynamic',
        contentType: 'menu',
        status: 'active',
        encodedContent: `${origin}/r/${qrSlug}`,
        destinationUrl: `/m/${slug}`,
        routingRules: [],
        styleConfig: {
          ...DEFAULT_QR_STYLE,
          frameStyle: 'banner_bottom',
          frameText: 'SCAN FOR MENU',
        },
        tags: ['menu', 'restaurant'],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      const defaultCatId = crypto.randomUUID();
      const defaultCategory: MenuCategory = {
        id: defaultCatId,
        menuId,
        organizationId: session.activeOrg.id,
        name: 'Signature Dishes',
        description: 'Our most popular selections',
        sortOrder: 1,
        isAvailable: true,
        createdAt: now,
      };
      db.menuCategories.push(defaultCategory);

      const newMenu: RestaurantMenu = {
        id: menuId,
        organizationId: session.activeOrg.id,
        qrCodeId: qrId,
        slug,
        restaurantName,
        description: sanitizeText(body.description || '', 260),
        currency: sanitizeText(body.currency || 'INR', 8),
        currencySymbol: sanitizeText(body.currencySymbol || '₹', 4),
        themeConfig: {
          primaryColor: sanitizeText(body.themeConfig?.primaryColor || '#7C3AED', 20),
          accentColor: sanitizeText(body.themeConfig?.accentColor || '#10B981', 20),
          layout: body.themeConfig?.layout || 'grid',
        },
        status: body.status === 'published' ? 'published' : 'draft',
        publishedAt: body.status === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
      };

      db.menus.unshift(newMenu);
      return { ...newMenu, categories: [defaultCategory], items: [] };
    });

    return NextResponse.json({ menu: createdMenu }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Menu operation failed.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'update_menu';

    // Update a specific Menu Item (price, availability, Today's Special, badges, etc.)
    if (action === 'update_item') {
      const itemId = String(body.itemId || '');
      const updatedItem = mutateDb((db) => {
        const item = db.menuItems.find((i) => i.id === itemId);
        if (!item) throw new AuthorizationError('Menu item not found.', 404);
        assertOrgAccess(db, session.user.id, item.organizationId, ['owner', 'admin', 'editor']);

        if (body.name !== undefined) item.name = sanitizeText(body.name, 80);
        if (body.description !== undefined) item.description = sanitizeText(body.description, 260);
        if (body.price !== undefined) {
          const p = Number(body.price);
          if (Number.isNaN(p) || p < 0) {
            throw new AuthorizationError('Price must be a valid non-negative number.', 400);
          }
          item.price = p;
        }
        if (body.isVeg !== undefined) item.isVeg = Boolean(body.isVeg);
        if (body.isBestseller !== undefined) item.isBestseller = Boolean(body.isBestseller);
        if (body.isRecommended !== undefined) item.isRecommended = Boolean(body.isRecommended);
        if (body.isHighMargin !== undefined) item.isHighMargin = Boolean(body.isHighMargin);
        if (body.showHighMarginBadge !== undefined)
          item.showHighMarginBadge = Boolean(body.showHighMarginBadge);
        if (body.isTodaysSpecial !== undefined) item.isTodaysSpecial = Boolean(body.isTodaysSpecial);
        if (body.isAvailable !== undefined) item.isAvailable = Boolean(body.isAvailable);
        if (body.sortOrder !== undefined) item.sortOrder = Number(body.sortOrder);

        item.updatedAt = new Date().toISOString();

        const menu = db.menus.find((m) => m.id === item.menuId);
        if (menu) menu.updatedAt = item.updatedAt;

        return item;
      });
      return NextResponse.json({ item: updatedItem });
    }

    // Update Restaurant Menu profile or publish/unpublish status
    const menuId = String(body.menuId || body.id || '');
    const updatedMenu = mutateDb((db) => {
      const menu = db.menus.find((m) => m.id === menuId);
      if (!menu) throw new AuthorizationError('Menu not found.', 404);
      assertOrgAccess(db, session.user.id, menu.organizationId, ['owner', 'admin', 'editor']);

      if (body.restaurantName !== undefined) {
        menu.restaurantName = sanitizeText(body.restaurantName, 80);
      }
      if (body.description !== undefined) {
        menu.description = sanitizeText(body.description, 260);
      }
      if (body.currencySymbol !== undefined) {
        menu.currencySymbol = sanitizeText(body.currencySymbol, 6);
      }
      if (body.status === 'draft' || body.status === 'published') {
        menu.status = body.status;
        if (body.status === 'published') {
          menu.publishedAt = new Date().toISOString();
        }
      }
      if (body.themeConfig) {
        menu.themeConfig = {
          ...menu.themeConfig,
          ...body.themeConfig,
        };
      }
      menu.updatedAt = new Date().toISOString();
      return menu;
    });

    return NextResponse.json({ menu: updatedMenu });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update menu.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const categoryId = searchParams.get('categoryId');

    mutateDb((db) => {
      if (itemId) {
        const item = db.menuItems.find((i) => i.id === itemId);
        if (!item) throw new AuthorizationError('Item not found.', 404);
        assertOrgAccess(db, session.user.id, item.organizationId, ['owner', 'admin', 'editor']);
        db.menuItems = db.menuItems.filter((i) => i.id !== itemId);
        return;
      }
      if (categoryId) {
        const cat = db.menuCategories.find((c) => c.id === categoryId);
        if (!cat) throw new AuthorizationError('Category not found.', 404);
        assertOrgAccess(db, session.user.id, cat.organizationId, ['owner', 'admin', 'editor']);
        db.menuCategories = db.menuCategories.filter((c) => c.id !== categoryId);
        db.menuItems = db.menuItems.filter((i) => i.categoryId !== categoryId);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
