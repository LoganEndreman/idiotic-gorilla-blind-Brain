import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

/** Decides where to send the user: setup → sign-in → character creation → home. */
export default function Index() {
  const { configured, loading, session, character } = useAuth();
  if (!configured) return <Redirect href="/setup" />;
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.wave} />
      </View>
    );
  if (!session) return <Redirect href="/sign-in" />;
  if (!character) return <Redirect href="/character/edit" />;
  return <Redirect href="/home" />;
}
