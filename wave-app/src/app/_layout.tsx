import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/providers/AuthProvider';
import { colors, engraved, fontFamily } from '@/theme';

function NavBar() {
  return (
    <LinearGradient
      colors={['#4a3b80', '#2a2150', '#1a1333']}
      locations={[0, 0.5, 1]}
      style={{
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.edge,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.6)',
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerBackground: () => <NavBar />,
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily, fontWeight: '800', ...engraved } as object,
            headerBackTitleStyle: { fontFamily },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ title: 'Wave City' }} />
          <Stack.Screen name="character/index" options={{ title: 'Your Character' }} />
          <Stack.Screen name="character/edit" options={{ title: 'Character' }} />
          <Stack.Screen name="blocks/[id]" options={{ title: 'Block' }} />
          <Stack.Screen name="rules" options={{ title: 'Quick Reference', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
