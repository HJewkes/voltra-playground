import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSemanticColors } from '@titan-design/react-ui';

const t = getSemanticColors('dark');

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
        },
        tabBarActiveTintColor: t['brand-primary'],
        tabBarInactiveTintColor: t['text-tertiary'],
      }}
    >
      <Tabs.Screen
        name="exercise"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
