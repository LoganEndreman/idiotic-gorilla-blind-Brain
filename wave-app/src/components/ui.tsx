import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  TextInputProps,
  TextProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Textured } from '@/components/Textured';
import { colors, embossed, engraved, fontFamily, gel, panelGradient, radius, shade, shadows, space } from '@/theme';

const FELT = require('../../assets/felt.png');

/** Text in Helvetica. Use this instead of react-native's Text. */
export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ fontFamily, color: colors.text }, style]} />;
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', style: 'destructive', onPress: onYes },
  ]);
}

/** Wraps an async action, showing any error. */
export async function attempt(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    notify('Something went wrong', e instanceof Error ? e.message : String(e));
  }
}

/** The game table: tiled felt with a soft vignette. */
export function Felt({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Textured source={FELT} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        locations={[0, 0.18, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Textured>
  );
}

export function Screen({
  children,
  scroll = true,
  edges = ['bottom'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <Felt>
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
            <View style={styles.inner}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.inner, { flex: 1 }]}>{children}</View>
        )}
      </SafeAreaView>
    </Felt>
  );
}

/** A raised, bevelled panel sitting on the table. */
export function Card({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return (
    <LinearGradient colors={panelGradient} style={[styles.card, style]}>
      {accent ? <LinearGradient colors={gel(accent)} style={styles.accent} pointerEvents="none" /> : null}
      {children}
    </LinearGradient>
  );
}

/** Glossy glass panel in Wave blue or Void purple. */
export function GradientCard({
  kind,
  children,
  style,
}: {
  kind: 'wave' | 'void';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const grad =
    kind === 'wave'
      ? ([colors.waveLight, colors.wave, colors.waveDeep] as const)
      : (['#7d58c4', colors.void, colors.voidDeep] as const);
  return (
    <LinearGradient colors={grad} style={[styles.gradCard, style]}>
      <Gloss radius={radius.md} />
      {children}
    </LinearGradient>
  );
}

/** The curved shine across the top half of glossy things. */
export function Gloss({ radius: r = radius.sm, strength = 0.22 }: { radius?: number; strength?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(255,255,255,${strength + 0.12})`, `rgba(255,255,255,${strength * 0.35})`]}
      style={[styles.gloss, { borderTopLeftRadius: r, borderTopRightRadius: r }]}
    />
  );
}

type BtnVariant = 'primary' | 'wave' | 'void' | 'ghost' | 'danger';

const BTN_BASE: Record<BtnVariant, string> = {
  primary: '#d9d4e6', // brushed pewter
  wave: colors.wave,
  void: colors.void,
  ghost: '#2c2350',
  danger: colors.danger,
};

/** Glossy gel button. */
export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const base = BTN_BASE[variant];
  const light = variant === 'primary';
  const fg = light ? colors.ink : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btnOuter, small && styles.btnSmall, { opacity: disabled ? 0.45 : 1 }, style]}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={pressed ? [shade(base, -0.3), base, shade(base, 0.15)] : gel(base)}
          style={[
            styles.btnFill,
            small && { paddingHorizontal: space(3) },
            { boxShadow: pressed ? shadows.pressed : shadows.button },
          ]}
        >
          {!pressed && <Gloss strength={light ? 0.35 : 0.2} />}
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <Text style={[styles.btnText, small && { fontSize: 13 }, { color: fg }, light ? embossed : engraved]}>{title}</Text>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function Body({ children, style, muted }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

/** A text field recessed into the panel. */
export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        style={[styles.input, rest.multiline && { minHeight: 80 }, style]}
        {...rest}
      />
    </View>
  );
}

/** A small glossy toggle. */
export function Chip({
  label,
  selected,
  color = colors.wave,
  onPress,
  badge,
  disabled,
}: {
  label: string;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
  badge?: string;
  disabled?: boolean;
}) {
  const base = selected ? color : '#2c2350';
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chipOuter, { opacity: disabled ? 0.35 : 1 }]}>
      {({ pressed }) => (
        <LinearGradient
          colors={pressed ? [shade(base, -0.3), base] : gel(base)}
          style={[styles.chip, { boxShadow: pressed || selected ? shadows.pressed : shadows.button }]}
        >
          {!pressed && !selected && <Gloss strength={0.12} />}
          <Text style={[styles.chipText, engraved, !selected && { color: colors.text }]}>{label}</Text>
          {badge ? <Text style={[styles.chipBadge, engraved, selected && { color: '#ffffffd0' }]}>{badge}</Text> : null}
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min = -20,
  max = 20,
  format = (n: number) => (n > 0 ? `+${n}` : `${n}`),
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  format?: (n: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Btn small variant="ghost" title="−" onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn} />
      <View style={styles.stepWell}>
        <Text style={styles.stepValue}>{format(value)}</Text>
      </View>
      <Btn small variant="ghost" title="+" onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepBtn} />
    </View>
  );
}

/** Classic glossy segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o, i) => {
        const on = value === o.value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ flex: 1 }}>
            <LinearGradient
              colors={on ? [shade(colors.wave, -0.4), colors.waveDeep, colors.wave] : ['#4a3d7a', '#2c2350', '#1f1840']}
              style={[
                styles.segment,
                i === 0 && { borderTopLeftRadius: radius.sm - 1, borderBottomLeftRadius: radius.sm - 1 },
                i === options.length - 1 && {
                  borderTopRightRadius: radius.sm - 1,
                  borderBottomRightRadius: radius.sm - 1,
                  borderRightWidth: 0,
                },
                { boxShadow: on ? 'inset 0 2px 5px rgba(0,0,0,0.6)' : 'inset 0 1px 0 rgba(255,255,255,0.18)' },
              ]}
            >
              <Text style={[styles.segmentText, engraved, on && { color: '#fff' }]}>{o.label}</Text>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, style, gap = 2 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(gap) }, style]}>{children}</View>;
}

/** An etched groove. */
export function Divider() {
  return (
    <View style={{ marginVertical: space(2) }}>
      <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
    </View>
  );
}

/** A little LED. */
export function Dot({ on }: { on: boolean }) {
  return (
    <View
      accessibilityLabel={on ? 'online' : 'offline'}
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: on ? '#3ef0a0' : '#3a3150',
        borderWidth: 1,
        borderColor: on ? '#0d6b45' : '#120c22',
        boxShadow: on ? '0 0 6px rgba(62,240,160,0.9), inset 0 1px 1px rgba(255,255,255,0.8)' : 'inset 0 1px 2px rgba(0,0,0,0.8)',
      }}
    />
  );
}

/** An ivory d20 face. `ring` outlines it (e.g. green for success). */
export function Die({
  value,
  size = 48,
  ring,
  selected,
  onPress,
}: {
  value: number | string;
  size?: number;
  ring?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const face = (
    <LinearGradient
      colors={selected ? ['#e9f8ff', '#bfe6fa'] : ['#fffdf6', '#e6dec8']}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#a89e82',
        boxShadow: [
          'inset 0 2px 1px rgba(255,255,255,0.95)',
          'inset 0 -3px 5px rgba(0,0,0,0.18)',
          '0 3px 5px rgba(0,0,0,0.6)',
          ring ? `0 0 0 3px ${ring}` : selected ? `0 0 0 3px ${colors.waveLight}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      }}
    >
      <Text style={[{ color: colors.ink, fontSize: size * 0.44, fontWeight: '900' }, embossed]}>{value}</Text>
    </LinearGradient>
  );
  return onPress ? <Pressable onPress={onPress}>{face}</Pressable> : face;
}

const styles = StyleSheet.create({
  scrollBody: { paddingBottom: space(10) },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: space(4), gap: space(4) },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.edge,
    padding: space(4),
    gap: space(3),
    overflow: 'hidden',
    boxShadow: shadows.raised,
  },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  gradCard: {
    borderRadius: radius.md,
    padding: space(4),
    gap: space(2),
    borderWidth: 1,
    borderColor: colors.edge,
    overflow: 'hidden',
    boxShadow: shadows.raised,
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  btnOuter: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  btnSmall: { minHeight: 34 },
  btnFill: {
    flex: 1,
    borderRadius: radius.sm - 1,
    paddingHorizontal: space(5),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', ...engraved },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, ...engraved },
  h2: { fontSize: 19, fontWeight: '700', ...engraved },
  body: { fontSize: 15, lineHeight: 21 },
  input: {
    fontFamily,
    backgroundColor: '#0e0a1c',
    color: colors.text,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.edge,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    fontSize: 15,
    boxShadow: shadows.inset,
  },
  chipOuter: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.edge },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.sm - 1,
    overflow: 'hidden',
  },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipBadge: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  stepBtn: { width: 38 },
  stepWell: {
    minWidth: 46,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#0e0a1c',
    borderWidth: 1,
    borderColor: colors.edge,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.inset,
  },
  stepValue: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.edge,
    boxShadow: '0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.5)',
  },
  segment: {
    paddingVertical: space(2.5),
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.edge,
  },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
