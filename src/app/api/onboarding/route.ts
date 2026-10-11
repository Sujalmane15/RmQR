import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { assertOrgAccess, AuthorizationError, mutateDb } from '@/lib/db/store';
import { sanitizeText } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const result = mutateDb((db) => {
      const { profile, organization } = assertOrgAccess(
        db,
        session.user.id,
        session.activeOrg.id,
        ['owner', 'admin', 'editor']
      );

      if (body.businessName) {
        organization.name = sanitizeText(body.businessName, 80);
      }
      if (body.industry) {
        organization.industry = sanitizeText(body.industry, 60);
      }
      if (body.logoUrl !== undefined) {
        organization.logoUrl = sanitizeText(body.logoUrl, 200000);
      }
      if (body.brandPrimaryColor) {
        organization.brandPrimaryColor = sanitizeText(body.brandPrimaryColor, 16);
      }
      if (body.brandSecondaryColor) {
        organization.brandSecondaryColor = sanitizeText(body.brandSecondaryColor, 16);
      }
      if (typeof body.onboardingStep === 'number') {
        profile.onboardingStep = body.onboardingStep;
      }
      if (body.onboardingCompleted !== undefined) {
        profile.onboardingCompleted = Boolean(body.onboardingCompleted);
      }

      organization.updatedAt = new Date().toISOString();
      profile.updatedAt = new Date().toISOString();

      return {
        onboardingStep: profile.onboardingStep,
        onboardingCompleted: profile.onboardingCompleted,
        organization,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update onboarding.' }, { status: 500 });
  }
}
