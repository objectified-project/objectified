import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../[...nextauth]/route';
import { linkExternalAccount } from '../../../../../../lib/db/helper';

/**
 * API endpoint to link an external OAuth provider account to the currently logged-in user
 * This is called after the OAuth callback when a user is linking an account from the dashboard
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current session to ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !(session.user as any)?.user_id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).user_id;
    const body = await request.json();

    const {
      provider,
      providerUserId,
      providerEmail,
      providerUsername,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      profileData,
    } = body;

    // Validate required fields
    if (!provider || !providerUserId || !providerEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Link the account
    const result = await linkExternalAccount(
      userId,
      provider,
      providerUserId,
      providerEmail,
      providerUsername || null,
      accessToken || null,
      refreshToken || null,
      tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      profileData || null
    );

    const response = JSON.parse(result);

    if (response.success) {
      return NextResponse.json(response, { status: 200 });
    } else {
      return NextResponse.json(response, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error linking account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

