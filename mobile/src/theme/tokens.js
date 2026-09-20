// TrailSync's visual identity, carried over from the web app. The components are new, the look is not.
export const COLORS = {
  paper: '#FAF8F3',
  ink: '#1F2937',
  blue: '#24406B',
  gold: '#B8872B',
  sage: '#4F7A6A',
  hairline: '#E3DFD2',

  // Shades derived from the six above, for the states a screen needs: muted copy, surfaces, and the status pills.
  inkSoft: '#6B7280',
  inkFaint: '#9CA3AF',
  surface: '#FFFFFF',
  surfaceSunken: '#F3F0E8',
  blueSoft: '#E8EDF5',
  goldSoft: '#F7EEDC',
  sageSoft: '#E6EFEA',
  danger: '#B91C1C',
  dangerSoft: '#FDECEC',
};

export const FONTS = {
  // Source Serif 4 for anything that should feel like a printed document; Inter for everything else.
  serif: 'SourceSerif4_600SemiBold',
  serifRegular: 'SourceSerif4_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
};

export const RADII = { sm: 8, md: 12, lg: 16, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// The card lift the web app draws with box-shadow, in React Native's shadow model (iOS) plus elevation (Android).
export const SHADOW = {
  shadowColor: '#1F2937',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

// One pill style per request status, the same colour language the web app uses.
export const STATUS_PILL = {
  Submitted: { bg: COLORS.surfaceSunken, fg: COLORS.inkSoft },
  Verified: { bg: COLORS.sageSoft, fg: COLORS.sage },
  Approved: { bg: COLORS.blueSoft, fg: COLORS.blue },
  Processing: { bg: COLORS.goldSoft, fg: COLORS.gold },
  Ready: { bg: COLORS.sageSoft, fg: COLORS.sage },
  Released: { bg: COLORS.surfaceSunken, fg: COLORS.inkSoft },
  Rejected: { bg: COLORS.dangerSoft, fg: COLORS.danger },
  Cancelled: { bg: COLORS.surfaceSunken, fg: COLORS.inkFaint },
};
