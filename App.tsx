import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import ScheduleScreen from './src/screens/ScheduleScreen';
import NotesScreen from './src/screens/NotesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ImportScreen from './src/screens/ImportScreen';
import GroupSelectScreen from './src/screens/GroupSelectScreen';
import VkScheduleScreen from './src/screens/VkScheduleScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Кастомная цветовая схема
const colorScheme = {
    primary: '#6366F1', // Индиго
    primaryLight: '#A5B4FC',
    primaryDark: '#4338CA',
    secondary: '#EC4899', // Розовый
    background: '#F8FAFC',
    surface: '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    onSurface: '#1E293B',
    outline: '#E2E8F0',
};

// Кастомные шрифты
const fontConfig = {
    displayLarge: {
        fontFamily: 'System',
        fontSize: 57,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 64,
    },
    displayMedium: {
        fontFamily: 'System',
        fontSize: 45,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 52,
    },
    displaySmall: {
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 44,
    },
    headlineLarge: {
        fontFamily: 'System',
        fontSize: 32,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 40,
    },
    headlineMedium: {
        fontFamily: 'System',
        fontSize: 28,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 36,
    },
    headlineSmall: {
        fontFamily: 'System',
        fontSize: 24,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 32,
    },
    titleLarge: {
        fontFamily: 'System',
        fontSize: 22,
        fontWeight: '400' as const,
        letterSpacing: 0,
        lineHeight: 28,
    },
    titleMedium: {
        fontFamily: 'System',
        fontSize: 16,
        fontWeight: '500' as const,
        letterSpacing: 0.15,
        lineHeight: 24,
    },
    titleSmall: {
        fontFamily: 'System',
        fontSize: 14,
        fontWeight: '500' as const,
        letterSpacing: 0.1,
        lineHeight: 20,
    },
    bodyLarge: {
        fontFamily: 'System',
        fontSize: 16,
        fontWeight: '400' as const,
        letterSpacing: 0.15,
        lineHeight: 24,
    },
    bodyMedium: {
        fontFamily: 'System',
        fontSize: 14,
        fontWeight: '400' as const,
        letterSpacing: 0.25,
        lineHeight: 20,
    },
    bodySmall: {
        fontFamily: 'System',
        fontSize: 12,
        fontWeight: '400' as const,
        letterSpacing: 0.4,
        lineHeight: 16,
    },
    labelLarge: {
        fontFamily: 'System',
        fontSize: 14,
        fontWeight: '500' as const,
        letterSpacing: 0.1,
        lineHeight: 20,
    },
    labelMedium: {
        fontFamily: 'System',
        fontSize: 12,
        fontWeight: '500' as const,
        letterSpacing: 0.5,
        lineHeight: 16,
    },
    labelSmall: {
        fontFamily: 'System',
        fontSize: 11,
        fontWeight: '500' as const,
        letterSpacing: 0.5,
        lineHeight: 16,
    },
};

const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: colorScheme.primary,
        primaryContainer: colorScheme.primaryLight,
        secondary: colorScheme.secondary,
        secondaryContainer: '#FBCFE8',
        background: colorScheme.background,
        surface: colorScheme.surface,
        surfaceVariant: '#F1F5F9',
        error: colorScheme.error,
        success: colorScheme.success,
        warning: colorScheme.warning,
        onSurface: colorScheme.onSurface,
        outline: colorScheme.outline,
        elevation: {
            level0: 'transparent',
            level1: '#FFFFFF',
            level2: '#FFFFFF',
            level3: '#FFFFFF',
            level4: '#FFFFFF',
            level5: '#FFFFFF',
        },
    },
    fonts: configureFonts({ config: fontConfig }),
    roundness: 12,
};

// Кастомная тема для навигации
const navigationTheme = {
    ...NavigationDefaultTheme,
    colors: {
        ...NavigationDefaultTheme.colors,
        primary: colorScheme.primary,
        background: colorScheme.background,
        card: colorScheme.surface,
        text: colorScheme.onSurface,
        border: colorScheme.outline,
    },
};

const SettingsStack = () => (
    <Stack.Navigator
        screenOptions={{
            headerStyle: {
                backgroundColor: colorScheme.surface,
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: colorScheme.primary,
            headerTitleStyle: {
                fontWeight: '600',
            },
            cardStyle: {
                backgroundColor: colorScheme.background,
            },
        }}
    >
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
            <StatusBar style="auto" />
            <NavigationContainer theme={navigationTheme}>
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName: any;

                            if (route.name === 'Расписание') {
                                iconName = focused ? 'calendar' : 'calendar-outline';
                            } else if (route.name === 'Заметки') {
                                iconName = focused ? 'document-text' : 'document-text-outline';
                            } else if (route.name === 'Настройки') {
                                iconName = focused ? 'settings' : 'settings-outline';
                            }

                            return <Ionicons name={iconName} size={size} color={color} />;
                        },
                        tabBarActiveTintColor: colorScheme.primary,
                        tabBarInactiveTintColor: '#64748B',
                        tabBarStyle: {
                            backgroundColor: colorScheme.surface,
                            borderTopColor: colorScheme.outline,
                            borderTopWidth: 1,
                            height: 60,
                            paddingBottom: 8,
                            paddingTop: 8,
                        },
                        tabBarLabelStyle: {
                            fontSize: 12,
                            fontWeight: '500',
                        },
                        headerStyle: {
                            backgroundColor: colorScheme.surface,
                            elevation: 0,
                            shadowOpacity: 0,
                        },
                        headerTintColor: colorScheme.primary,
                        headerTitleStyle: {
                            fontWeight: '700',
                            fontSize: 20,
                        },
                        headerTitleAlign: 'center' as const,
                    })}
                >
                    <Tab.Screen
                        name="Расписание"
                        component={ScheduleScreen}
                        options={{
                            title: 'Расписание',
                            headerShown: true,
                        }}
                    />
                    <Tab.Screen
                        name="Заметки"
                        component={NotesScreen}
                        options={{
                            title: 'Заметки',
                            headerShown: true,
                        }}
                    />
                    <Tab.Screen
                        name="Настройки"
                        component={SettingsStack}
                        options={{
                            title: 'Настройки',
                            headerShown: false,
                        }}
                    />
                </Tab.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}