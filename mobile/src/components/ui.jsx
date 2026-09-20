import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADII, SHADOW, STATUS_PILL } from '../theme/tokens';

/** Page background and safe area, the paper the whole app is printed on. */
export function Screen({ children, scroll = true, refreshControl, contentClassName = '' }) {
  const body = scroll ? (
    <ScrollView
      contentContainerClassName={`px-5 pb-10 pt-4 ${contentClassName}`}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 px-5 pt-4 ${contentClassName}`}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'left', 'right']}>
      {body}
    </SafeAreaView>
  );
}

/** The raised card the web app uses everywhere; RN needs the shadow spelled out rather than a class. */
export function Card({ children, className = '', style }) {
  return (
    <View className={`rounded-2xl border border-hairline bg-surface p-4 ${className}`} style={[SHADOW, style]}>
      {children}
    </View>
  );
}

export function Title({ children, className = '', style }) {
  return (
    <Text className={`text-ink text-2xl ${className}`} style={[{ fontFamily: FONTS.serif }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, className = '', style }) {
  return (
    <Text className={`text-ink text-base ${className}`} style={[{ fontFamily: FONTS.sansSemibold }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, className = '', numberOfLines, style }) {
  return (
    <Text className={`text-ink text-[15px] leading-5 ${className}`} style={[{ fontFamily: FONTS.sans }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Muted({ children, className = '', numberOfLines, style }) {
  return (
    <Text className={`text-ink-soft text-[13px] leading-[18px] ${className}`} style={[{ fontFamily: FONTS.sans }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Label({ children }) {
  return (
    <Text className="text-ink-soft mb-1.5 text-[12px] uppercase tracking-wider" style={{ fontFamily: FONTS.sansMedium }}>
      {children}
    </Text>
  );
}

export function Button({ children, onPress, disabled, loading, tone = 'primary', className = '' }) {
  const tones = {
    primary: { bg: COLORS.blue, fg: '#FFFFFF', border: COLORS.blue },
    secondary: { bg: COLORS.surface, fg: COLORS.ink, border: COLORS.hairline },
    danger: { bg: COLORS.surface, fg: COLORS.danger, border: COLORS.danger },
    sage: { bg: COLORS.sage, fg: '#FFFFFF', border: COLORS.sage },
  };
  const t = tones[tone] || tones.primary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      className={`min-h-[48px] flex-row items-center justify-center rounded-xl border px-5 ${className}`}
      style={({ pressed }) => ({
        backgroundColor: t.bg,
        borderColor: t.border,
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={t.fg} size="small" /> : null}
      <Text className={loading ? 'ml-2' : ''} style={{ color: t.fg, fontFamily: FONTS.sansSemibold, fontSize: 15 }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** A labelled input with its error underneath, the shape every form on the web app uses. */
export function Field({ label, error, hint, children }) {
  return (
    <View className="mb-4">
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint && !error ? <Muted className="mt-1">{hint}</Muted> : null}
      {error ? (
        <Text className="text-danger mt-1 text-[13px]" style={{ fontFamily: FONTS.sans }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({ error, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={COLORS.inkFaint}
      className="min-h-[48px] rounded-xl border bg-surface px-3.5 py-3 text-[15px] text-ink"
      style={[{ borderColor: error ? COLORS.danger : COLORS.hairline, fontFamily: FONTS.sans }, style]}
      {...props}
    />
  );
}

export function Pill({ status, label, className = '' }) {
  const colours = STATUS_PILL[status] || { bg: COLORS.surfaceSunken, fg: COLORS.inkSoft };
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${className}`} style={{ backgroundColor: colours.bg }}>
      <Text style={{ color: colours.fg, fontFamily: FONTS.sansSemibold, fontSize: 12 }}>{label ?? status}</Text>
    </View>
  );
}

export function Banner({ tone = 'info', title, children }) {
  const tones = {
    info: { bg: COLORS.blueSoft, border: COLORS.blue, fg: COLORS.blue },
    success: { bg: COLORS.sageSoft, border: COLORS.sage, fg: COLORS.sage },
    warning: { bg: COLORS.goldSoft, border: COLORS.gold, fg: COLORS.gold },
    error: { bg: COLORS.dangerSoft, border: COLORS.danger, fg: COLORS.danger },
  };
  const t = tones[tone] || tones.info;
  return (
    <View className="mb-4 rounded-xl border px-3.5 py-3" style={{ backgroundColor: t.bg, borderColor: t.border }}>
      {title ? (
        <Text className="mb-1" style={{ color: t.fg, fontFamily: FONTS.sansSemibold, fontSize: 14 }}>
          {title}
        </Text>
      ) : null}
      {typeof children === 'string' ? (
        <Text className="text-ink text-[14px] leading-5" style={{ fontFamily: FONTS.sans }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator color={COLORS.blue} />
      <Muted className="mt-3">{label}</Muted>
    </View>
  );
}

export function EmptyState({ title, children }) {
  return (
    <Card className="items-center py-8">
      <Heading className="text-center">{title}</Heading>
      {children ? <Muted className="mt-2 text-center">{children}</Muted> : null}
    </Card>
  );
}

/** A row of choices; used for filters and for short option lists where a native picker would be heavy. */
export function ChipRow({ options, value, onChange, className = '' }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className={className} contentContainerClassName="gap-2 pr-4">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            className="rounded-full border px-3.5 py-2"
            style={{
              backgroundColor: selected ? COLORS.blue : COLORS.surface,
              borderColor: selected ? COLORS.blue : COLORS.hairline,
            }}
          >
            <Text style={{ color: selected ? '#FFFFFF' : COLORS.ink, fontFamily: FONTS.sansMedium, fontSize: 13 }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A tappable option in a vertical list, with an optional hint and a tick when chosen. */
export function OptionRow({ title, hint, selected, onPress, multi = false }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-xl border bg-surface px-3.5 py-3"
      style={{ borderColor: selected ? COLORS.blue : COLORS.hairline, backgroundColor: selected ? COLORS.blueSoft : COLORS.surface }}
    >
      <View
        className={`mr-3 h-5 w-5 items-center justify-center border ${multi ? 'rounded-md' : 'rounded-full'}`}
        style={{ borderColor: selected ? COLORS.blue : COLORS.inkFaint, backgroundColor: selected ? COLORS.blue : 'transparent' }}
      >
        {selected ? <Text style={{ color: '#FFFFFF', fontSize: 12, lineHeight: 14 }}>✓</Text> : null}
      </View>
      <View className="flex-1">
        <Body>{title}</Body>
        {hint ? <Muted className="mt-0.5">{hint}</Muted> : null}
      </View>
    </Pressable>
  );
}

export { COLORS, FONTS, RADII };
