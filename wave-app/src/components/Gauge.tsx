import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { colors, engraved, shadows } from '@/theme';

/**
 * The Line of Power as a glass tube: Void liquid on the left, Wave on the right,
 * an etched line in the middle and a pewter slider marking the character's gauge.
 * gauge ∈ [-max, max]; positive is the Wave side.
 */
export function Gauge({ gauge, max }: { gauge: number; max: number }) {
  const pct = ((gauge + max) / (2 * max)) * 100;
  const ticks = Array.from({ length: 2 * max + 1 }, (_, i) => (i / (2 * max)) * 100);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.labels}>
        <Text style={[styles.end, { color: '#b99aff' }]}>VOID</Text>
        <Text style={styles.line}>LINE OF POWER</Text>
        <Text style={[styles.end, { color: colors.waveLight }]}>WAVE</Text>
      </View>
      <View style={styles.tube}>
        <LinearGradient
          colors={[colors.voidDeep, colors.void, '#7d58c4', colors.wave, colors.waveLight]}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 11 }]}
        />
        {/* glass reflections */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
          locations={[0, 0.45, 0.6, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: 11 }]}
        />
        {ticks.map((t, i) => (
          <View key={i} style={[styles.tick, { left: `${t}%` }, i === max && styles.centerTick]} />
        ))}
        <View style={[styles.knobWrap, { left: `${pct}%` }]}>
          <LinearGradient colors={['#ffffff', '#cfcadb', '#8f899f']} style={styles.knob}>
            <View style={styles.grip} />
            <View style={styles.grip} />
          </LinearGradient>
        </View>
      </View>
      <Text style={styles.caption}>
        {gauge > 0 ? `Wave side (+${gauge})` : gauge < 0 ? `Void side (${gauge})` : 'On the Line'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontSize: 11, fontWeight: '800', letterSpacing: 2, ...engraved },
  line: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.muted, ...engraved },
  tube: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.edge,
    overflow: 'visible',
    justifyContent: 'center',
    boxShadow: shadows.inset,
  },
  tick: { position: 'absolute', top: 5, bottom: 5, width: 1, marginLeft: -0.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  centerTick: {
    top: -4,
    bottom: -4,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#fff',
    boxShadow: '0 0 4px rgba(255,255,255,0.9)',
  },
  knobWrap: { position: 'absolute', marginLeft: -11, top: -6 },
  knob: {
    width: 22,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4a4458',
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 5px rgba(0,0,0,0.7)',
  },
  grip: {
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    boxShadow: '1px 0 0 rgba(255,255,255,0.7)',
  },
  caption: { color: colors.muted, fontSize: 12, textAlign: 'center', ...engraved },
});
