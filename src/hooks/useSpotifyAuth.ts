// ─────────────────────────────────────────────
//  Alarmify – Spotify PKCE Auth Hook
//  Opens the Spotify OAuth flow in the browser
//  and exchanges the code for tokens.
// ─────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Linking } from 'react-native';
import { buildAuthUrl, exchangeCodeForTokens } from '../services/spotify';
import { useStore } from '../store/useStore';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = makeRedirectUri();
console.log('\n\n======================================================');
console.log('📌 REQUIRED SPOTIFY SETTING');
console.log('Add this exact Redirect URI to your Spotify Dashboard:');
console.log(REDIRECT_URI);
console.log('======================================================\n\n');

function generateState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // Base64url encode (no padding, + → -, / → _)
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}

export function useSpotifyAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const setAuth                = useStore((s) => s.setAuth);
  const stateRef               = useRef('');
  const verifierRef            = useRef('');

  const login = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { verifier, challenge } = await generatePKCE();
      const state = generateState();
      stateRef.current   = state;
      verifierRef.current = verifier;

      const url = buildAuthUrl(challenge, state, REDIRECT_URI);

      const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);

      if (result.type !== 'success') {
        setError('Authentication cancelled.');
        return;
      }

      const queryString = result.url.split('?')[1] || '';
      const pairs = queryString.split('&');
      const params: Record<string, string> = {};
      pairs.forEach(pair => {
        const [key, val] = pair.split('=');
        if (key) params[key] = decodeURIComponent(val || '');
      });

      const returnedState = params['state'];
      const code          = params['code'];
      const errorParam    = params['error'];

      if (errorParam) {
        setError(`Spotify error: ${errorParam}`);
        return;
      }
      if (returnedState !== stateRef.current || !code) {
        setError('Invalid response from Spotify.');
        return;
      }

      const auth = await exchangeCodeForTokens(code, verifierRef.current, REDIRECT_URI);
      if (!auth) {
        setError('Failed to exchange code for tokens.');
        return;
      }

      await setAuth(auth);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [setAuth]);

  return { login, loading, error };
}
