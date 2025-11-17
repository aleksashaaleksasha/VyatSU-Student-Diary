import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Chip, Dialog, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('student_diary.db');

const SettingsScreen = () => {
    const [userGroup, setUserGroup] = useState('');
    const [newGroup, setNewGroup] = useState('');
    const [clearDialogVisible, setClearDialogVisible] = useState(false);
    const navigation = useNavigation();

    useEffect(() => {
        loadUserGroup();
    }, []);

    const loadUserGroup = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            if (result) {
                setUserGroup(result.value);
                setNewGroup(result.value);
            }
        } catch (error) {
            console.log('Error loading user group:', error);
        }
    };

    const saveGroup = () => {
        if (!newGroup.trim()) {
            Alert.alert('Ошибка', 'Введите номер группы');
            return;
        }

        try {
            db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                ['user_group', newGroup.trim()]
            );
            setUserGroup(newGroup.trim());
            Alert.alert('Успех', 'Группа сохранена');
        } catch (error) {
            console.log('Error saving group:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить группу');
        }
    };

    const clearAllData = () => {
        try {
            db.withTransactionSync(() => {
                db.runSync('DELETE FROM schedule;');
                db.runSync('DELETE FROM update_history;');
                db.runSync('DELETE FROM notes;');
                db.runSync('DELETE FROM settings WHERE key != "user_group";');
            });

            Alert.alert('Успех', 'Все данные успешно очищены');
            setClearDialogVisible(false);
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert('Ошибка', 'Не удалось очистить данные');
        }
    };

    const clearAllDataIncludingGroup = () => {
        try {
            db.withTransactionSync(() => {
                db.runSync('DELETE FROM schedule;');
                db.runSync('DELETE FROM update_history;');
                db.runSync('DELETE FROM notes;');
                db.runSync('DELETE FROM settings;');
            });

            setUserGroup('');
            setNewGroup('');
            Alert.alert('Успех', 'Все данные успешно очищены, включая выбранную группу');
            setClearDialogVisible(false);
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert('Ошибка', 'Не удалось очистить данные');
        }
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
            const scheduleData = db.getAllSync('SELECT * FROM schedule;') as any[];
            const settingsData = db.getAllSync('SELECT * FROM settings;') as any[];
            const updateHistoryData = db.getAllSync('SELECT * FROM update_history;') as any[];
            const notesData = db.getAllSync('SELECT * FROM notes;') as any[];

            const backup = {
                schedule: scheduleData,
                settings: settingsData,
                updateHistory: updateHistoryData,
                notes: notesData,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };

            console.log('Backup created:', backup);

            Alert.alert(
                'Резервная копия',
                `Создана резервная копия данных:\n- Расписание: ${scheduleData.length} записей\n- Настройки: ${settingsData.length} записей\n- История: ${updateHistoryData.length} записей\n- Заметки: ${notesData.length} записей`,
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
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Учебная группа</Title>
                    <Paragraph>Введите вашу учебную группу для корректного отображения расписания</Paragraph>

                    {userGroup ? (
                        <Chip mode="outlined" style={styles.groupChip}>
                            Текущая группа: {userGroup}
                        </Chip>
                    ) : null}

                    <TextInput
                        label="Номер группы"
                        value={newGroup}
                        onChangeText={setNewGroup}
                        mode="outlined"
                        style={styles.input}
                        placeholder="Например: ИСПк-104-52-00"
                    />

                    <Button
                        mode="contained"
                        icon="check"
                        onPress={saveGroup}
                        style={styles.button}
                        disabled={!newGroup.trim()}
                    >
                        Сохранить группу
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
                        icon="refresh" // ЗАМЕНИЛ НА refresh
                        onPress={() => navigation.navigate('VkSchedule' as never)}
                        style={styles.button}
                    >
                        Управление обновлениями
                    </Button>
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
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f8f9fa',
        paddingBottom: 90,
    },
    card: {
        marginBottom: 16,
    },
    button: {
        marginVertical: 4,
    },
    input: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    groupChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
});

export default SettingsScreen;