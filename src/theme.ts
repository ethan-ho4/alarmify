// ─────────────────────────────────────────────
//  Alarmify – Design System / Theme Tokens
// ─────────────────────────────────────────────

export const COLORS = {
  // Backgrounds
  bg:       '#050508',
  surface1: '#0F0F17',
  surface2: '#17172200',  // transparent for blurred
  surface3: '#1E1E2C',
  surfaceSolid2: '#17172280',

  // Brand
  primary:    '#1DB954',
  primaryDim: '#1DB95450',
  secondary:  '#7C3AED',
  accent:     '#A78BFA',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#A0A0B8',
  textMuted:     '#55556A',

  // UI
  border:  'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',

  // Status
  error:   '#EF4444',
  warning: '#F59E0B',
};

export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
  mono:    'System',
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
};
