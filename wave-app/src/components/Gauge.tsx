import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

/**
 * Horizontal Wave/Void gauge with the Line of Power in the middle.
 * gauge ∈ [-max, max]; positive is the Wave side.
 */
export function Gauge({ gauge, max }: { gauge: number; max: number }) {
  const pct = ((gauge + max) / (2 * max)) * 100; // 0 = full Void, 100 = full Wave
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.labels}>
        <Text style={[styles.end, { color: colors.void }]}>VOID</Text>
        <Text style={styles.line}>LINE OF POWER</Text>
        <Text style={[styles.end, { color: colors.wave }]}>WAVE</Text>
      </View>
      <LinearGradient
        colors={[colors.voidDeep, colors.void, colors.waveDeep, colors.waveLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.track}
      >
        <View style={styles.center} />
        <View style={[styles.marker, { left: `${pct}%` }]} />
      </LinearGradient>
      <Text style={styles.caption}>
        {gauge > 0 ? `Wave side (+${gauge})` : gauge < 0 ? `Void side (${gauge})` : 'On the Line'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  line: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.muted },
  track: { height: 18, borderRadius: radius.sm, justifyContent: 'center' },
  center: { position: 'absolute', left: '50%', width: 2, marginLeft: -1, top: -3, bottom: -3, backgroundColor: '#fff' },
  marker: {
    position: 'absolute',
    width: 16,
    height: 26,
    marginLeft: -8,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  caption: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
