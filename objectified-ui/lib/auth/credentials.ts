import * as helper from '../db/helper';
const bcrypt = require('bcrypt');

export interface ICredentials {
  email: string;
  password: string;
}

/**
 * Helper function to link GitHub account during OAuth flow
 */
export const linkGithubAccount = async (userId: string, account: any, profile: any) => {
  try {
    console.log('[linkGithubAccount] Linking GitHub account for user:', userId);

    const result = await helper.linkExternalAccount(
      userId,
      'github',
      account.providerAccountId || profile.id,
      profile.email,
      profile.login || profile.username,
      account.access_token || null,
      account.refresh_token || null,
      account.expires_at ? new Date(account.expires_at * 1000) : null,
      {
        name: profile.name,
        avatar_url: profile.avatar_url || profile.picture,
        profile_url: profile.html_url || profile.url,
      }
    );

    const response = JSON.parse(result);
    return response.success;
  } catch (error) {
    console.error('[linkGithubAccount] Error linking account:', error);
    return false;
  }
};

/**
 * Check if this is a linking flow (user already logged in and clicking "Link" button)
 * Note: This function will be called from the OAuth callback
 */
export const checkLinkingIntent = async () => {
  try {
    // Dynamic import of cookies from next/headers
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const linkIntent = cookieStore.get('oauth_link_intent');

    if (linkIntent && linkIntent.value) {
      try {
        const intent = JSON.parse(linkIntent.value);
        // Check if intent is not expired (10 minutes)
        if (Date.now() - intent.timestamp < 600000) {
          // Clear the cookie after reading it
          cookieStore.delete('oauth_link_intent');
          return intent;
        }
      } catch (parseError) {
        console.log('[checkLinkingIntent] Error parsing intent:', parseError);
      }
    }
  } catch (error) {
    console.log('[checkLinkingIntent] Could not check linking intent:', error);
  }

  return null;
};

/*
 * Authorization steps:
 * 1. User is retrieved by e-mail address.
 * 2. Comparison is checked against user password and stored password using bcrypt.
 * 3. If the user login succeeds, the record is returned without the password field.
 * 4. Failure returns a null, which the next-auth `authorize()` handler will interpret as an invalid account.
 */
export const credentialsAuthorize = async (credentials: ICredentials) => {
  console.log('[credentialsAuthorize] credentials login for user', credentials);

  const emailAddress = credentials.email;
  const password = credentials.password;
  const results = await helper.getUserByEmail(credentials.email);

  if (results.rowCount > 0) {
    const userResult = results.rows[0];
    const hashPassword = userResult.password;

    if (userResult.password) {
      if (bcrypt.compareSync(password, hashPassword)) {
        delete userResult.password;

        return userResult;
      }

      console.log(`[credentialsAuthorize] credentials login for user ${emailAddress} failed: password mismatch`);
      return null;
    } else {
      console.log(`[credentialsAuthorize] credentials login for user ${emailAddress} failed: no password is set`);
      return null;
    }
  }

  console.log(`[credentialsAuthorize] credentials login for user ${emailAddress} not found`);

  return null;
}

/*
 * Sign-in Steps:
 * 1. User must exist.
 *    If user is null, return 'User account not found'
 * 2. Enabled must be true.
 *    If not enabled, return 'Your account is currently disabled'
 * 3. Verified must be true.
 *    If not verified, return 'You have not yet verified your account e-mail address'
 *
 * TODO: Check licenses here.
 *
 * If all passes, true is returned.
 */
export const credentialsSignIn = (payload: any) => {
  const user = payload.user;

  console.log('[credentialsSignIn] Handling credentials provider');

  if (!user.enabled) {
    return '/login?error=Your account is currently disabled';
  }

  if (!user.verified) {
    return '/login?error=You have not yet verified your account e-mail address';
  }

  console.log('[credentialsSignIn] Login successful', user.email);

  return true;
}

/*
 * Sign-in Steps for GitHub OAuth:
 * 1. Check if this GitHub account is already linked to a user in external_auth_providers
 *    - If linked, login as that user
 * 2. If not linked, check if user exists by email
 *    - If user exists by email, this is the initial login, proceed normally
 * 3. User must be enabled and verified
 *
 * IMPORTANT: This function modifies payload.user to use the odb.users data instead of GitHub data
 * If all passes, true is returned.
 */
export const credentialsGithub = async (payload: any) => {
  const user = payload.user;
  const account = payload.account;
  const profile = payload.profile;

  console.log('[credentialsGithub] Handling github provider', user, 'account:', account);

  // First, check if this GitHub account is already linked to an existing user
  if (account?.providerAccountId) {
    console.log('[credentialsGithub] Checking for existing linked account with GitHub ID:', account.providerAccountId);

    // Check if this GitHub account is already linked
    const linkedAccountResult = await helper.getLinkedAccountByProvider('github', account.providerAccountId);
    const linkedAccount = JSON.parse(linkedAccountResult);

    if (linkedAccount.found && linkedAccount.account) {
      console.log('[credentialsGithub] Found linked GitHub account for user:', linkedAccount.account.user_id);

      // Get the user by ID (not email, since email might not match)
      const userResults = await helper.getUserById(linkedAccount.account.user_id);

      if (userResults.rowCount > 0) {
        const userResult = userResults.rows[0];

        if (!userResult.enabled) {
          return '/login?error=Your account is currently disabled';
        }

        if (!userResult.verified) {
          return '/login?error=You have not yet verified your account e-mail address';
        }

        // Update last login time for this linked account
        await helper.updateLinkedAccountLastLogin('github', account.providerAccountId);

        // IMPORTANT: Replace the GitHub user data with our database user data
        // This ensures the JWT callback gets the correct odb.users ID, not the GitHub ID
        payload.user.id = userResult.id;
        payload.user.email = userResult.email;
        payload.user.name = userResult.name;
        payload.user.enabled = userResult.enabled;
        payload.user.verified = userResult.verified;

        console.log('[credentialsGithub] Login successful via linked account, user_id:', userResult.id);
        return true;
      }
    }
  }

  // If not linked, check if user exists by email (standard OAuth flow for first-time login)
  const results = await helper.getUserByEmail(user.email);

  if (results.rowCount > 0) {
    const userResult = results.rows[0];

    console.log('[credentialsGithub] Retrieved user record from DB:', userResult);

    if (!userResult.enabled) {
      return '/login?error=Your account is currently disabled';
    }

    if (!userResult.verified) {
      return '/login?error=You have not yet verified your account e-mail address';
    }

    // Auto-link this GitHub account to the user on first successful login
    if (account?.providerAccountId) {
      console.log('[credentialsGithub] Auto-linking GitHub account on first login');
      await linkGithubAccount(userResult.id, account, profile || user);
    }

    // IMPORTANT: Replace the GitHub user data with our database user data
    // This ensures the JWT callback gets the correct odb.users ID, not the GitHub ID
    payload.user.id = userResult.id;
    payload.user.email = userResult.email;
    payload.user.name = userResult.name;
    payload.user.enabled = userResult.enabled;
    payload.user.verified = userResult.verified;

    console.log('[credentialsGithub] Login successful, user_id:', userResult.id);

    return true;
  }

  console.log('[credentialsGithub] User account not found for e-mail address:', user.email);

  return false;
}