import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';
import { credentialsAuthorize, credentialsSignIn, ICredentials } from '../../../../../lib/auth/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
  // GithubProvider({
  //     clientId: process.env.GITHUB_ID as string,
  //     clientSecret: process.env.GITHUB_SECRET as string,
  // }),
  // GitlabProvider({
  //     clientId: process.env.GITLAB_CLIENT_ID as string,
  //     clientSecret: process.env.GITLAB_CLIENT_SECRET as string,
  // }),
  // GoogleProvider({
  //     clientId: process.env.GOOGLE_CLIENT_ID as string,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  // }),
    CredentialsProvider({
      credentials: {},
      async authorize(credentials: any, req) {
        const credentialPayload = JSON.parse(credentials?.payload ?? '{}');

        return await credentialsAuthorize(credentialPayload as ICredentials);
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    signIn: async function (payload: any) {
      const user = payload.user;
      const loginProvider = payload.account?.provider ?? '';

      if (!user) {
        return '/login?error=User account not found';
      }

      // Handle different types of login providers here.
      if (loginProvider === 'credentials') {
        return credentialsSignIn(payload);
      }

      console.log('[signIn] unsupported provider:', loginProvider, 'user:', user, 'payload:', payload);

      return `/login?error=Your login attempt failed, provider "${loginProvider}" is not yet supported`;
    },
    // async redirect({ url, baseUrl }) {
    //     console.log(`[next-auth::redirect]: url=${JSON.stringify(url)} baseUrl=${JSON.stringify(baseUrl)}`);
    //
    //     // Override the login, redirecting to the login page if properly set.
    //     if (url === '/login') {
    //         return baseUrl + '/login';
    //     }
    //
    //     // This flow moves to the tenants page after login succeeds.
    //     if (url === '/tenants') {
    //         return baseUrl + '/tenants';
    //     }
    //
    //     return baseUrl;
    // },
    async session({ session, token, user }: { session: any, token: any, user: any }) {
      session.user.id = token.sub;

      console.log('[session] Returning session:', session);

      // // Set session variables if not set, and the token contains the data necessary.
      // (session as any).objectified = token.objectified;
      // (session as any).currentTenant = token.currentTenant || null;
      //
      // if (token.currentProject && token.currentProject === 'unset') {
      //     console.log('[next-auth::session] resetting currentProject to null, as it was set to "unset"');
      //     (session as any).currentProject = null;
      // } else {
      //     (session as any).currentProject = token.currentProject || null;
      // }
      //
      // (session as any).currentVersion = token.currentVersion || null;

      return session;
    },
    // // @ts-ignore
    // async jwt({ token, user, account, profile, trigger, session }) {
    //     console.log(`[next-auth::jwt]: session=${JSON.stringify(session, null, 2)}`);
    //
    //     if (user) {
    //         token.objectified = user;
    //     }
    //
    //     if (session?.currentTenant) {
    //         token.currentTenant = session.currentTenant;
    //     }
    //
    //     if (session?.currentProject) {
    //         token.currentProject = session.currentProject;
    //     }
    //
    //     if (session?.currentVersion) {
    //         token.currentVersion = session.currentVersion;
    //     }
    //
    //     if (account) {
    //         const email = token?.email;
    //
    //         if (email) {
    //             const user = await getUserByEmail(email)
    //                 .then((x) => {
    //                     if (x.rowCount > 0){
    //                         return x.rows[0];
    //                     }
    //
    //                     return null;
    //                 })
    //                 .catch((e) => {
    //                     console.log('[next-auth::signIn] Error retrieving user by email', e);
    //                     return null;
    //                 });
    //
    //             const license = await getLicense(user.id)
    //                 .then((x) => {
    //                     return x;
    //                 });
    //
    //             token.objectified = {
    //                 // @ts-ignore
    //                 ...token.objectified,
    //                 id: user.id,
    //                 license,
    //             };
    //         }
    //     }
    //
    //     return token;
    // }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
