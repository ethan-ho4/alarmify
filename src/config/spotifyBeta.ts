import { SpotifyMedia } from '../types';

export const SPOTIFY_BETA_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfNGSlXmIE_Y3zzR_aLiNMlpqLFBrbaDiiYi8tXZkAudxW1MA/viewform?usp=dialog';

export const DEFAULT_SPOTIFY_LINK_URL =
  'https://open.spotify.com/track/5HOpkTTVcmZHnthgyxrIL8?si=55216551e7c24f62';

export const DEFAULT_SPOTIFY_MEDIA: SpotifyMedia = {
  kind: 'track',
  id: '5HOpkTTVcmZHnthgyxrIL8',
  uri: 'spotify:track:5HOpkTTVcmZHnthgyxrIL8',
  name: 'The Fox (What Does the Fox Say?)',
  artist: 'Ylvis',
  albumName: 'The Fox (What Does the Fox Say?)',
  imageUrl: '',
};
