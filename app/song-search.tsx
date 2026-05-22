import { Redirect, type Href } from 'expo-router';

/** @deprecated Use /pick-media */
export default function SongSearchRedirect() {
  return <Redirect href={'/pick-media' as Href} />;
}
