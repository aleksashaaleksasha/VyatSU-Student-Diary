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
} from 'react-native-paper';
import { format, isAfter, isToday, isSameDay, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as SQLite from 'expo-sqlite';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

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
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
    const [contextMenuAnchor, setContextMenuAnchor] = useState({ x: 0, y: 0 });
    const [quickNoteModalVisible, setQuickNoteModalVisible] = useState(false);
    const [quickNote, setQuickNote] = useState({
        title: '',
        content: '',
        deadlineType: 'next_class' as 'date' | 'next_class' | 'none'
    });
    const [selectedNoteDate, setSelectedNoteDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showNoteDatePicker, setShowNoteDatePicker] = useState(false);
    const [userGroup, setUserGroup] = useState('');
    const fadeAnim = useState(new Animated.Value(0))[0];

    const isFocused = useIsFocused();
    const navigation = useNavigation();

    useEffect(() => {
        initDatabase();
        loadScheduleFromDB();
        loadUserGroup();
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
            title: `${selectedScheduleItem.subject} - задание`,
            content: '',
            deadlineType: 'next_class'
        });
        setContextMenuVisible(false);
        setQuickNoteModalVisible(true);
    };

    const saveQuickNote = () => {
        if (!selectedScheduleItem || !quickNote.title.trim()) {
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

        if (quickNote.deadlineType === 'date') {
            deadline = selectedNoteDate.toISOString();
        } else if (quickNote.deadlineType === 'next_class') {
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
            navigation.navigate('Заметки' as never);
        } catch (error) {
            console.log('Error saving quick note:', error);
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
                    {userGroup && (
                        <View style={styles.groupContainer}>
                            <Text style={styles.groupText}>{userGroup}</Text>
                        </View>
                    )}

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
                                    </View>
                                </View>

                                {quickNote.deadlineType === 'date' && (
                                    <View style={styles.dateInputSection}>
                                        <Text style={styles.label}>Дата выполнения</Text>
                                        <Button
                                            mode="outlined"
                                            onPress={() => setShowNoteDatePicker(true)}
                                            style={styles.customDateButton}
                                            icon="calendar"
                                        >
                                            {formatDisplayDate(selectedNoteDate)}
                                        </Button>
                                    </View>
                                )}

                                {showNoteDatePicker && (
                                    <DateTimePicker
                                        value={selectedNoteDate}
                                        mode="date"
                                        display="default"
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
        backgroundColor: '#F8FAFC',
    },
    headerGradient: {
        paddingTop: 0,
        paddingBottom: 14,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    groupContainer: {
        alignItems: 'center',
        marginBottom: 2,
        paddingHorizontal: 16,
    },
    groupText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        opacity: 0.95,
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
    content: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F8FAFC',
        paddingBottom: 90, // ДОБАВЬТЕ ЭТУ СТРОКУ - отступ снизу для панели навигации
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
    },
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
        paddingBottom: 90, // ДОБАВЬТЕ ЭТУ СТРОКУ для пустого состояния
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
        marginBottom: 4,
        color: '#1E293B',
        fontSize: 20,
        fontWeight: '700',
    },
    modalSubtitle: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#64748B',
        fontSize: 14,
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
    dateInputSection: {
        marginBottom: 16,
    },
    customDateButton: {
        borderColor: '#6366F1',
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
});

export default ScheduleScreen;