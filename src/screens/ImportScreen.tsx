
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, List, ActivityIndicator, Chip } from 'react-native-paper';
import { ExcelScheduleParser } from '../utils/excelParser';
import * as SQLite from 'expo-sqlite';
import { useNavigation } from '@react-navigation/native';

const db = SQLite.openDatabaseSync('student_diary.db');

interface ScheduleItem {
    subject: string;
    time: string;
    teacher: string;
    classroom: string;
    date: Date;
    type: string;
    group: string;
}

const ImportScreen: React.FC = () => {
    const [importing, setImporting] = useState(false);
    const [importHistory, setImportHistory] = useState<any[]>([]);
    const [userGroup, setUserGroup] = useState('');
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);
    const navigation = useNavigation();

    useEffect(() => {
        loadUserGroup();
        loadImportHistory();
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

    const saveScheduleToDB = (scheduleItems: ScheduleItem[]): number => {
        let importedCount = 0;

        try {
            db.withTransactionSync(() => {
                scheduleItems.forEach(item => {
                    try {
                        db.runSync(
                            `INSERT OR REPLACE INTO schedule (subject, time, teacher, classroom, date, type, student_group) 
                             VALUES (?, ?, ?, ?, ?, ?, ?);`,
                            [
                                item.subject,
                                item.time,
                                item.teacher,
                                item.classroom,
                                item.date.toISOString(),
                                item.type,
                                item.group
                            ]
                        );
                        importedCount++;
                    } catch (error) {
                        console.log('Error saving item:', error);
                    }
                });
            });

            console.log(`Imported ${importedCount} items successfully`);
            return importedCount;
        } catch (error) {
            console.log('Error in transaction:', error);
            throw error;
        }
    };

    const handleImportFromFile = async () => {
        if (!userGroup) {
            Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
            navigation.navigate('SettingsMain' as never);
            return;
        }

        setImporting(true);

        try {
            const result = await ExcelScheduleParser.importFromExcel(userGroup);

            console.log('Import result:', result);

            if (result.success) {
                if (result.data.length > 0) {
                    // Конвертируем ParsedScheduleItem в ScheduleItem
                    const scheduleItems: ScheduleItem[] = result.data.map(item => ({
                        subject: item.subject,
                        time: item.time,
                        teacher: item.teacher,
                        classroom: item.classroom,
                        date: item.date,
                        type: item.type,
                        group: item.group
                    }));

                    const importedCount = saveScheduleToDB(scheduleItems);

                    // Добавляем в историю
                    const newHistoryItem = {
                        id: Date.now(),
                        title: `Импорт расписания`,
                        description: `Импортировано ${importedCount} занятий для группы ${userGroup}`,
                        date: new Date().toLocaleDateString('ru-RU'),
                        group: userGroup
                    };

                    setImportHistory(prev => [newHistoryItem, ...prev.slice(0, 4)]);

                    Alert.alert(
                        'Успех',
                        `Импортировано ${importedCount} занятий для группы "${userGroup}"`,
                        [{
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }]
                    );
                } else {
                    Alert.alert(
                        'Информация',
                        `Группа "${userGroup}" найдена в файле, но занятий не обнаружено.\n\nДоступные группы: ${result.groups?.join(', ') || 'не найдены'}`
                    );
                }
            } else {
                Alert.alert('Ошибка', result.error || 'Не удалось импортировать данные');
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Произошла ошибка при импорте файла');
            console.error('Import error:', error);
        } finally {
            setImporting(false);
        }
    };

    const loadImportHistory = () => {
        try {
            const results = db.getAllSync('SELECT * FROM schedule ORDER BY date DESC LIMIT 5;') as any[];
            const history = results.map((item, index) => ({
                id: index,
                title: `Расписание ${new Date(item.date).toLocaleDateString('ru-RU')}`,
                description: `${item.subject} - ${item.teacher}`,
                date: new Date(item.date).toLocaleDateString('ru-RU'),
                group: item.student_group
            }));
            setImportHistory(history);
        } catch (error) {
            console.log('Error loading import history:', error);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Импорт расписания</Title>

                    {userGroup ? (
                        <Chip mode="outlined" style={styles.groupChip}>
                            Группа: {userGroup}
                        </Chip>
                    ) : (
                        <Paragraph style={styles.warningText}>
                            Группа не выбрана. Сначала выберите группу в настройках.
                        </Paragraph>
                    )}

                    <Paragraph>Выберите Excel файл для импорта расписания</Paragraph>

                    {importing ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1E88E5" />
                            <Paragraph style={styles.loadingText}>Импорт данных...</Paragraph>
                        </View>
                    ) : (
                        <Button
                            mode="contained"
                            icon="file-import"
                            style={styles.button}
                            onPress={handleImportFromFile}
                            disabled={importing || !userGroup}
                        >
                            Выбрать Excel файл
                        </Button>
                    )}

                    <Paragraph style={styles.note}>
                        Поддерживаются файлы в формате XLSX. Файл должен содержать расписание в стандартном формате ВятГУ.
                    </Paragraph>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Последние импорты</Title>

                    {importHistory.length === 0 ? (
                        <Paragraph style={styles.emptyText}>Нет данных об импортах</Paragraph>
                    ) : (
                        importHistory.map((item) => (
                            <List.Item
                                key={item.id}
                                title={item.title}
                                description={`${item.description} • ${item.date} • ${item.group}`}
                                left={props => <List.Icon {...props} icon="file-check" />}
                            />
                        ))
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Инструкция</Title>
                    <List.Item
                        title="1. Выберите группу"
                        description="Укажите вашу группу в настройках"
                        left={props => <List.Icon {...props} icon="numeric-1-circle" />}
                    />
                    <List.Item
                        title="2. Подготовьте файл"
                        description="Убедитесь, что файл в формате XLSX"
                        left={props => <List.Icon {...props} icon="numeric-2-circle" />}
                    />
                    <List.Item
                        title="3. Выберите файл"
                        description="Нажмите кнопку 'Выбрать Excel файл'"
                        left={props => <List.Icon {...props} icon="numeric-3-circle" />}
                    />
                    <List.Item
                        title="4. Дождитесь импорта"
                        description="Данные автоматически добавятся в расписание"
                        left={props => <List.Icon {...props} icon="numeric-4-circle" />}
                    />
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
        marginVertical: 8,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        textAlign: 'center',
    },
    note: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontStyle: 'italic',
    },
    groupChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    warningText: {
        color: '#FF6B6B',
        fontStyle: 'italic',
        marginBottom: 12,
    },
});

export default ImportScreen;