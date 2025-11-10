
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import ScheduleScreen from './src/screens/ScheduleScreen';
import NotesScreen from './src/screens/NotesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ImportScreen from './src/screens/ImportScreen';
import GroupSelectScreen from './src/screens/GroupSelectScreen';
import VkScheduleScreen from './src/screens/VkScheduleScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#1E88E5',
        accent: '#1976D2',
        background: '#FFFFFF',
    },
};

const SettingsStack = () => (
    <Stack.Navigator>
        <Stack.Screen
            name="SettingsMain"
            component={SettingsScreen}
            options={{ title: 'Настройки' }}
        />
        <Stack.Screen
            name="Import"
            component={ImportScreen}
            options={{ title: 'Импорт расписания' }}
        />
        <Stack.Screen
            name="GroupSelect"
            component={GroupSelectScreen}
            options={{ title: 'Выбор группы' }}
        />
        <Stack.Screen
            name="VkSchedule"
            component={VkScheduleScreen}
            options={{ title: 'Обновление из VK' }}
        />
    </Stack.Navigator>
);

export default function App() {
    return (
        <PaperProvider theme={theme}>
            <NavigationContainer>
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName: any;

                            if (route.name === 'Расписание') {
                                iconName = focused ? 'calendar' : 'calendar-outline';
                            } else if (route.name === 'Заметки') {
                                iconName = focused ? 'list' : 'list-outline';
                            } else if (route.name === 'Настройки') {
                                iconName = focused ? 'settings' : 'settings-outline';
                            }

                            return <Ionicons name={iconName} size={size} color={color} />;
                        },
                        tabBarActiveTintColor: '#1E88E5',
                        tabBarInactiveTintColor: 'gray',
                        headerTintColor: '#1E88E5',
                        headerStyle: { backgroundColor: '#FFFFFF' },
                    })}
                >
                    <Tab.Screen
                        name="Расписание"
                        component={ScheduleScreen}
                        options={{ title: 'Расписание' }}
                    />
                    <Tab.Screen
                        name="Заметки"
                        component={NotesScreen}
                        options={{ title: 'Заметки' }}
                    />
                    <Tab.Screen
                        name="Настройки"
                        component={SettingsStack}
                        options={{ title: 'Настройки', headerShown: false }}
                    />
                </Tab.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}