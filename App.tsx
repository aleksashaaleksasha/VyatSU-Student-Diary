import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Alert, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ScheduleScreen from './src/screens/ScheduleScreen';
import NotesScreen from './src/screens/NotesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ImportScreen from './src/screens/ImportScreen';
import VkScheduleScreen from './src/screens/VkScheduleScreen';
import { vkApiService, ScheduleUpdateResult } from './src/utils/vkApiService';
import { db } from './src/utils/databaseService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HEADER_TITLE_STYLE = {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
};

const colorScheme = {
    primary: '#6366F1',
    primaryLight: '#A5B4FC',
    primaryDark: '#4338CA',
    secondary: '#EC4899',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    onSurface: '#1E293B',
    outline: '#E2E8F0',
};

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
                backgroundColor: '#1E88E5',
                elevation: 0,
                shadowOpacity: 0,
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: HEADER_TITLE_STYLE,
            headerTitleAlign: 'center' as const,
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
            options={{
                title: 'Импорт расписания',
                headerStyle: {
                    backgroundColor: '#1E88E5',
                    elevation: 0,
                    shadowOpacity: 0,
                },
            }}
        />
        <Stack.Screen
            name="VkSchedule"
            component={VkScheduleScreen}
            options={{
                title: 'Обновление из VK',
                headerStyle: {
                    backgroundColor: '#1E88E5',
                    elevation: 0,
                    shadowOpacity: 0,
                },
            }}
        />
    </Stack.Navigator>
);

const ScheduleHeader = ({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) => {
    return (
        <SafeAreaView style={{ backgroundColor: colorScheme.primary }} edges={['top']}>
            <View style={{
                backgroundColor: colorScheme.primary,
                height: 46,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 16,
                paddingTop: 0,
            }}>
                <Text style={[HEADER_TITLE_STYLE, {
                    flex: 1,
                    textAlign: 'center',
                    marginTop: 0,
                }]}>
                    Расписание
                </Text>

                <TouchableOpacity
                    onPress={onRefresh}
                    disabled={refreshing}
                    style={{
                        padding: 8,
                        position: 'absolute',
                        right: 16,
                        top: 8,
                    }}
                >
                    <Ionicons
                        name="refresh"
                        size={24}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default function App() {
    const [refreshingSchedule, setRefreshingSchedule] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const checkVkUpdates = async () => {
        try {
            const userGroupResult = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            const userGroup = userGroupResult?.value;

            if (!userGroup) {
                Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
                return;
            }

            setRefreshingSchedule(true);

            console.log('🔄 Проверка обновлений из VK...');

            if (Platform.OS === 'web') {
                Alert.alert(
                    'Веб-версия',
                    'В веб-версии используйте раздел "Обновление из VK" в настройках для загрузки расписания',
                    [{ text: 'OK' }]
                );
                setRefreshingSchedule(false);
                return;
            }

            const result = await vkApiService.checkForScheduleUpdates(userGroup);

            if (result.success) {
                db.runSync(
                    `INSERT INTO update_history (timestamp, new_items_count, success, error_message)
                     VALUES (?, ?, ?, ?)`,
                    [new Date().toISOString(), result.newScheduleCount, result.success ? 1 : 0, result.error || '']
                );

                db.runSync(
                    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                    ['last_vk_update', result.lastUpdate.toISOString()]
                );

                if (result.newScheduleCount > 0) {
                    setRefreshTrigger(prev => prev + 1);
                    Alert.alert(
                        'Успех',
                        `Обновлено ${result.newScheduleCount} занятий для группы "${userGroup}"`
                    );
                } else {
                    Alert.alert('Информация', 'Новых расписаний не найдено');
                }
            } else {
                Alert.alert('Ошибка', result.error || 'Не удалось проверить обновления');
            }
        } catch (error) {
            console.error('VK update check error:', error);
            Alert.alert('Ошибка', 'Произошла ошибка при проверке обновлений');
            setRefreshingSchedule(false);
        }
    };

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <StatusBar style="auto" />
                <NavigationContainer theme={navigationTheme}>
                    <View style={{ flex: 1, backgroundColor: colorScheme.background }}>
                        <Tab.Navigator
                            screenOptions={({ route }) => ({
                                tabBarIcon: ({ focused, color, size }) => {
                                    let iconName: any;
                                    let iconColor = '#64748B';

                                    if (route.name === 'Расписание') {
                                        iconName = focused ? 'calendar' : 'calendar-outline';
                                        iconColor = focused ? '#6366F1' : '#64748B';
                                    } else if (route.name === 'Заметки') {
                                        iconName = focused ? 'document-text' : 'document-text-outline';
                                        iconColor = focused ? '#EC4899' : '#64748B';
                                    } else if (route.name === 'Настройки') {
                                        iconName = focused ? 'settings' : 'settings-outline';
                                        iconColor = focused ? '#1E88E5' : '#64748B';
                                    }

                                    return <Ionicons name={iconName} size={size} color={iconColor} />;
                                },
                                tabBarLabel: ({ focused, color, position, children }) => {
                                    let labelColor = '#64748B';

                                    if (route.name === 'Расписание') {
                                        labelColor = focused ? '#6366F1' : '#64748B';
                                    } else if (route.name === 'Заметки') {
                                        labelColor = focused ? '#EC4899' : '#64748B';
                                    } else if (route.name === 'Настройки') {
                                        labelColor = focused ? '#1E88E5' : '#64748B';
                                    }

                                    return (
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '500',
                                            color: labelColor,
                                            marginTop: -4
                                        }}>
                                            {children}
                                        </Text>
                                    );
                                },
                                tabBarStyle: {
                                    backgroundColor: colorScheme.surface,
                                    height: 60,
                                    paddingBottom: 8,
                                    paddingTop: 5,
                                    paddingHorizontal: 20,
                                    borderRadius: 30,
                                    marginHorizontal: 16,
                                    marginBottom: Platform.OS === 'web' ? 16 : 40,
                                    elevation: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 12,
                                    borderTopWidth: 0,
                                    borderWidth: 0,
                                    position: Platform.OS === 'web' ? 'relative' : 'absolute',
                                },
                                headerStyle: {
                                    backgroundColor: colorScheme.surface,
                                    elevation: 0,
                                    shadowOpacity: 0,
                                },
                                headerTintColor: colorScheme.primary,
                                headerTitleStyle: HEADER_TITLE_STYLE,
                                headerTitleAlign: 'center' as const,
                            })}
                        >
                            <Tab.Screen
                                name="Расписание"
                                children={() => (
                                    <ScheduleScreen
                                        onRefreshPress={checkVkUpdates}
                                        refreshing={refreshingSchedule}
                                        refreshTrigger={refreshTrigger}
                                    />
                                )}
                                options={{
                                    title: 'Расписание',
                                    headerShown: true,
                                    headerStyle: {
                                        backgroundColor: '#6366F1',
                                        elevation: 0,
                                        shadowOpacity: 0,
                                    },
                                    headerTintColor: '#FFFFFF',
                                    headerTitleStyle: HEADER_TITLE_STYLE,
                                    headerRight: () => (
                                        <TouchableOpacity
                                            onPress={checkVkUpdates}
                                            disabled={refreshingSchedule}
                                            style={{ padding: 8, marginRight: 8 }}
                                        >
                                            <Ionicons
                                                name="refresh"
                                                size={24}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                    ),
                                }}
                            />
                            <Tab.Screen
                                name="Заметки"
                                component={NotesScreen}
                                options={{
                                    title: 'Заметки',
                                    headerShown: false,
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
                    </View>
                </NavigationContainer>
            </PaperProvider>
        </SafeAreaProvider>
    );
}