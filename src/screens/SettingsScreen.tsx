import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Switch, List, Button, Divider, Chip, Dialog, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('student_diary.db');

const SettingsScreen = () => {
    const [notifications, setNotifications] = React.useState(true);
    const [deadlineReminders, setDeadlineReminders] = React.useState(true);
    const [scheduleChanges, setScheduleChanges] = React.useState(true);
    const [userGroup, setUserGroup] = React.useState('');
    const [clearDialogVisible, setClearDialogVisible] = React.useState(false);
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

    const clearAllData = () => {
        try {
            // Удаляем все данные из всех таблиц
            db.withTransactionSync(() => {
                // Очищаем расписание
                db.runSync('DELETE FROM schedule;');

                // Очищаем историю обновлений
                db.runSync('DELETE FROM update_history;');

                // Очищаем настройки (кроме группы пользователя)
                db.runSync('DELETE FROM settings WHERE key != "user_group";');
            });

            Alert.alert(
                'Успех',
                'Все данные успешно очищены',
                [{ text: 'OK' }]
            );

            setClearDialogVisible(false);

            // Обновляем экраны
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert(
                'Ошибка',
                'Не удалось очистить данные',
                [{ text: 'OK' }]
            );
        }
    };

    const clearAllDataIncludingGroup = () => {
        try {
            // Удаляем все данные из всех таблиц включая группу
            db.withTransactionSync(() => {
                // Очищаем расписание
                db.runSync('DELETE FROM schedule;');

                // Очищаем историю обновлений
                db.runSync('DELETE FROM update_history;');

                // Очищаем все настройки
                db.runSync('DELETE FROM settings;');
            });

            Alert.alert(
                'Успех',
                'Все данные успешно очищены, включая выбранную группу',
                [{ text: 'OK' }]
            );

            setUserGroup('');
            setClearDialogVisible(false);

            // Обновляем экраны
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert(
                'Ошибка',
                'Не удалось очистить данные',
                [{ text: 'OK' }]
            );
        }
    };

    const showClearDialog = () => {
        setClearDialogVisible(true);
    };

    const hideClearDialog = () => {
        setClearDialogVisible(false);
    };

    const handleClearData = () => {
        Alert.alert(
            'Очистка данных',
            'Что вы хотите очистить?',
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                },
                {
                    text: 'Только расписание',
                    onPress: clearAllData,
                    style: 'default',
                },
                {
                    text: 'Всё (включая группу)',
                    onPress: clearAllDataIncludingGroup,
                    style: 'destructive',
                },
            ]
        );
    };

    const createBackup = () => {
        try {
            // Создаем резервную копию всех данных
            const scheduleData = db.getAllSync('SELECT * FROM schedule;') as any[];
            const settingsData = db.getAllSync('SELECT * FROM settings;') as any[];
            const updateHistoryData = db.getAllSync('SELECT * FROM update_history;') as any[];

            const backup = {
                schedule: scheduleData,
                settings: settingsData,
                updateHistory: updateHistoryData,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };

            // В реальном приложении здесь можно сохранить файл или отправить на сервер
            console.log('Backup created:', backup);

            Alert.alert(
                'Резервная копия',
                `Создана резервная копия данных:\n- Расписание: ${scheduleData.length} записей\n- Настройки: ${settingsData.length} записей\n- История: ${updateHistoryData.length} записей`,
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.log('Error creating backup:', error);
            Alert.alert('Ошибка', 'Не удалось создать резервную копию');
        }
    };

    const restoreFromBackup = () => {
        Alert.alert(
            'Восстановление',
            'В текущей версии восстановление из резервной копии доступно только через переустановку приложения. Функция будет добавлена в будущих обновлениях.',
            [{ text: 'OK' }]
        );
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
                    <Title>Обновление из VK</Title>
                    <Paragraph>Автоматическая загрузка расписания из группы ВятГУ</Paragraph>

                    <Button
                        mode="contained"
                        icon="vk"
                        onPress={() => navigation.navigate('VkSchedule' as never)}
                        style={styles.button}
                        buttonColor="#4A76A8"
                    >
                        Управление обновлениями
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
                    <Button
                        mode="outlined"
                        style={styles.button}
                        icon="content-save"
                        onPress={createBackup}
                    >
                        Создать резервную копию
                    </Button>
                    <Button
                        mode="outlined"
                        style={styles.button}
                        icon="backup-restore"
                        onPress={restoreFromBackup}
                    >
                        Восстановить из копии
                    </Button>
                    <Button
                        mode="outlined"
                        style={styles.button}
                        textColor="red"
                        icon="delete"
                        onPress={handleClearData}
                    >
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

            {/* Диалог подтверждения очистки */}
            <Portal>
                <Dialog visible={clearDialogVisible} onDismiss={hideClearDialog}>
                    <Dialog.Title>Очистка данных</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph>Вы уверены, что хотите очистить все данные? Это действие нельзя отменить.</Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={hideClearDialog}>Отмена</Button>
                        <Button onPress={clearAllData} textColor="red">
                            Очистить
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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