import { Link, Stack } from 'expo-router';
import { Text, View, TouchableOpacity } from 'react-native';
import { colors } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5 bg-surface-400">
        <Text className="text-xl font-bold text-content-primary">
          This screen doesn't exist.
        </Text>

        <Link href="/" asChild>
          <TouchableOpacity className="mt-4 py-4">
            <Text style={{ color: colors.primary[500] }}>Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}
