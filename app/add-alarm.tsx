// ─────────────────────────────────────────────
//  Alarmify – Add / Edit Alarm Screen
// ─────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
  ScrollView,
  LogBox,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { createAlarm } from '../src/services/alarms';
import { TimeWheelPicker } from '../src/components/TimeWheelPicker';
import { DaySelector } from '../src/components/DaySelector';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../src/theme';
import { Alarm } from '../src/types';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

export default function AddAlarmScreen() {
  const router     = useRouter();
  const { alarmId } = useLocalSearchParams<{ alarmId?: string }>();

  const existingAlarm = useStore((s) => s.alarms.find((a) => a.id === alarmId));
  const addAlarm      = useStore((s) => s.addAlarm);
  const updateAlarm   = useStore((s) => s.updateAlarm);
  const deleteAlarm   = useStore((s) => s.deleteAlarm);
  const pendingTrack  = useStore((s) => s.pendingTrack);
  const setPending    = useStore((s) => s.setPendingTrack);
  const is24Hour      = useStore((s) => s.is24Hour);

  const isEditing = !!existingAlarm;

  const [time,  setTime]  = useState(existingAlarm?.time  ?? '07:00');
  const [days,  setDays]  = useState(existingAlarm?.days  ?? [1, 2, 3, 4, 5]);
  const [label, setLabel] = useState(existingAlarm?.label ?? '');
  const [track, setTrack] = useState(existingAlarm?.track ?? null);

  // Pick up a track selected from the song-search screen
  useEffect(() => {
    if (pendingTrack) {
      setTrack(pendingTrack);
      setPending(null);
    }
  }, [pendingTrack, setPending]);

  const handleSave = useCallback(async () => {
    const base: Alarm = existingAlarm ?? createAlarm();
    const updated: Alarm = {
      ...base,
      time,
      days,
      label,
      track,
      isEnabled: existingAlarm?.isEnabled ?? true,
    };

    if (isEditing) {
      await updateAlarm(updated);
    } else {
      await addAlarm(updated);
    }

    router.back();
  }, [existingAlarm, time, days, label, track, isEditing, addAlarm, updateAlarm, router]);

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

  const openSongSearch = () => router.push('/song-search');

  // ─── format time for display in header
  const [hh, mm] = time.split(':').map(Number);
  const period  = hh >= 12 ? 'PM' : 'AM';
  const hDisplay = is24Hour ? String(hh).padStart(2, '0') : String(hh % 12 || 12);

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
            <Text style={styles.navTitle}>{isEditing ? 'Edit Alarm' : 'New Alarm'}</Text>
            {isEditing ? (
              <TouchableOpacity onPress={handleDelete} style={styles.navBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            ) : (
              <View style={styles.navBtn} />
            )}
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { alignItems: 'center' }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Time Preview ─────────────────────── */}
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewText}>{hDisplay}:{String(mm).padStart(2, '0')}</Text>
            </View>

            {/* ── Time Wheel ───────────────────────── */}
            <TimeWheelPicker value={time} onChange={setTime} is24Hour={is24Hour} />

            {/* ── Section: Repeat ──────────────────── */}
            <View style={[styles.section, { width: '100%' }]}>
              <Text style={styles.sectionLabel}>REPEAT</Text>
              <View style={styles.card}>
                <DaySelector selected={days} onChange={setDays} />
                <Text style={styles.repeatHint}>
                  {days.length === 0 ? 'One-time alarm' : 'Repeats weekly on selected days'}
                </Text>
              </View>
            </View>

            {/* ── Section: Label ───────────────────── */}
            <View style={[styles.section, { width: '100%' }]}>
              <Text style={styles.sectionLabel}>LABEL</Text>
              <View style={[styles.card, styles.inputCard]}>
                <Ionicons name="pencil-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Alarm label…"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={40}
                />
              </View>
            </View>

            {/* ── Section: Song ────────────────────── */}
            <View style={[styles.section, { width: '100%' }]}>
              <Text style={styles.sectionLabel}>SONG</Text>
              <TouchableOpacity style={styles.card} onPress={openSongSearch} activeOpacity={0.8}>
                {track ? (
                  <View style={styles.trackRow}>
                    {track.albumArt ? (
                      <Image source={{ uri: track.albumArt }} style={styles.trackArt} />
                    ) : (
                      <View style={[styles.trackArt, styles.trackArtPlaceholder]}>
                        <Ionicons name="musical-note" size={18} color={COLORS.primary} />
                      </View>
                    )}
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                ) : (
                  <View style={styles.noTrack}>
                    <View style={styles.noTrackIcon}>
                      <FontAwesome5 name="spotify" size={24} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noTrackTitle}>Choose a song</Text>
                      <Text style={styles.noTrackSub}>Search Spotify for your wake-up song</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
              {track && (
                <TouchableOpacity onPress={() => setTrack(null)} style={styles.clearTrack}>
                  <Ionicons name="close-circle" size={14} color={COLORS.textMuted} />
                  <Text style={styles.clearTrackText}>Remove song</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* ── Save Button ──────────────────────── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, SHADOWS.glow]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[COLORS.primary, '#17A349']} style={styles.saveBtnGrad}>
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Update Alarm' : 'Set Alarm'}
                </Text>
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

  timePreview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  timePreviewText: {
    fontFamily: FONTS.bold,
    fontSize: 72,
    color: COLORS.textPrimary,
    letterSpacing: -3,
    lineHeight: 80,
  },
  timePreviewPeriod: {
    fontFamily: FONTS.medium,
    fontSize: 24,
    color: COLORS.primary,
    marginBottom: 10,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 20,
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
  repeatHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackArt: {
    width: 48, height: 48,
    borderRadius: RADIUS.sm,
  },
  trackArtPlaceholder: {
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: { flex: 1 },
  trackName: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  trackArtist: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  noTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noTrackIcon: {
    width: 44, height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTrackTitle: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  noTrackSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  clearTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  clearTrackText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  saveBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    height: 56,
  },
  saveBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#fff',
  },
});
