// ─────────────────────────────────────────────
//  Alarmify – Song Search Screen
//  Searches Spotify and returns a track to
//  the add-alarm screen via global store.
// ─────────────────────────────────────────────

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { searchTracks } from '../src/services/spotify';
import { useStore } from '../src/store/useStore';
import { TrackCard } from '../src/components/TrackCard';
import { SpotifyTrack } from '../src/types';
import { COLORS, FONTS, RADIUS } from '../src/theme';

export default function SongSearchScreen() {
  const router        = useRouter();
  const auth          = useStore((s) => s.auth);
  const setPending    = useStore((s) => s.setPendingTrack);

  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    if (!auth) {
      Alert.alert('Not connected', 'Please connect to Spotify first from the home screen.');
      return;
    }
    try {
      setLoading(true);
      const tracks = await searchTracks(q.trim());
      setResults(tracks);
      setSearched(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SongSearch] search error:', msg);
      Alert.alert('Search failed', msg || 'Could not reach Spotify. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doSearch(text), 500);
  }, [doSearch]);

  const handleSelect = useCallback((track: SpotifyTrack) => {
    setSelected((prev) => (prev?.id === track.id ? null : track));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    setPending(selected);
    router.back();
  }, [selected, setPending, router]);

  const renderTrack: ListRenderItem<SpotifyTrack> = useCallback(
    ({ item }) => (
      <TrackCard
        track={item}
        isSelected={selected?.id === item.id}
        onPress={() => handleSelect(item)}
      />
    ),
    [selected, handleSelect],
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1117', '#050508']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* ── Nav ──────────────────────────────── */}
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Choose a Song</Text>
            <View style={styles.navBtn} />
          </View>

          {/* ── Search Bar ───────────────────────── */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={handleChangeText}
                placeholder="Search songs, artists, albums…"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => doSearch(query)}
                clearButtonMode="while-editing"
              />
              {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
          </View>

          {/* ── Not connected warning ─────────────── */}
          {!auth && (
            <View style={styles.noAuth}>
              <FontAwesome5 name="spotify" size={36} color={COLORS.primary} />
              <Text style={styles.noAuthTitle}>Connect Spotify first</Text>
              <Text style={styles.noAuthSub}>
                Go back and tap "Connect" to link your Spotify account
              </Text>
            </View>
          )}

          {/* ── Results ──────────────────────────── */}
          {auth && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderTrack}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                searched && !loading ? (
                  <View style={styles.empty}>
                    <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No results for "{query}"</Text>
                  </View>
                ) : !searched ? (
                  <View style={styles.hint}>
                    <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
                    <Text style={styles.hintText}>Search for a song to wake up to</Text>
                  </View>
                ) : null
              }
            />
          )}

          {/* ── Confirm Bar ──────────────────────── */}
          {selected && (
            <View style={styles.confirmBar}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle} numberOfLines={1}>{selected.name}</Text>
                <Text style={styles.selectedArtist} numberOfLines={1}>{selected.artist}</Text>
              </View>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.primary, '#17A349']} style={styles.confirmBtnGrad}>
                  <Text style={styles.confirmBtnText}>Select</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
    width: 40, height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border2,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  list: {
    paddingBottom: 120,
    paddingTop: 4,
  },

  noAuth: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  noAuthTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  noAuthSub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  empty: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  hint: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  hintText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textMuted,
  },

  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface1,
    borderTopWidth: 1,
    borderTopColor: COLORS.border2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 28,
    gap: 12,
  },
  selectedInfo: { flex: 1 },
  selectedTitle: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  selectedArtist: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  confirmBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    height: 44,
    minWidth: 100,
  },
  confirmBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  confirmBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#fff',
  },
});
