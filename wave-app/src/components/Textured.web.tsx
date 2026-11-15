import { ReactNode } from 'react';
import { Image, ImageSourcePropType, StyleProp, View, ViewStyle } from 'react-native';

function uriOf(source: ImageSourcePropType): string {
  const s = source as any;
  if (typeof s === 'string') return s;
  if (typeof s === 'number') return (Image as any).resolveAssetSource?.(s)?.uri ?? '';
  return s?.uri ?? s?.default?.uri ?? s?.default ?? '';
}

/**
 * Web version: react-native-web doesn't tile ImageBackground with resizeMode="repeat",
 * so paint the texture with CSS background-repeat instead.
 */
export function Textured({
  source,
  style,
  radius = 0,
  children,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: ReactNode;
}) {
  return (
    <View style={style}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          backgroundImage: `url("${uriOf(source)}")`,
          backgroundRepeat: 'repeat',
          pointerEvents: 'none',
        }}
      />
      {children}
    </View>
  );
}
