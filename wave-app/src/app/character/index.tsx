import { Redirect, router } from 'expo-router';
import { CharacterCard } from '@/components/CharacterCard';
import { Body, Btn, Card, Label, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function CharacterScreen() {
  const { character } = useAuth();
  if (!character) return <Redirect href="/" />;
  return (
    <Screen>
      <CharacterCard character={character} />
      {character.notes ? (
        <Card>
          <Label>Notes</Label>
          <Body>{character.notes}</Body>
        </Card>
      ) : null}
      <Body muted style={{ fontSize: 13 }}>
        This is your only character — the same one plays in every Block. Wave, Void and the gauge are tracked per Block.
      </Body>
      <Btn title="Edit character" variant="ghost" onPress={() => router.push('/character/edit')} />
    </Screen>
  );
}
