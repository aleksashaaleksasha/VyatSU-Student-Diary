import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import ScheduleScreen from './src/screens/ScheduleScreen';
import NotesScreen from './src/screens/NotesScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#1E88E5',
        accent: '#1976D2',
        background: '#FFFFFF',
    },
};

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
                        component={SettingsScreen}
                        options={{ title: 'Настройки' }}
                    />
                </Tab.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}