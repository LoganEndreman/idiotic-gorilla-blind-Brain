import { Platform, TextStyle } from 'react-native';

export const colors = {
  bg: '#120c22',
  surface: '#1d1536',
  surfaceAlt: '#271d47',
  border: '#3a2d63',
  edge: '#07040f', // dark outline around raised parts
  text: '#f4f1ff',
  muted: '#a99fcb',
  faint: '#6f6593',
  wave: '#29a8e8',
  waveDeep: '#0b6fae',
  waveLight: '#5fd0f7',
  void: '#5b3a9c',
  voidDeep: '#1a1030',
  success: '#34c38f',
  danger: '#e5534b',
  warning: '#e0a020',
  ink: '#1d1a24', // text on paper
  inkMuted: '#5b5568',
  paperLine: '#d8cfb8',
};

/**
 * Helvetica everywhere it exists. iOS ships Helvetica Neue; on the web we ask for it
 * by name. Android has no Helvetica (and it can't be bundled without a licence), so
 * it falls back to the system sans-serif.
 */
export const fontFamily = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif',
  web: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  default: 'Helvetica',
});

export const radius = { sm: 8, md: 12, lg: 18 };
export const space = (n: number) => n * 4;

// Skeuomorphic lighting: light comes from above.
export const shadows = {
  raised: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.6)',
  inset: 'inset 0 2px 5px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.09)',
  button: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.25), 0 2px 3px rgba(0,0,0,0.6)',
  pressed: 'inset 0 3px 6px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.08)',
  paper: '0 1px 1px rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.6)',
};

export const panelGradient = ['#30265a', '#1c1535'] as const;

/** Letters pressed into a dark surface. */
export const engraved: TextStyle = {
  textShadowColor: 'rgba(0,0,0,0.9)',
  textShadowOffset: { width: 0, height: -1 },
  textShadowRadius: 0,
};

/** Letters stamped on a light surface. */
export const embossed: TextStyle = {
  textShadowColor: 'rgba(255,255,255,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 0,
};

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Three-stop gel gradient for a base colour. */
export const gel = (base: string) => [shade(base, 0.35), base, shade(base, -0.35)] as const;
