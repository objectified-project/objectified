import * as helpers from '../../db/helpers';
const bcrypt = require('bcrypt');

export interface ICredentials {
  email: string;
  password: string;
}

export const credentialsSignIn = async (credentials: ICredentials) => {
  console.log('[credentialsSignIn] credentials login for user', credentials);

  // const { emailAddress, password } = credentials as {
  //   emailAddress: string,
  //   password: string,
  // };
  //
  // console.log(`[credentialsSignIn] credentials login for user ${emailAddress}`);
  //
  // const results = await helpers.getUserByEmail(emailAddress);
  //
  // if (results.rowCount > 0) {
  //   const userResult = results.rows[0];
  //   const source = userResult.source.substring(1, userResult.source.length - 1).split(',');
  //   const hashPassword = userResult.password;
  //
  //   if (source.includes('credentials')) {
  //     if (userResult.password) {
  //       try {
  //         if (bcrypt.compareSync(password, hashPassword)) {
  //           console.log(`[credentialsSignIn] credentials login for user ${emailAddress} successful: source=${source}`);
  //
  //           await helpers.updateLastLogin(userResult.id);
  //
  //           const license = await getLicense(userResult.id)
  //             .then((x) => x);
  //
  //           userResult['license'] = license;
  //
  //           return userResult;
  //         }
  //       } catch (e) {
  //         console.log(`Failed to authenticate: possibly misconfigured user in the database for '${emailAddress}'`, results.rows);
  //         return null;
  //       }
  //     } else {
  //       console.log(`[credentialsSignIn] credentials login for user ${emailAddress} failed: no password is set`);
  //       return null;
  //     }
  //   } else {
  //     console.log(`[credentialsSignIn] credentials login for user ${emailAddress} found, source does not ` +
  //       `include 'credentials': source=${source}`);
  //   }
  // }
  //
  // console.log(`[credentialsSignIn] credentials login for user ${emailAddress} not found`);

  return null;
}