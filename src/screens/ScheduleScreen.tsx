// ScheduleScreen.tsx - с функцией быстрого создания заметки
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
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
    Divider,
    Menu
} from 'react-native-paper';
import { format, isAfter, isToday, isSameDay, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as SQLite from 'expo-sqlite';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

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

const ScheduleScreen = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [touchStartX, setTouchStartX] = useState(0);
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
    const [quickNoteModalVisible, setQuickNoteModalVisible] = useState(false);
    const [quickNote, setQuickNote] = useState({
        title: '',
        content: '',
        deadlineType: 'next_class' as 'date' | 'next_class' | 'none'
    });
    const [selectedNoteDate, setSelectedNoteDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showNoteDatePicker, setShowNoteDatePicker] = useState(false);

    const isFocused = useIsFocused();
    const navigation = useNavigation();

    // Инициализация базы данных и загрузка расписания
    useEffect(() => {
        initDatabase();
        loadScheduleFromDB();
    }, []);

    // Обновление данных при фокусе на экране
    useEffect(() => {
        if (isFocused) {
            console.log('Schedule screen focused - reloading data');
            loadScheduleFromDB();
        }
    }, [isFocused]);

    const initDatabase = () => {
        try {
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

                CREATE TABLE IF NOT EXISTS update_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    new_items_count INTEGER NOT NULL,
                    success INTEGER NOT NULL,
                    error_message TEXT
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    deadline TEXT,
                    deadlineType TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    important INTEGER NOT NULL,
                    completed INTEGER NOT NULL,
                    nextClassDate TEXT
                );
            `);
            console.log('Tables checked/created successfully');
        } catch (error) {
            console.log('Error creating table:', error);
        }
    };

    // Загрузка расписания из базы данных
    const loadScheduleFromDB = () => {
        try {
            const results = db.getAllSync('SELECT * FROM schedule ORDER BY date, time;') as any[];
            console.log(`Loaded ${results.length} schedule items from database`);

            const scheduleData = results.map(item => ({
                ...item,
                date: new Date(item.date)
            }));

            setSchedule(scheduleData);

            if (scheduleData.length > 0) {
                console.log('First schedule item:', scheduleData[0]);
                console.log('Selected date:', selectedDate);
                const todayItems = scheduleData.filter(item => isSameDay(item.date, selectedDate));
                console.log(`Items for selected date: ${todayItems.length}`);
            }
        } catch (error) {
            console.log('Error loading schedule:', error);
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

    // Обработка выбора даты из календаря
    const handleDateSelect = (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
        }
    };

    // Обработка начала касания
    const handleTouchStart = (e: any) => {
        setTouchStartX(e.nativeEvent.pageX);
    };

    // Обработка окончания касания
    const handleTouchEnd = (e: any) => {
        const touchEndX = e.nativeEvent.pageX;
        const diff = touchEndX - touchStartX;

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                handleDateChange('prev');
            } else {
                handleDateChange('next');
            }
        }
    };

    // Обработка долгого нажатия на пару
    const handleLongPress = (item: ScheduleItem) => {
        setSelectedScheduleItem(item);
        setContextMenuVisible(true);
    };

    // Создание быстрой заметки по предмету
    const createQuickNote = () => {
        if (!selectedScheduleItem) return;

        setQuickNote({
            title: `${selectedScheduleItem.subject} - задание`,
            content: '',
            deadlineType: 'next_class'
        });
        setContextMenuVisible(false);
        setQuickNoteModalVisible(true);
    };

    // Сохранение быстрой заметки
    const saveQuickNote = () => {
        if (!selectedScheduleItem || !quickNote.title.trim()) {
            Alert.alert('Ошибка', 'Заполните заголовок заметки');
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

        // Определяем дедлайн в зависимости от типа
        if (quickNote.deadlineType === 'date') {
            deadline = selectedNoteDate.toISOString();
        } else if (quickNote.deadlineType === 'next_class') {
            // Ищем следующее занятие по этому предмету
            const nextClass = getNextClassDate(selectedScheduleItem.subject);
            if (nextClass) {
                deadline = nextClass.toISOString();
                nextClassDate = nextClass.toISOString();
            }
        }

        const note = {
            id: Date.now().toString(),
            title: quickNote.title.trim(),
            content: quickNote.content.trim(),
            subject: selectedScheduleItem.subject,
            deadline,
            deadlineType: quickNote.deadlineType,
            createdAt: new Date().toISOString(),
            important: false,
            completed: false,
            nextClassDate
        };

        try {
            // Сохраняем в базу данных
            db.runSync(
                `INSERT INTO notes (id, title, content, subject, deadline, deadlineType, createdAt, important, completed, nextClassDate) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    note.id,
                    note.title,
                    note.content,
                    note.subject,
                    note.deadline || null,
                    note.deadlineType,
                    note.createdAt,
                    note.important ? 1 : 0,
                    note.completed ? 1 : 0,
                    note.nextClassDate || null
                ]
            );

            Alert.alert('Успех', 'Заметка создана!');
            setQuickNoteModalVisible(false);

            // Переходим в заметки
            navigation.navigate('Заметки' as never);

        } catch (error) {
            console.log('Error saving quick note:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить заметку');
        }
    };

    // Получение даты следующего занятия по предмету
    const getNextClassDate = (subject: string): Date | null => {
        try {
            const result = db.getFirstSync(
                'SELECT date FROM schedule WHERE subject = ? AND date >= date("now") AND type != "Лекция" ORDER BY date LIMIT 1;',
                [subject]
            ) as any;

            if (result) {
                return new Date(result.date);
            }
            return null;
        } catch (error) {
            console.log('Error getting next class date:', error);
            return null;
        }
    };

    const onNoteDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowNoteDatePicker(false);
        }
        if (date) {
            setSelectedNoteDate(date);
        }
    };

    const showNoteDatepicker = () => {
        setShowNoteDatePicker(true);
    };

    const getDeadlineTypeText = (type: string) => {
        switch (type) {
            case 'date': return 'Конкретная дата';
            case 'next_class': return 'До следующего занятия';
            case 'none': return 'Без дедлайна';
            default: return type;
        }
    };

    const formatDisplayDate = (date: Date) => {
        return format(date, 'd MMMM yyyy', { locale: ru });
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
                        {item.student_group && item.student_group !== 'Ручное добавление' && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Группа:</Text>
                                <Text style={styles.detailValue}>{item.student_group}</Text>
                            </View>
                        )}
                    </View>
                </Card.Content>
            </Card>
        </TouchableOpacity>
    );

    return (
        <PaperProvider>
            <View style={styles.container}>
                {/* Заголовок с датой - делаем кликабельным */}
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
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
                                    <Text style={styles.dateHint}>
                                        Нажмите для выбора даты
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
                </TouchableOpacity>

                {/* Календарь для выбора даты */}
                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="default"
                        onChange={handleDateSelect}
                    />
                )}

                {/* Область для свайпов */}
                <View
                    style={styles.swipeArea}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Расписание на выбранный день */}
                    <View style={styles.scheduleSection}>
                        <Title style={styles.sectionTitle}>
                            Расписание ({filteredSchedule.length})
                        </Title>

                        {filteredSchedule.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>
                                    На этот день занятий нет
                                </Text>
                                <Text style={styles.importHint}>
                                    Для добавления расписания используйте импорт из Excel в настройках
                                </Text>
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

                {/* Контекстное меню для пар */}
                <Portal>
                    <Menu
                        visible={contextMenuVisible}
                        onDismiss={() => setContextMenuVisible(false)}
                        anchor={{ x: 0, y: 0 }} // Позиция будет установлена автоматически
                    >
                        <Menu.Item
                            leadingIcon="note-plus"
                            title="Создать заметку"
                            onPress={createQuickNote}
                        />
                        <Menu.Item
                            leadingIcon="information"
                            title="Информация о предмете"
                            onPress={() => {
                                if (selectedScheduleItem) {
                                    Alert.alert(
                                        selectedScheduleItem.subject,
                                        `Преподаватель: ${selectedScheduleItem.teacher}\nАудитория: ${selectedScheduleItem.classroom}\nТип: ${selectedScheduleItem.type}\nВремя: ${selectedScheduleItem.time}`
                                    );
                                }
                                setContextMenuVisible(false);
                            }}
                        />
                    </Menu>
                </Portal>

                {/* Модальное окно быстрой заметки */}
                <Portal>
                    <Modal
                        visible={quickNoteModalVisible}
                        onDismiss={() => setQuickNoteModalVisible(false)}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <Card>
                            <Card.Content>
                                <Title style={styles.modalTitle}>Быстрая заметка</Title>
                                <Text style={styles.modalSubtitle}>
                                    Предмет: {selectedScheduleItem?.subject}
                                </Text>

                                <TextInput
                                    label="Заголовок *"
                                    value={quickNote.title}
                                    onChangeText={(text) => setQuickNote({...quickNote, title: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Название задания"
                                />

                                <TextInput
                                    label="Описание"
                                    value={quickNote.content}
                                    onChangeText={(text) => setQuickNote({...quickNote, content: text})}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={3}
                                    style={styles.input}
                                    placeholder="Подробное описание задания"
                                />

                                <View style={styles.deadlineSection}>
                                    <Text style={styles.label}>Дедлайн</Text>
                                    <View style={styles.deadlineButtons}>
                                        <Button
                                            mode={quickNote.deadlineType === 'next_class' ? "contained" : "outlined"}
                                            onPress={() => setQuickNote({...quickNote, deadlineType: 'next_class'})}
                                            style={styles.deadlineButton}
                                        >
                                            До след. занятия
                                        </Button>
                                        <Button
                                            mode={quickNote.deadlineType === 'date' ? "contained" : "outlined"}
                                            onPress={() => setQuickNote({...quickNote, deadlineType: 'date'})}
                                            style={styles.deadlineButton}
                                        >
                                            Конкретная дата
                                        </Button>
                                        <Button
                                            mode={quickNote.deadlineType === 'none' ? "contained" : "outlined"}
                                            onPress={() => setQuickNote({...quickNote, deadlineType: 'none'})}
                                            style={styles.deadlineButton}
                                        >
                                            Без дедлайна
                                        </Button>
                                    </View>
                                </View>

                                {quickNote.deadlineType === 'date' && (
                                    <View style={styles.dateSection}>
                                        <Text style={styles.dateLabel}>Дата выполнения</Text>
                                        <Button
                                            mode="outlined"
                                            onPress={showNoteDatepicker}
                                            style={styles.dateButton}
                                            icon="calendar"
                                        >
                                            {formatDisplayDate(selectedNoteDate)}
                                        </Button>
                                    </View>
                                )}

                                {quickNote.deadlineType === 'next_class' && selectedScheduleItem && (
                                    <View style={styles.infoSection}>
                                        <Text style={styles.infoText}>
                                            Следующее занятие: {
                                            getNextClassDate(selectedScheduleItem.subject)
                                                ? formatDisplayDate(getNextClassDate(selectedScheduleItem.subject)!)
                                                : 'не найдено'
                                        }
                                        </Text>
                                    </View>
                                )}

                                {showNoteDatePicker && (
                                    <DateTimePicker
                                        value={selectedNoteDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={onNoteDateChange}
                                        minimumDate={new Date()}
                                    />
                                )}
                            </Card.Content>
                            <Card.Actions style={styles.modalActions}>
                                <Button
                                    mode="outlined"
                                    onPress={() => setQuickNoteModalVisible(false)}
                                    style={styles.modalButton}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={saveQuickNote}
                                    style={styles.modalButton}
                                    disabled={!quickNote.title.trim()}
                                >
                                    Сохранить
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
    dateHint: {
        color: '#E3F2FD',
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 4,
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
    importHint: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
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
    deadlineSection: {
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    deadlineButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    deadlineButton: {
        flex: 1,
        minWidth: 100,
    },
    dateSection: {
        marginBottom: 12,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    dateButton: {
        borderColor: '#1E88E5',
    },
    infoSection: {
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    infoText: {
        color: '#1E88E5',
        fontSize: 14,
        fontStyle: 'italic',
    },
    modalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    modalButton: {
        minWidth: 100,
    },
});

export default ScheduleScreen;