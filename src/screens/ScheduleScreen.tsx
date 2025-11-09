import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Dimensions } from 'react-native';
import {
    Card,
    Title,
    Text,
    FAB,
    Chip,
    Button,
    Modal,
    Portal,
    TextInput,
    Provider as PaperProvider,
    Divider
} from 'react-native-paper';
import { format, isAfter, isToday, isSameDay, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as SQLite from 'expo-sqlite';

const { width } = Dimensions.get('window');


const db = SQLite.openDatabaseSync('student_diary.db');

interface ScheduleItem {
    id: number;
    subject: string;
    time: string;
    teacher: string;
    classroom: string;
    date: Date;
    type: string;
    student_group?: string;
}

interface NewSchedule {
    subject: string;
    time: string;
    teacher: string;
    classroom: string;
    type: string;
}

const ScheduleScreen = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [longPressItem, setLongPressItem] = useState<ScheduleItem | null>(null);
    const [showActionModal, setShowActionModal] = useState(false);
    const [touchStartX, setTouchStartX] = useState(0);

    // Новое занятие
    const [newSchedule, setNewSchedule] = useState<NewSchedule>({
        subject: '',
        time: '',
        teacher: '',
        classroom: '',
        type: 'Лекция'
    });

    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

    // Инициализация базы данных
    useEffect(() => {
        initDatabase();
        loadScheduleFromDB();
    }, []);

    const initDatabase = () => {
        try {
            // Удаляем старую таблицу если существует
            try {
                db.execSync('DROP TABLE IF EXISTS schedule;');
            } catch (error) {
                console.log('Error dropping old table:', error);
            }

            db.execSync(`
                CREATE TABLE IF NOT EXISTS schedule (
                                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                        subject TEXT NOT NULL,
                                                        time TEXT NOT NULL,
                                                        teacher TEXT NOT NULL,
                                                        classroom TEXT NOT NULL,
                                                        date TEXT NOT NULL,
                                                        type TEXT NOT NULL,
                                                        student_group TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS settings (
                                                        key TEXT PRIMARY KEY,
                                                        value TEXT NOT NULL
                );
            `);
            console.log('Tables created successfully');
        } catch (error) {
            console.log('Error creating table:', error);
        }
    };

    // Загрузка расписания из базы данных
    const loadScheduleFromDB = () => {
        try {
            const results = db.getAllSync('SELECT * FROM schedule;') as any[];
            const scheduleData = results.map(item => ({
                ...item,
                date: new Date(item.date)
            }));
            setSchedule(scheduleData);
        } catch (error) {
            console.log('Error loading schedule:', error);
        }
    };

    // Сохранение занятия в базу данных
    const saveScheduleToDB = (scheduleItem: Omit<ScheduleItem, 'id'>): number => {
        try {
            const result = db.runSync(
                `INSERT INTO schedule (subject, time, teacher, classroom, date, type, student_group) 
                 VALUES (?, ?, ?, ?, ?, ?, ?);`,
                [
                    scheduleItem.subject,
                    scheduleItem.time,
                    scheduleItem.teacher,
                    scheduleItem.classroom,
                    scheduleItem.date.toISOString(),
                    scheduleItem.type,
                    'Ручное добавление'
                ]
            );
            console.log('Schedule item saved successfully');
            return result.lastInsertRowId;
        } catch (error) {
            console.log('Error saving schedule item:', error);
            throw error;
        }
    };

    // Удаление занятия из базы данных
    const deleteScheduleFromDB = (id: number) => {
        try {
            db.runSync('DELETE FROM schedule WHERE id = ?;', [id]);
            console.log('Schedule item deleted successfully');
        } catch (error) {
            console.log('Error deleting schedule item:', error);
        }
    };

    // Фильтрация расписания по выбранной дате
    const filteredSchedule = schedule.filter(item =>
        isSameDay(item.date, selectedDate)
    );

    const handleDateChange = (direction: 'prev' | 'next') => {
        setSelectedDate(current =>
            direction === 'next' ? addDays(current, 1) : subDays(current, 1)
        );
    };

    // Обработка начала касания
    const handleTouchStart = (e: any) => {
        setTouchStartX(e.nativeEvent.pageX);
    };

    // Обработка окончания касания
    const handleTouchEnd = (e: any) => {
        const touchEndX = e.nativeEvent.pageX;
        const diff = touchEndX - touchStartX;

        if (Math.abs(diff) > 50) { // Минимальная дистанция свайпа
            if (diff > 0) {
                handleDateChange('prev'); // Свайп вправо
            } else {
                handleDateChange('next'); // Свайп влево
            }
        }
    };

    // Добавление занятия
    const addSchedule = async () => {
        if (!newSchedule.subject.trim() || !newSchedule.time.trim() ||
            !newSchedule.teacher.trim() || !newSchedule.classroom.trim()) {
            Alert.alert('Ошибка', 'Заполните все поля');
            return;
        }

        const scheduleItem = {
            subject: newSchedule.subject.trim(),
            time: newSchedule.time.trim(),
            teacher: newSchedule.teacher.trim(),
            classroom: newSchedule.classroom.trim(),
            date: new Date(selectedDate),
            type: newSchedule.type
        };

        try {
            const newId = saveScheduleToDB(scheduleItem);
            const newScheduleItem: ScheduleItem = {
                ...scheduleItem,
                id: newId,
                student_group: 'Ручное добавление'
            };
            setSchedule(prev => [newScheduleItem, ...prev]);
            setShowAddModal(false);
            resetNewSchedule();
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить занятие');
        }
    };

    // Удаление занятия
    const deleteSchedule = (id: number) => {
        Alert.alert(
            'Удалить занятие',
            'Вы уверены, что хотите удалить это занятие?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => {
                        deleteScheduleFromDB(id);
                        setSchedule(prev => prev.filter(item => item.id !== id));
                        setShowActionModal(false);
                    },
                },
            ]
        );
    };

    const resetNewSchedule = () => {
        setNewSchedule({
            subject: '',
            time: '',
            teacher: '',
            classroom: '',
            type: 'Лекция'
        });
    };

    const handleLongPress = (item: ScheduleItem) => {
        setLongPressItem(item);
        setShowActionModal(true);
    };

    const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
        <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
        >
            <Card style={styles.scheduleCard}>
                <Card.Content>
                    <View style={styles.scheduleHeader}>
                        <Title style={styles.subjectTitle}>{item.subject}</Title>
                        <Chip mode="outlined" style={styles.typeChip}>
                            {item.type}
                        </Chip>
                    </View>

                    <View style={styles.scheduleDetails}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Время:</Text>
                            <Text style={styles.detailValue}>{item.time}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Преподаватель:</Text>
                            <Text style={styles.detailValue}>{item.teacher}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Аудитория:</Text>
                            <Text style={styles.detailValue}>{item.classroom}</Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        </TouchableOpacity>
    );

    return (
        <PaperProvider>
            <View style={styles.container}>
                {/* Заголовок с датой */}
                <Card style={styles.dateHeaderCard}>
                    <Card.Content>
                        <View style={styles.dateHeader}>
                            <Button
                                icon="chevron-left"
                                onPress={() => handleDateChange('prev')}
                                mode="text"
                                compact={true}
                            >
                                {''}
                            </Button>
                            <View style={styles.dateInfo}>
                                <Title style={styles.dateTitle}>
                                    {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                                </Title>
                                <Text style={styles.weekDay}>
                                    {format(selectedDate, 'EEEE', { locale: ru })}
                                </Text>
                            </View>
                            <Button
                                icon="chevron-right"
                                onPress={() => handleDateChange('next')}
                                mode="text"
                                compact={true}
                            >
                                {''}
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                {/* Область для свайпов */}
                <View
                    style={styles.swipeArea}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Расписание на выбранный день */}
                    <View style={styles.scheduleSection}>
                        <Title style={styles.sectionTitle}>
                            Расписание
                        </Title>

                        {filteredSchedule.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>
                                    На этот день занятий нет
                                </Text>
                                <Button
                                    mode="contained"
                                    onPress={() => setShowAddModal(true)}
                                    style={styles.addButton}
                                >
                                    Добавить занятие
                                </Button>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredSchedule}
                                keyExtractor={item => item.id.toString()}
                                renderItem={renderScheduleItem}
                                contentContainerStyle={styles.scheduleList}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                </View>

                {/* Кнопка добавления */}
                <FAB
                    icon="plus"
                    style={styles.fab}
                    onPress={() => setShowAddModal(true)}
                    color="#FFFFFF"
                />

                {/* Модальное окно добавления занятия */}
                <Portal>
                    <Modal
                        visible={showAddModal}
                        onDismiss={() => {
                            setShowAddModal(false);
                            resetNewSchedule();
                        }}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <Card>
                            <Card.Content>
                                <Title style={styles.modalTitle}>Новое занятие</Title>
                                <Text style={styles.modalSubtitle}>
                                    {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                                </Text>

                                <TextInput
                                    label="Предмет *"
                                    value={newSchedule.subject}
                                    onChangeText={(text) => setNewSchedule({...newSchedule, subject: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: Математика"
                                />

                                <TextInput
                                    label="Время *"
                                    value={newSchedule.time}
                                    onChangeText={(text) => setNewSchedule({...newSchedule, time: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: 09:00 - 10:30"
                                />

                                <TextInput
                                    label="Преподаватель *"
                                    value={newSchedule.teacher}
                                    onChangeText={(text) => setNewSchedule({...newSchedule, teacher: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: Иванова А.П."
                                />

                                <TextInput
                                    label="Аудитория *"
                                    value={newSchedule.classroom}
                                    onChangeText={(text) => setNewSchedule({...newSchedule, classroom: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: А-101"
                                />

                                <Text style={styles.typeLabel}>Тип занятия</Text>
                                <View style={styles.typeButtons}>
                                    {['Лекция', 'Практика', 'Лабораторная'].map((type) => (
                                        <Button
                                            key={type}
                                            mode={newSchedule.type === type ? "contained" : "outlined"}
                                            onPress={() => setNewSchedule({...newSchedule, type})}
                                            style={styles.typeButton}
                                        >
                                            {type}
                                        </Button>
                                    ))}
                                </View>
                            </Card.Content>
                            <Card.Actions style={styles.modalActions}>
                                <Button
                                    mode="outlined"
                                    onPress={() => {
                                        setShowAddModal(false);
                                        resetNewSchedule();
                                    }}
                                    style={styles.modalButton}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={addSchedule}
                                    style={styles.modalButton}
                                    disabled={!newSchedule.subject.trim() || !newSchedule.time.trim() ||
                                        !newSchedule.teacher.trim() || !newSchedule.classroom.trim()}
                                >
                                    Добавить
                                </Button>
                            </Card.Actions>
                        </Card>
                    </Modal>
                </Portal>

                {/* Модальное окно действий (долгое нажатие) */}
                <Portal>
                    <Modal
                        visible={showActionModal}
                        onDismiss={() => setShowActionModal(false)}
                        contentContainerStyle={styles.actionModalContainer}
                    >
                        <Card>
                            <Card.Content>
                                <Title style={styles.actionModalTitle}>Действия с занятием</Title>
                                <Text style={styles.actionModalSubject}>
                                    {longPressItem?.subject}
                                </Text>
                            </Card.Content>
                            <Card.Actions style={styles.actionModalActions}>
                                <Button
                                    mode="outlined"
                                    onPress={() => {
                                        setShowActionModal(false);
                                        Alert.alert('Информация', 'Редактирование будет реализовано в будущем');
                                    }}
                                    style={styles.actionModalButton}
                                >
                                    Редактировать
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={() => longPressItem && deleteSchedule(longPressItem.id)}
                                    style={styles.actionModalButton}
                                    buttonColor="#FF3B30"
                                >
                                    Удалить
                                </Button>
                            </Card.Actions>
                        </Card>
                    </Modal>
                </Portal>
            </View>
        </PaperProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    dateHeaderCard: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#1E88E5',
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateInfo: {
        alignItems: 'center',
        flex: 1,
    },
    dateTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    weekDay: {
        color: '#E3F2FD',
        fontSize: 14,
        textAlign: 'center',
    },
    swipeArea: {
        flex: 1,
    },
    scheduleSection: {
        flex: 1,
        padding: 16,
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 16,
        color: '#333',
        textAlign: 'center',
    },
    scheduleList: {
        paddingBottom: 80,
    },
    scheduleCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    subjectTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    typeChip: {
        backgroundColor: '#E3F2FD',
        borderColor: '#1E88E5',
    },
    scheduleDetails: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    addButton: {
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#1E88E5',
    },
    modalContainer: {
        margin: 20,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 4,
        color: '#1E88E5',
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: 16,
        color: '#666',
        fontSize: 14,
    },
    input: {
        marginBottom: 12,
    },
    typeLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    typeButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    typeButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    modalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    modalButton: {
        minWidth: 100,
    },
    actionModalContainer: {
        margin: 40,
    },
    actionModalTitle: {
        textAlign: 'center',
        marginBottom: 8,
        color: '#1E88E5',
    },
    actionModalSubject: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    actionModalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    actionModalButton: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default ScheduleScreen;