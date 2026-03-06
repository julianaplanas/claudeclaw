/**
 * Run this script once to get your Google OAuth2 refresh token.
 * Usage:
 *   ts-node src/scripts/get-google-token.ts
 *
 * Prerequisites:
 *   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env
 */

import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import * as readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n========================================');
  console.log('Google OAuth2 Token Generator');
  console.log('========================================\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Log in with your Google account and grant permissions.');
  console.log('3. Copy the authorization code and paste it below.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question('Enter the authorization code: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await auth.getToken(code.trim());
      console.log('\n========================================');
      console.log('Success! Add this to your .env file:');
      console.log('========================================\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n========================================\n');
    } catch (err: any) {
      console.error('Error getting token:', err.message);
      process.exit(1);
    }
  });
}

main();
