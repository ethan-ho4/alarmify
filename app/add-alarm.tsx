// ─────────────────────────────────────────────
//  Ethan's Alarm – Add / Edit Alarm Screen
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
  LogBox,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { createAlarm } from '../src/services/alarms';
import { TimeWheelPicker } from '../src/components/TimeWheelPicker';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../src/theme';
import { Alarm, SpotifyMedia } from '../src/types';
import { DEFAULT_SPOTIFY_MEDIA } from '../src/config/spotifyBeta';
import { findNearbyEnabledAlarm } from '../src/utils/alarmConflicts';
import { getAlarmMedia, getMediaImageUrl, getMediaKindLabel, getMediaSubtitle, getMediaTitle } from '../src/utils/media';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

function formatNowAsAlarmTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AddAlarmScreen() {
  const router = useRouter();
  const { alarmId } = useLocalSearchParams<{ alarmId?: string }>();

  const existingAlarm = useStore((s) => s.alarms.find((a) => a.id === alarmId));
  const alarms = useStore((s) => s.alarms);
  const addAlarm = useStore((s) => s.addAlarm);
  const updateAlarm = useStore((s) => s.updateAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const pendingMedia = useStore((s) => s.pendingMedia);
  const setPendingMedia = useStore((s) => s.setPendingMedia);
  const is24Hour = useStore((s) => s.is24Hour);

  const isEditing = !!existingAlarm;

  const [time, setTime] = useState(existingAlarm?.time ?? formatNowAsAlarmTime());
  const [media, setMedia] = useState<SpotifyMedia | null>(
    existingAlarm ? getAlarmMedia(existingAlarm) : null,
  );

  useEffect(() => {
    if (pendingMedia) {
      setMedia(pendingMedia);
      setPendingMedia(null);
    }
  }, [pendingMedia, setPendingMedia]);

  const handleSave = useCallback(async () => {
    const base: Alarm = existingAlarm ?? createAlarm();
    const updated: Alarm = {
      ...base,
      time,
      days: [],
      label: '',
      media: media ?? DEFAULT_SPOTIFY_MEDIA,
      isEnabled: existingAlarm?.isEnabled ?? true,
    };

    const save = async () => {
      if (isEditing) {
        await updateAlarm(updated);
      } else {
        await addAlarm(updated);
      }

      router.back();
    };

    const nearby = findNearbyEnabledAlarm(alarms, updated);
    if (nearby) {
      Alert.alert(
        'Nearby alarm warning',
        'Spotify playback will keep looping after an alarm goes off, so setting another active alarm within 30 minutes usually is not necessary.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue anyway',
            style: 'destructive',
            onPress: () => void save(),
          },
        ],
      );
      return;
    }

    await save();
  }, [addAlarm, alarms, existingAlarm, isEditing, media, router, time, updateAlarm]);

  const handleDelete = useCallback(() => {
    if (!existingAlarm) return;
    Alert.alert('Delete Alarm', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAlarm(existingAlarm.id);
          router.back();
        },
      },
    ]);
  }, [existingAlarm, deleteAlarm, router]);

  const openPickMedia = () => router.push('/pick-media' as Href);

  const [hh, mm] = time.split(':').map(Number);
  const hDisplay = is24Hour ? String(hh).padStart(2, '0') : String(hh % 12 || 12);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1117', '#050508']} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>{isEditing ? 'Edit Alarm' : 'New Alarm'}</Text>
            {isEditing ? (
              <TouchableOpacity onPress={handleDelete} style={styles.navBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            ) : (
              <View style={styles.navBtn} />
            )}
          </View>

          <View style={[styles.content, { alignItems: 'center' }]}>
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewText}>{hDisplay}:{String(mm).padStart(2, '0')}</Text>
            </View>

            <TimeWheelPicker value={time} onChange={setTime} is24Hour={is24Hour} compact />

            <View style={[styles.section, { width: '100%' }]}>
              <Text style={styles.sectionLabel}>MUSIC</Text>
              <TouchableOpacity style={styles.card} onPress={openPickMedia} activeOpacity={0.8}>
                {media ? (
                  <View style={styles.trackRow}>
                    {getMediaImageUrl(media) ? (
                      <Image source={{ uri: getMediaImageUrl(media) }} style={styles.trackArt} />
                    ) : (
                      <View style={[styles.trackArt, styles.trackArtPlaceholder]}>
                        <Ionicons name="musical-note" size={18} color={COLORS.primary} />
                      </View>
                    )}
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackKind}>{getMediaKindLabel(media)}</Text>
                      <Text style={styles.trackName} numberOfLines={1}>{getMediaTitle(media)}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{getMediaSubtitle(media)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                ) : (
                  <View style={styles.noTrack}>
                    <View style={styles.noTrackIcon}>
                      <FontAwesome5 name="spotify" size={24} color={COLORS.spotify} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noTrackTitle}>Choose music</Text>
                      <Text style={styles.noTrackSub}>Paste a Spotify link. If left blank, The Fox plays by default.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              {media && (
                <TouchableOpacity onPress={() => setMedia(null)} style={styles.clearTrack}>
                  <Ionicons name="close-circle" size={14} color={COLORS.textMuted} />
                  <Text style={styles.clearTrackText}>Remove music</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.saveBtn, SHADOWS.glow]} onPress={handleSave} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.saveBtnGrad}>
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>{isEditing ? 'Update Alarm' : 'Set Alarm'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
  timePreview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  timePreviewText: {
    fontFamily: FONTS.bold,
    fontSize: 56,
    color: COLORS.textPrimary,
    letterSpacing: -2,
    lineHeight: 62,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
    justifyContent: 'flex-start',
  },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackArt: { width: 48, height: 48, borderRadius: RADIUS.sm },
  trackArtPlaceholder: {
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: { flex: 1 },
  trackKind: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  trackName: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textPrimary },
  trackArtist: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  noTrack: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noTrackIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTrackTitle: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textPrimary },
  noTrackSub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  clearTrack: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  clearTrackText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted },
  footer: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  saveBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', height: 56 },
  saveBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 17, color: '#fff' },
});
