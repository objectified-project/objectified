import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { NextAuthOptions } from 'next-auth';

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
            name: 'Credentials',
            credentials: {},
            async authorize(credentials: any, req) {
                console.log('Logging in', credentials, req);

                // const result = await credentialsSignIn(credentials);
                //
                // if (result && result.id) {
                //     return {
                //         id: result.id,
                //         emailAddress: result.email_address,
                //         access: result.access,
                //         lastLogin: result.lastLogin ?? new Date().toISOString(),
                //         license: result.license,
                //     };
                // }
                //
                return null;
            }
        })
    ],
    pages: {
        signIn: '/login',
        error: '/login',
    },
    callbacks: {
        // signIn: async function ({user, account, profile, email, credentials}) {
        //     if (!account || !account.provider) {
        //         console.log('[next-auth::signIn] No account or provider found');
        //         return '/login?error=Login failure';
        //     }
        //
        //     const { provider } = account;
        //
        //     console.log(`[next-auth::signIn] provider=${provider}`);
        //
        //     if (provider === 'github') {
        //         return await githubSignin(user);
        //     } else if (provider === 'google') {
        //         return await googleSignin(user);
        //     } else if (provider === 'gitlab') {
        //         return await gitlabSignin(user);
        //     } else if (provider === 'credentials') {
        //         const userObject = (user as any);
        //
        //         if (userObject.access && userObject.id) {
        //             console.log(`[next-auth::signIn] login for user ${userObject.emailAddress} succeeded: ${userObject.access} access`);
        //             return true;
        //         } else if (!userObject.access && userObject.id) {
        //             console.log(`[next-auth::signIn] login for user ${userObject.emailAddress} succeeded, but missing 'access' type: free/paid`);
        //             return false;
        //         }
        //     }
        //
        //     console.log(`[next-auth::signIn] login for user failed: no such user found`, user);
        //
        //     return '/login?error=Unauthorized';
        // },
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
        // async session({ session, token, user }) {
        //     console.log(`[next-auth::session]: session=${JSON.stringify(session, null, 2)} user=${JSON.stringify(user, null, 2)} token=${JSON.stringify(token, null, 2)}`);
        //
        //     // Set session variables if not set, and the token contains the data necessary.
        //     (session as any).objectified = token.objectified;
        //     (session as any).currentTenant = token.currentTenant || null;
        //
        //     if (token.currentProject && token.currentProject === 'unset') {
        //         console.log('[next-auth::session] resetting currentProject to null, as it was set to "unset"');
        //         (session as any).currentProject = null;
        //     } else {
        //         (session as any).currentProject = token.currentProject || null;
        //     }
        //
        //     (session as any).currentVersion = token.currentVersion || null;
        //
        //     return session;
        // },
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
