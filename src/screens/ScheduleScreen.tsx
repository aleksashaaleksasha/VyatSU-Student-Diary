import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, Animated, Alert } from 'react-native';
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
    Menu,
    IconButton,
    ActivityIndicator,
} from 'react-native-paper';
import { format, isAfter, isToday, isSameDay, addDays, subDays, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { db } from '../utils/databaseService';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { vkApiService, ScheduleUpdateResult } from '../utils/vkApiService';

const { width } = Dimensions.get('window');

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

interface ScheduleScreenProps {
    onRefreshPress?: () => void;
    refreshing?: boolean;
    refreshTrigger?: number; // ДОБАВЛЕНО: триггер для обновления
}

const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
                                                           onRefreshPress,
                                                           refreshing = false,
                                                           refreshTrigger = 0 // ДОБАВЛЕНО: триггер по умолчанию
                                                       }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
    const [contextMenuAnchor, setContextMenuAnchor] = useState({ x: 0, y: 0 });
    const [quickNoteModalVisible, setQuickNoteModalVisible] = useState(false);
    const [quickNote, setQuickNote] = useState({
        content: '',
        deadlineType: 'next_class' as 'date' | 'next_class' | 'none'
    });
    const [selectedNoteDate, setSelectedNoteDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showNoteDatePicker, setShowNoteDatePicker] = useState(false);
    const [userGroup, setUserGroup] = useState('');
    const [lastVkUpdate, setLastVkUpdate] = useState<Date | null>(null);
    const fadeAnim = useState(new Animated.Value(0))[0];

    const isFocused = useIsFocused();
    const navigation = useNavigation();

    useEffect(() => {
        initDatabase();
        loadScheduleFromDB();
        loadUserGroup();
        loadLastVkUpdate();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        if (isFocused) {
            loadScheduleFromDB();
            loadUserGroup();
            loadLastVkUpdate();
        }
    }, [isFocused]);

    // ДОБАВЛЕНО: Эффект для реакции на изменение триггера
    useEffect(() => {
        if (refreshTrigger > 0) {
            console.log('🔄 Triggering schedule refresh from parent, trigger:', refreshTrigger);
            loadScheduleFromDB();
            loadUserGroup();
            loadLastVkUpdate();
        }
    }, [refreshTrigger]);

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
            `);
        } catch (error) {
            console.log('Error creating table:', error);
        }
    };

    const loadScheduleFromDB = () => {
        try {
            const results = db.getAllSync('SELECT * FROM schedule ORDER BY date, time;') as any[];
            const scheduleData = results.map(item => ({
                ...item,
                date: new Date(item.date)
            }));
            console.log('Loaded schedule items:', scheduleData.length);
            setSchedule(scheduleData);
        } catch (error) {
            console.log('Error loading schedule:', error);
        }
    };

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

    const loadLastVkUpdate = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "last_vk_update"') as any;
            if (result) {
                setLastVkUpdate(new Date(result.value));
            }
        } catch (error) {
            console.log('Error loading last VK update:', error);
        }
    };

    const handleRefresh = () => {
        if (onRefreshPress) {
            onRefreshPress(); // Используем callback из App.tsx
        } else {
            // Фолбэк для обратной совместимости
            loadScheduleFromDB();
            loadUserGroup();
            loadLastVkUpdate();
        }
    };

    const filteredSchedule = schedule.filter(item =>
        isSameDay(item.date, selectedDate)
    );

    const handleDateChange = (direction: 'prev' | 'next') => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setSelectedDate(current =>
                direction === 'next' ? addDays(current, 1) : subDays(current, 1)
            );
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleDateSelect = (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Лекция': return '#6366F1';
            case 'Практика': return '#10B981';
            case 'Лабораторная': return '#F59E0B';
            case 'Семинар': return '#EC4899';
            default: return '#6B7280';
        }
    };

    const createQuickNote = () => {
        if (!selectedScheduleItem) return;

        setQuickNote({
            content: '',
            deadlineType: 'next_class'
        });
        setContextMenuVisible(false);
        setQuickNoteModalVisible(true);
    };

    const saveQuickNote = () => {
        if (!selectedScheduleItem || !quickNote.content.trim()) {
            Alert.alert('Ошибка', 'Введите описание заметки');
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

        if (quickNote.deadlineType === 'date') {
            deadline = selectedNoteDate.toISOString();
            console.log('Using custom date:', deadline);
        } else if (quickNote.deadlineType === 'next_class') {
            const nextClass = getNextClassDate(selectedScheduleItem.subject);
            if (nextClass) {
                deadline = nextClass.toISOString();
                nextClassDate = nextClass.toISOString();
                console.log('Using next class date:', deadline);
            } else {
                console.log('No next class found for subject:', selectedScheduleItem.subject);
            }
        }

        const note = {
            id: Date.now().toString(),
            title: `${selectedScheduleItem.subject} - задание`,
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

            setQuickNoteModalVisible(false);
            Alert.alert('Успех', 'Заметка создана');
            navigation.navigate('Заметки' as never);
        } catch (error) {
            console.log('Error saving quick note:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить заметку');
        }
    };

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
        setShowNoteDatePicker(false);
        if (date) {
            setSelectedNoteDate(date);
        }
    };

    const formatDisplayDate = (date: Date) => {
        return format(date, 'd MMMM yyyy', { locale: ru });
    };

    const formatDisplayDateShort = (date: Date) => {
        return format(date, 'dd.MM.yyyy', { locale: ru });
    };

    const showDatePickerModal = () => {
        setShowNoteDatePicker(true);
    };

    const hideDatePicker = () => {
        setShowNoteDatePicker(false);
    };

    const renderScheduleItem = ({ item, index }: { item: ScheduleItem; index: number }) => {
        const classrooms = item.classroom.split(',').map(cls => cls.trim());

        return (
            <Animated.View
                style={[
                    styles.scheduleItemContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{
                            translateY: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [30 * (index + 1), 0],
                            }),
                        }],
                    },
                ]}
            >
                <TouchableOpacity
                    onLongPress={(event) => {
                        setSelectedScheduleItem(item);
                        const { pageX, pageY } = event.nativeEvent;
                        setContextMenuAnchor({ x: pageX, y: pageY });
                        setContextMenuVisible(true);
                    }}
                    delayLongPress={500}
                >
                    <Card style={styles.scheduleCard}>
                        <View style={styles.cardContent}>
                            <View style={styles.lessonHeader}>
                                <View style={styles.timeSection}>
                                    <Text style={styles.timeText}>{item.time}</Text>
                                </View>
                                <Chip
                                    mode="flat"
                                    style={[styles.typeChip, { backgroundColor: getTypeColor(item.type) + '15' }]}
                                    textStyle={{
                                        color: getTypeColor(item.type),
                                        fontSize: 12,
                                        fontWeight: '600',
                                        lineHeight: 16,
                                    }}
                                >
                                    {item.type}
                                </Chip>
                            </View>

                            <Text style={styles.subjectTitle}>{item.subject}</Text>

                            <View style={styles.detailsRow}>
                                <Text style={styles.teacherText} numberOfLines={1}>{item.teacher}</Text>
                                <Text style={styles.classroomText}>
                                    {classrooms.join(', ')}
                                </Text>
                            </View>
                        </View>
                    </Card>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <PaperProvider>
            <View style={styles.container}>
                <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.headerGradient}
                >

                    {/* ИЗМЕНЕНО: Дата и информация об обновлении в одном блоке */}
                    <View style={styles.dateHeader}>
                        <Button
                            icon="chevron-left"
                            onPress={() => handleDateChange('prev')}
                            mode="text"
                            textColor="#FFFFFF"
                            style={styles.navButton}
                        >
                            {''}
                        </Button>

                        <TouchableOpacity
                            style={styles.dateInfo}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateNumber}>
                                {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                            </Text>
                            {/* ИЗМЕНЕНО: Дата обновления под основной датой */}
                            {lastVkUpdate && isValid(lastVkUpdate) && (
                                <Text style={styles.lastUpdateText}>
                                    Обновлено: {format(lastVkUpdate, 'dd.MM.yyyy HH:mm', { locale: ru })}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <Button
                            icon="chevron-right"
                            onPress={() => handleDateChange('next')}
                            mode="text"
                            textColor="#FFFFFF"
                            style={styles.navButton}
                        >
                            {''}
                        </Button>
                    </View>
                </LinearGradient>

                {showDatePicker && (
                    <Modal
                        visible={showDatePicker}
                        onDismiss={() => setShowDatePicker(false)}
                        contentContainerStyle={styles.calendarModalContainer}
                    >
                        <Card style={styles.calendarCard}>
                            <Card.Content>
                                <View style={styles.calendarHeader}>
                                    <Title style={styles.calendarTitle}>Выберите дату</Title>
                                    <Button
                                        icon="close"
                                        mode="text"
                                        onPress={() => setShowDatePicker(false)}
                                        textColor="#6366F1"
                                    >
                                        Закрыть
                                    </Button>
                                </View>
                                <DateTimePicker
                                    value={selectedDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleDateSelect}
                                    locale="ru"
                                    style={styles.calendarPicker}
                                    textColor="#6366F1"
                                    accentColor="#6366F1"
                                />
                            </Card.Content>
                        </Card>
                    </Modal>
                )}

                <View style={styles.content}>
                    <View style={styles.scheduleHeader}>
                        <Text style={styles.sectionTitle}>
                            {format(selectedDate, 'EEEE', { locale: ru }).charAt(0).toUpperCase() + format(selectedDate, 'EEEE', { locale: ru }).slice(1)}
                        </Text>
                        {/* УБРАНО: индикатор обновления из строки дня недели */}
                    </View>

                    {filteredSchedule.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📅</Text>
                            <Title style={styles.emptyTitle}>Пар нет 🎉</Title>
                            <Text style={styles.emptyText}>
                                На этот день занятий не запланировано
                            </Text>
                            <Button
                                mode="outlined"
                                icon="plus"
                                onPress={() => navigation.navigate('Import' as never)}
                                style={styles.emptyButton}
                            >
                                Импортировать расписание
                            </Button>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredSchedule}
                            keyExtractor={item => item.id.toString()}
                            renderItem={renderScheduleItem}
                            contentContainerStyle={styles.scheduleList}
                            showsVerticalScrollIndicator={false}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    )}
                </View>

                {/* ДОБАВЛЕНО: Модальное окно для индикатора обновления */}
                <Portal>
                    <Modal
                        visible={refreshing}
                        dismissable={false}
                        contentContainerStyle={styles.loadingModalContainer}
                    >
                        <Card style={styles.loadingModalCard}>
                            <Card.Content style={styles.loadingModalContent}>
                                <ActivityIndicator size="large" color="#6366F1" />
                                <Title style={styles.loadingModalTitle}>
                                    Проверка обновлений...
                                </Title>
                                <Text style={styles.loadingModalText}>
                                    Идет проверка новых расписаний из VK
                                </Text>
                            </Card.Content>
                        </Card>
                    </Modal>
                </Portal>

                {/* Остальные Portal компоненты остаются без изменений */}
                <Portal>
                    <Menu
                        visible={contextMenuVisible}
                        onDismiss={() => setContextMenuVisible(false)}
                        anchor={contextMenuAnchor}
                        contentStyle={styles.menuContent}
                    >
                        <Menu.Item
                            leadingIcon="note-plus"
                            title="Создать заметку"
                            onPress={createQuickNote}
                        />
                        <Divider />
                        <Menu.Item
                            leadingIcon="information"
                            title="Информация о паре"
                            onPress={() => {
                                setContextMenuVisible(false);
                                if (selectedScheduleItem) {
                                    Alert.alert(
                                        'Информация о паре',
                                        `Предмет: ${selectedScheduleItem.subject}\n` +
                                        `Преподаватель: ${selectedScheduleItem.teacher}\n` +
                                        `Аудитория: ${selectedScheduleItem.classroom}\n` +
                                        `Тип: ${selectedScheduleItem.type}\n` +
                                        `Время: ${selectedScheduleItem.time}`,
                                        [{ text: 'OK' }]
                                    );
                                }
                            }}
                        />
                    </Menu>
                </Portal>

                <Portal>
                    <Modal
                        visible={quickNoteModalVisible}
                        onDismiss={() => setQuickNoteModalVisible(false)}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <Card style={styles.modalCard}>
                            <Card.Content>
                                <Title style={styles.modalTitle}>Быстрая заметка</Title>

                                <View style={styles.subjectDisplay}>
                                    <Text style={styles.subjectLabel}>Предмет</Text>
                                    <Chip mode="outlined" style={styles.subjectChipDisplay}>
                                        {selectedScheduleItem?.subject}
                                    </Chip>
                                </View>

                                <TextInput
                                    label="Описание *"
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
                                            mode={quickNote.deadlineType === 'none' ? "contained" : "outlined"}
                                            onPress={() => setQuickNote({...quickNote, deadlineType: 'none'})}
                                            style={styles.deadlineButton}
                                        >
                                            Без дедлайна
                                        </Button>
                                        <Button
                                            mode={quickNote.deadlineType === 'next_class' ? "contained" : "outlined"}
                                            onPress={() => setQuickNote({...quickNote, deadlineType: 'next_class'})}
                                            style={styles.deadlineButton}
                                        >
                                            До след. пары
                                        </Button>
                                        <Button
                                            mode={quickNote.deadlineType === 'date' ? "contained" : "outlined"}
                                            onPress={() => {
                                                setQuickNote({...quickNote, deadlineType: 'date'});
                                                setTimeout(() => setShowNoteDatePicker(true), 100);
                                            }}
                                            style={styles.deadlineButton}
                                        >
                                            Конкретная дата
                                        </Button>
                                    </View>
                                </View>

                                {quickNote.deadlineType === 'date' && (
                                    <View style={styles.dateSection}>
                                        <Text style={styles.label}>Дата выполнения</Text>
                                        <View style={styles.dateInputRow}>
                                            <TextInput
                                                value={formatDisplayDateShort(selectedNoteDate)}
                                                mode="outlined"
                                                style={styles.dateInput}
                                                editable={false}
                                                right={<TextInput.Icon icon="calendar" onPress={() => setShowNoteDatePicker(true)} />}
                                            />
                                        </View>
                                    </View>
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
                                    disabled={!quickNote.content.trim()}
                                >
                                    Добавить
                                </Button>
                            </Card.Actions>
                        </Card>
                    </Modal>
                </Portal>

                <Portal>
                    <Modal
                        visible={showNoteDatePicker}
                        onDismiss={() => setShowNoteDatePicker(false)}
                        contentContainerStyle={styles.datePickerModalContainer}
                    >
                        <Card style={styles.datePickerCard}>
                            <Card.Content>
                                <Title style={styles.datePickerTitle}>Выберите дату выполнения</Title>
                                <DateTimePicker
                                    value={selectedNoteDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(event, date) => {
                                        if (date) {
                                            setSelectedNoteDate(date);
                                            setShowNoteDatePicker(false);
                                        }
                                    }}
                                    locale="ru"
                                    style={styles.datePicker}
                                    minimumDate={new Date()}
                                />
                                <View style={styles.datePickerActions}>
                                    <Button
                                        mode="contained"
                                        onPress={() => setShowNoteDatePicker(false)}
                                        style={styles.datePickerButton}
                                    >
                                        Готово
                                    </Button>
                                </View>
                            </Card.Content>
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
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        paddingTop: 0,
        paddingBottom: 12,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 2,
        paddingBottom: 2,
        position: 'relative',
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,

    },
    navButton: {
        margin: 0,
        minWidth: 40,
    },
    dateInfo: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 8,
    },
    dateNumber: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 2,
    },
    // ИЗМЕНЕНО: Стиль для даты обновления под основной датой
    lastUpdateText: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.8,
        marginTop: 4,
    },
    content: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F8FAFC',
        paddingBottom: 90,
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        flex: 1,
    },
    // УБРАНО: стили для индикатора обновления в строке
    scheduleList: {
        paddingBottom: 20,
    },
    scheduleItemContainer: {
        marginBottom: 8,
    },
    scheduleCard: {
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        padding: 16,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    timeSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748B',
    },
    typeChip: {
        height: 28,
        paddingVertical: 0,
    },
    subjectTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 12,
        lineHeight: 20,
        textAlign: 'center',
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    teacherText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
        flex: 1,
    },
    classroomText: {
        fontSize: 13,
        color: '#1E293B',
        fontWeight: '500',
    },
    separator: {
        height: 8,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        paddingBottom: 90,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    emptyButton: {
        borderColor: '#6366F1',
        marginBottom: 8,
    },
    // ДОБАВЛЕНО: Стили для модального окна загрузки
    loadingModalContainer: {
        margin: 40,
    },
    loadingModalCard: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },
    loadingModalContent: {
        alignItems: 'center',
        padding: 24,
    },
    loadingModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
        marginTop: 16,
        textAlign: 'center',
    },
    loadingModalText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
    },
    menuContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    modalContainer: {
        margin: 20,
    },
    modalCard: {
        borderRadius: 16,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#1E293B',
        fontSize: 24,
        fontWeight: '700',
    },
    subjectDisplay: {
        marginBottom: 16,
    },
    subjectLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1E293B',
    },
    subjectChipDisplay: {
        alignSelf: 'flex-start',
        backgroundColor: '#E0E7FF',
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    deadlineSection: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1E293B',
    },
    deadlineButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    deadlineButton: {
        flex: 1,
    },
    dateSection: {
        marginBottom: 16,
    },
    dateInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateInput: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    modalButton: {
        minWidth: 100,
    },
    calendarModalContainer: {
        margin: 20,
        backgroundColor: 'transparent',
    },
    calendarCard: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    calendarTitle: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: '700',
    },
    calendarPicker: {
        height: 200,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
    },
    datePickerModalContainer: {
        margin: 20,
        zIndex: 9999,
        elevation: 10,
    },
    datePickerCard: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    datePickerTitle: {
        textAlign: 'center',
        marginBottom: 16,
        color: '#1E293B',
        fontSize: 20,
        fontWeight: '700',
    },
    datePicker: {
        height: 200,
        marginBottom: 16,
    },
    datePickerActions: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    datePickerButton: {
        minWidth: 120,
    },
});

export default ScheduleScreen;