import { ReactNode } from 'react';
import { ImageBackground, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

/** A view with a tiled texture behind its children (native: repeating ImageBackground). */
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
    <ImageBackground source={source} resizeMode="repeat" style={style} imageStyle={{ borderRadius: radius }}>
      {children}
    </ImageBackground>
  );
}
