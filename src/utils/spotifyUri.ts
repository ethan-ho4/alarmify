/**
 * Normalize Spotify web share URLs and URIs for Shortcuts "Open URL".
 * Returns null when the input cannot be turned into a spotify: URI.
 */
export function sanitizeSpotifyUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^spotify:(track|album|playlist|episode|show):/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');
    if (host !== 'open.spotify.com') return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const [kind, id] = parts;
    const allowed = ['track', 'album', 'playlist', 'episode', 'show'];
    if (!allowed.includes(kind) || !id) return null;

    return `spotify:${kind}:${id.split('?')[0]}`;
  } catch {
    return null;
  }
}

/** spotify: URI → https URL (Spotify app also accepts spotify: via Open URL). */
export function spotifyUriToOpenUrl(uri: string): string {
  const sanitized = sanitizeSpotifyUrl(uri);
  if (!sanitized) return uri;
  if (sanitized.startsWith('http')) return sanitized;

  const match = sanitized.match(/^spotify:(track|album|playlist|episode|show):(.+)$/i);
  if (!match) return sanitized;
  const [, kind, id] = match;
  return `https://open.spotify.com/${kind}/${id}`;
}
