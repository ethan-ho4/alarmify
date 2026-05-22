import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Keyboard,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  searchTracks,
  fetchUserPlaylists,
  fetchLikedTracks,
  fetchSavedAlbums,
} from '../src/services/spotify';
import { useSpotifyAuth } from '../src/hooks/useSpotifyAuth';
import { useStore } from '../src/store/useStore';
import { MediaItemRow } from '../src/components/pick-media/MediaItemRow';
import { SpotifyMedia } from '../src/types';
import { getMediaSubtitle, getMediaTitle } from '../src/utils/media';
import { FavouriteTrack, loadFavourites, toggleFavourite } from '../src/services/favourites';
import {
  loadSavedSpotifyLinks,
  removeSavedSpotifyLink,
  saveSpotifyLink,
  SavedSpotifyLink,
} from '../src/services/savedSpotifyLinks';
import { SPOTIFY_BETA_FORM_URL } from '../src/config/spotifyBeta';
import { COLORS, FONTS, RADIUS } from '../src/theme';

type TopTab = 'saved' | 'paste' | 'beta';
type BetaTab = 'library' | 'search' | 'favourites';
type LibrarySection = 'playlists' | 'liked' | 'albums';

const MIN_SEARCH_CHARS = 2;
const SEARCH_CACHE_TTL_MS = 60_000;

export default function PickMediaScreen() {
  const router = useRouter();
  const auth = useStore((s) => s.auth);
  const setPendingMedia = useStore((s) => s.setPendingMedia);
  const { login, loading: authLoading, error: authError } = useSpotifyAuth();

  const [topTab, setTopTab] = useState<TopTab>('saved');
  const [betaTab, setBetaTab] = useState<BetaTab>('library');
  const [showBetaTools, setShowBetaTools] = useState(false);
  const [librarySection, setLibrarySection] = useState<LibrarySection>('playlists');

  const [query, setQuery] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyMedia[]>([]);
  const [libraryItems, setLibraryItems] = useState<SpotifyMedia[]>([]);
  const [savedLinks, setSavedLinks] = useState<SavedSpotifyLink[]>([]);
  const [favourites, setFavourites] = useState<FavouriteTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [libraryOffset, setLibraryOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchRequestSeq = useRef(0);
  const libraryRequestSeq = useRef(0);
  const inFlightLibraryPage = useRef<string | null>(null);
  const searchCache = useRef(new Map<string, { items: SpotifyMedia[]; timestamp: number }>());
  const favouriteIds = React.useMemo(() => new Set(favourites.map((item) => item.id)), [favourites]);

  useEffect(() => {
    if (authError) {
      Alert.alert('Spotify Login Error', authError);
    }
  }, [authError]);

  useEffect(() => {
    if (auth) setShowBetaTools(true);
  }, [auth]);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_SEARCH_CHARS) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    if (!auth) {
      Alert.alert('Not connected', 'Please connect Spotify from the Spotify Beta tab first.');
      return;
    }
    const cached = searchCache.current.get(trimmed.toLowerCase());
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      setSearchResults(cached.items);
      setSearched(true);
      return;
    }

    const requestId = ++searchRequestSeq.current;
    try {
      setLoading(true);
      const tracks = await searchTracks(trimmed);
      if (requestId !== searchRequestSeq.current) return;
      searchCache.current.set(trimmed.toLowerCase(), { items: tracks, timestamp: Date.now() });
      setSearchResults(tracks);
      setSearched(true);
    } catch (err: unknown) {
      if (requestId !== searchRequestSeq.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Search failed', msg || 'Could not reach Spotify.');
    } finally {
      if (requestId === searchRequestSeq.current) setLoading(false);
    }
  }, [auth]);

  const loadLibrary = useCallback(
    async (section: LibrarySection, offset = 0, append = false) => {
      if (!auth) return;
      const pageKey = `${section}:${offset}`;
      if (inFlightLibraryPage.current === pageKey) return;
      inFlightLibraryPage.current = pageKey;
      const requestId = ++libraryRequestSeq.current;
      try {
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);

        const page =
          section === 'playlists'
            ? await fetchUserPlaylists(20, offset)
            : section === 'liked'
              ? await fetchLikedTracks(20, offset)
              : await fetchSavedAlbums(20, offset);

        if (requestId !== libraryRequestSeq.current) return;
        setLibraryItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setLibraryOffset(page.nextOffset);
      } catch (err: unknown) {
        if (requestId !== libraryRequestSeq.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('403') || msg.toLowerCase().includes('scope')) {
          Alert.alert(
            'Reconnect Spotify',
            'Library access needs updated permissions. Disconnect and reconnect from the Spotify Beta tab.',
          );
        } else {
          Alert.alert('Library failed', msg);
        }
      } finally {
        if (inFlightLibraryPage.current === pageKey) inFlightLibraryPage.current = null;
        if (requestId === libraryRequestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [auth],
  );

  useEffect(() => {
    loadFavourites().then(setFavourites).catch(() => setFavourites([]));
    loadSavedSpotifyLinks().then(setSavedLinks).catch(() => setSavedLinks([]));
  }, []);

  useEffect(() => {
    if (topTab === 'beta' && showBetaTools && betaTab === 'library' && auth) {
      setSelected(null);
      setLibraryOffset(0);
      void loadLibrary(librarySection, 0, false);
    }
  }, [topTab, showBetaTools, betaTab, librarySection, auth, loadLibrary]);

  useEffect(() => {
    if (topTab !== 'beta' || betaTab !== 'search' || !showBetaTools) return;

    const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [topTab, betaTab, showBetaTools]);

  const handleTopTabPress = useCallback((tab: TopTab) => {
    setSelected(null);
    setTopTab(tab);
    Keyboard.dismiss();
  }, []);

  const handleBetaTabPress = useCallback((tab: BetaTab) => {
    setSelected(null);
    setBetaTab(tab);
    if (tab !== 'search') Keyboard.dismiss();
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => doSearch(text), 500);
    },
    [doSearch],
  );

  const handleSelect = useCallback((media: SpotifyMedia) => {
    Keyboard.dismiss();
    setSelected((prev) => (prev?.id === media.id && prev?.kind === media.kind ? null : media));
  }, []);

  const handleToggleFavourite = useCallback(async (media: SpotifyMedia) => {
    if (media.kind !== 'track') return;
    const next = await toggleFavourite(media);
    setFavourites(next);
  }, []);

  const handleDeleteSavedLink = useCallback((media: SpotifyMedia) => {
    const savedLinkId = `${media.kind}-${media.id}`;
    Alert.alert(
      'Delete saved link?',
      `"${getMediaTitle(media)}" will be removed from your saved links.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const next = await removeSavedSpotifyLink(savedLinkId);
              setSavedLinks(next);
              setSelected((prev) => (
                prev?.kind === media.kind && prev.id === media.id ? null : prev
              ));
            })();
          },
        },
      ],
    );
  }, []);

  const handleSaveLink = useCallback(async () => {
    if (savingLink) return;

    try {
      setSavingLink(true);
      const saved = await saveSpotifyLink(linkInput, linkTitle);
      if (!saved) {
        Alert.alert(
          'Invalid Spotify link',
          'Paste a Spotify track, playlist, or album link from the Spotify app.',
        );
        return;
      }

      const links = await loadSavedSpotifyLinks();
      setSavedLinks(links);
      setSelected(saved.media);
      setLinkInput('');
      setLinkTitle('');
      setTopTab('saved');
    } finally {
      setSavingLink(false);
    }
  }, [linkInput, linkTitle, savingLink]);

  const openBetaForm = useCallback(() => {
    void Linking.openURL(SPOTIFY_BETA_FORM_URL);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    Keyboard.dismiss();
    setPendingMedia(selected);
    router.back();
  }, [selected, setPendingMedia, router]);

  const listData: SpotifyMedia[] = topTab === 'saved'
    ? savedLinks.map((item) => item.media)
    : topTab === 'beta' && showBetaTools
      ? betaTab === 'search'
        ? searchResults
        : betaTab === 'library'
          ? libraryItems
          : favourites
      : [];

  const renderItem: ListRenderItem<SpotifyMedia> = useCallback(
    ({ item }) => (
      <MediaItemRow
        media={item}
        isSelected={selected?.id === item.id && selected?.kind === item.kind}
        onPress={() => handleSelect(item)}
        showHeart={topTab === 'beta' && betaTab === 'search' && item.kind === 'track'}
        isFavourited={item.kind === 'track' && favouriteIds.has(item.id)}
        onToggleFavourite={() => handleToggleFavourite(item)}
        showDelete={topTab === 'saved'}
        onDelete={() => handleDeleteSavedLink(item)}
      />
    ),
    [betaTab, favouriteIds, handleDeleteSavedLink, handleSelect, handleToggleFavourite, selected, topTab],
  );

  const onEndReached = useCallback(() => {
    if (
      topTab !== 'beta' ||
      betaTab !== 'library' ||
      !showBetaTools ||
      libraryOffset == null ||
      loading ||
      loadingMore
    ) return;
    void loadLibrary(librarySection, libraryOffset, true);
  }, [topTab, betaTab, showBetaTools, libraryOffset, loading, loadingMore, librarySection, loadLibrary]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1117', '#050508']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Pick music</Text>
            <View style={styles.navBtn} />
          </View>

          <View style={styles.topTabs}>
            {(['saved', 'paste', 'beta'] as TopTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.topTab, topTab === tab && styles.topTabActive]}
                onPress={() => handleTopTabPress(tab)}
              >
                <Text style={[styles.topTabText, topTab === tab && styles.topTabTextActive]}>
                  {tab === 'saved' ? 'Saved Links' : tab === 'paste' ? 'Paste Link' : 'Spotify Beta'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {topTab === 'paste' && (
            <View style={styles.pasteContainer}>
              <View style={styles.infoCard}>
                <Ionicons name="link-outline" size={22} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Paste a Spotify link</Text>
                  <Text style={styles.infoText}>
                    Public mode works with Spotify track, playlist, or album links. Spotify login
                    and library search are only available in the beta.
                  </Text>
                </View>
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Spotify link</Text>
                <TextInput
                  style={styles.linkInput}
                  value={linkInput}
                  onChangeText={setLinkInput}
                  placeholder="https://open.spotify.com/track/..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  clearButtonMode="while-editing"
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Display name (optional)</Text>
                <TextInput
                  style={styles.linkInput}
                  value={linkTitle}
                  onChangeText={setLinkTitle}
                  placeholder="Morning song, gym playlist, etc."
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveLinkBtn, savingLink && styles.saveLinkBtnDisabled]}
                onPress={() => void handleSaveLink()}
                disabled={savingLink}
                activeOpacity={0.85}
              >
                {savingLink ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveLinkText}>Save and select link</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {topTab === 'beta' && !showBetaTools && (
            <View style={styles.betaGate}>
              <FontAwesome5 name="spotify" size={36} color={COLORS.spotify} />
              <Text style={styles.betaTitle}>Spotify library is in beta</Text>
              <Text style={styles.betaText}>
                Spotify limits public API access for independent apps. Request beta access if you
                want to test Spotify login, search, library browsing, and API playback.
              </Text>
              <TouchableOpacity style={styles.saveLinkBtn} onPress={openBetaForm} activeOpacity={0.85}>
                <Text style={styles.saveLinkText}>Request beta access</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBetaBtn}
                onPress={() => setShowBetaTools(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBetaText}>I am already in the beta</Text>
              </TouchableOpacity>
            </View>
          )}

          {topTab === 'beta' && showBetaTools && !auth && (
            <View style={styles.noAuth}>
              <FontAwesome5 name="spotify" size={36} color={COLORS.spotify} />
              <Text style={styles.noAuthTitle}>Connect Spotify beta</Text>
              <Text style={styles.noAuthSub}>
                Only allowlisted beta testers can connect. Request access first if login fails.
              </Text>
              <TouchableOpacity style={styles.saveLinkBtn} onPress={login} disabled={authLoading} activeOpacity={0.85}>
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveLinkText}>Connect Spotify</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {topTab === 'beta' && showBetaTools && auth && (
            <>
              <View style={styles.betaSubTabs}>
                {(['library', 'search', 'favourites'] as BetaTab[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.chip, betaTab === tab && styles.chipActive]}
                    onPress={() => handleBetaTabPress(tab)}
                  >
                    <Text style={[styles.chipText, betaTab === tab && styles.chipTextActive]}>
                      {tab === 'library' ? 'Library' : tab === 'search' ? 'Search' : 'Favourites'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {betaTab === 'search' && (
                <View style={styles.searchContainer}>
                  <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={COLORS.textMuted} />
                    <TextInput
                      ref={searchInputRef}
                      style={styles.searchInput}
                      value={query}
                      onChangeText={handleChangeText}
                      placeholder="Search beta songs..."
                      placeholderTextColor={COLORS.textMuted}
                      returnKeyType="search"
                      onSubmitEditing={() => {
                        if (debounceTimer.current) clearTimeout(debounceTimer.current);
                        void doSearch(query);
                      }}
                      clearButtonMode="while-editing"
                    />
                    {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
                  </View>
                </View>
              )}

              {betaTab === 'library' && (
                <View style={styles.libChips}>
                  {(
                    [
                      ['playlists', 'Playlists'],
                      ['liked', 'Liked Songs'],
                      ['albums', 'Albums'],
                    ] as const
                  ).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.chip, librarySection === key && styles.chipActive]}
                      onPress={() => setLibrarySection(key)}
                    >
                      <Text style={[styles.chipText, librarySection === key && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {(topTab === 'saved' || (topTab === 'beta' && showBetaTools && auth)) && (
            <FlatList
              data={listData}
              keyExtractor={(item) => `${item.kind}-${item.id}`}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.3}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
              ListEmptyComponent={
                topTab === 'saved' ? (
                  <View style={styles.empty}>
                    <Ionicons name="link-outline" size={32} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No saved links yet</Text>
                    <Text style={styles.emptySubText}>Paste a Spotify link to use it for alarms.</Text>
                  </View>
                ) : betaTab === 'search' ? (
                  searched && !loading ? (
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>No results for "{query}"</Text>
                    </View>
                  ) : !searched ? (
                    <View style={styles.hint}>
                      <Text style={styles.hintText}>Search for a song with at least 2 characters</Text>
                    </View>
                  ) : null
                ) : betaTab === 'favourites' ? (
                  <View style={styles.empty}>
                    <Ionicons name="heart-outline" size={32} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No favourites yet</Text>
                    <Text style={styles.emptySubText}>Heart songs from beta Search to bookmark them here.</Text>
                  </View>
                ) : !loading ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Nothing here yet</Text>
                  </View>
                ) : null
              }
            />
          )}

          {selected && (
            <View style={styles.confirmBar}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle} numberOfLines={1}>{getMediaTitle(selected)}</Text>
                <Text style={styles.selectedArtist} numberOfLines={1}>{getMediaSubtitle(selected)}</Text>
              </View>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.confirmBtnGrad}>
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
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary },
  topTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  topTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  topTabActive: { backgroundColor: COLORS.surface2 },
  topTabText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textMuted },
  topTabTextActive: { color: COLORS.textPrimary },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 12 },
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
  searchInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textPrimary },
  pasteContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border2,
    padding: 14,
  },
  infoTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  infoText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
  },
  inputBlock: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 4,
  },
  linkInput: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveLinkBtn: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveLinkBtnDisabled: {
    opacity: 0.7,
  },
  saveLinkText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#fff',
  },
  libChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.border2,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryDim },
  chipText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted },
  chipTextActive: { color: COLORS.primary, fontFamily: FONTS.medium },
  betaGate: {
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 20,
    gap: 12,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border2,
  },
  betaTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  betaText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  secondaryBetaBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBetaText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  betaSubTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 },
  noAuth: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  noAuthTitle: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.textSecondary },
  noAuthSub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textMuted },
  emptySubText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  hint: { alignItems: 'center', marginTop: 60 },
  hintText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textMuted },
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
  selectedTitle: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textPrimary },
  selectedArtist: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted },
  confirmBtn: { borderRadius: RADIUS.md, overflow: 'hidden', height: 44, minWidth: 100 },
  confirmBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  confirmBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#fff' },
});
