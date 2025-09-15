import { NextResponse } from 'next/server';

function randomState(len = 32) {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const rawScopes =
    process.env.YOUTUBE_OAUTH_SCOPES ||
    'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
  const accessType = process.env.GOOGLE_OAUTH_ACCESS_TYPE || 'offline';
  const prompt = process.env.GOOGLE_OAUTH_PROMPT || 'consent';

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URI' },
      { status: 500 }
    );
  }

  const scopes = rawScopes
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(' ');

  const state = randomState();

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', scopes);
  authorizeUrl.searchParams.set('access_type', accessType);
  authorizeUrl.searchParams.set('prompt', prompt);
  authorizeUrl.searchParams.set('include_granted_scopes', 'true');
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });
  return res;
}
