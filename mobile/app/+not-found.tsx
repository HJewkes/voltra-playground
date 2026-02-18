import { Link, Stack } from 'expo-router';
import { Text, View, TouchableOpacity } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-surface-400 p-5">
        <Text className="text-xl font-bold text-text-primary">This screen doesn't exist.</Text>

        <Link href="/" asChild>
          <TouchableOpacity className="mt-4 py-4">
            <Text className="text-brand-primary">Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}
