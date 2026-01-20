/**
 * Google OAuth 2.0 Authentication Service
 * Handles the OAuth flow for login with Google
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:10000/api/auth/google/callback';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Generate the Google OAuth authorization URL
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} The authorization URL to redirect the user to
 */
export function getAuthUrl(state = '') {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: state
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code from Google
 * @returns {Promise<{access_token: string, refresh_token?: string, id_token?: string}>}
 */
export async function getTokens(code) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_REDIRECT_URI
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get tokens: ${error}`);
    }

    return await response.json();
}

/**
 * Get user profile from Google
 * @param {string} accessToken - The access token
 * @returns {Promise<{id: string, email: string, name: string, picture: string}>}
 */
export async function getUserProfile(accessToken) {
    const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to get user profile');
    }

    return await response.json();
}

export default {
    getAuthUrl,
    getTokens,
    getUserProfile
};
