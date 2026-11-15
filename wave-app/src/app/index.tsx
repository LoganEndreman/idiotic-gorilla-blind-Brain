import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Felt } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

/** Decides where to send the user: setup → sign-in → character creation → home. */
export default function Index() {
  const { configured, loading, session, character } = useAuth();
  if (!configured) return <Redirect href="/setup" />;
  if (loading)
    return (
      <Felt style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.wave} />
      </Felt>
    );
  if (!session) return <Redirect href="/sign-in" />;
  if (!character) return <Redirect href="/character/edit" />;
  return <Redirect href="/home" />;
}
