
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Switch, List, Button, Divider, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('student_diary.db');

const SettingsScreen = () => {
    const [notifications, setNotifications] = React.useState(true);
    const [deadlineReminders, setDeadlineReminders] = React.useState(true);
    const [scheduleChanges, setScheduleChanges] = React.useState(true);
    const [userGroup, setUserGroup] = React.useState('');
    const navigation = useNavigation();

    useEffect(() => {
        loadUserGroup();
    }, []);

    const loadUserGroup = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            if (result) {
                setUserGroup(result.value);
            }
        } catch (error) {
            console.log('Error loading user group:', error);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Добавляем карточку выбора группы */}
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Учебная группа</Title>
                    <Paragraph>Выберите вашу учебную группу для корректного отображения расписания</Paragraph>

                    {userGroup ? (
                        <Chip mode="outlined" style={styles.groupChip}>
                            {userGroup}
                        </Chip>
                    ) : (
                        <Paragraph style={styles.noGroupText}>Группа не выбрана</Paragraph>
                    )}

                    <Button
                        mode="outlined"
                        icon="account-group"
                        onPress={() => navigation.navigate('GroupSelect' as never)}
                        style={styles.button}
                    >
                        {userGroup ? 'Изменить группу' : 'Выбрать группу'}
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Импорт расписания</Title>
                    <Paragraph>Загрузите расписание из Excel файла</Paragraph>

                    <Button
                        mode="contained"
                        icon="file-import"
                        onPress={() => navigation.navigate('Import' as never)}
                        style={styles.button}
                    >
                        Импорт из Excel
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Уведомления</Title>
                    <List.Item
                        title="Включить уведомления"
                        description="Получать push-уведомления"
                        right={() => (
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                            />
                        )}
                    />
                    <List.Item
                        title="Напоминания о дедлайнах"
                        description="Уведомления о заданиях"
                        right={() => (
                            <Switch
                                value={deadlineReminders}
                                onValueChange={setDeadlineReminders}
                            />
                        )}
                    />
                    <List.Item
                        title="Изменения расписания"
                        description="Уведомления об изменениях"
                        right={() => (
                            <Switch
                                value={scheduleChanges}
                                onValueChange={setScheduleChanges}
                            />
                        )}
                    />
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Данные</Title>
                    <Button mode="outlined" style={styles.button}>
                        Создать резервную копию
                    </Button>
                    <Button mode="outlined" style={styles.button}>
                        Восстановить из копии
                    </Button>
                    <Button mode="outlined" style={styles.button} textColor="red">
                        Очистить все данные
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>О приложении</Title>
                    <Paragraph>Дневник студента ВятГУ</Paragraph>
                    <Paragraph>Версия 1.0.0</Paragraph>
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f8f9fa',
    },
    card: {
        marginBottom: 16,
    },
    button: {
        marginVertical: 4,
    },
    groupChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    noGroupText: {
        fontStyle: 'italic',
        color: '#666',
        marginBottom: 12,
    },
});

export default SettingsScreen;