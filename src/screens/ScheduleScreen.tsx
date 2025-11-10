import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, Animated } from 'react-native';
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
    Avatar,
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
    const [quickNoteModalVisible, setQuickNoteModalVisible] = useState(false);
    const [quickNote, setQuickNote] = useState({
        title: '',
        content: '',
        deadlineType: 'next_class' as 'date' | 'next_class' | 'none'
    });
    const [selectedNoteDate, setSelectedNoteDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showNoteDatePicker, setShowNoteDatePicker] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];

    const isFocused = useIsFocused();
    const navigation = useNavigation();

    useEffect(() => {
        initDatabase();
        loadScheduleFromDB();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        if (isFocused) {
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

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Лекция': return 'school';
            case 'Практика': return 'group-work';
            case 'Лабораторная': return 'science';
            case 'Семинар': return 'forum';
            default: return 'class';
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

    const renderScheduleItem = ({ item, index }: { item: ScheduleItem; index: number }) => (
        <Animated.View
            style={[
                styles.scheduleItemContainer,
                {
                    opacity: fadeAnim,
                    transform: [{
                        translateY: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [50 * (index + 1), 0],
                        }),
                    }],
                },
            ]}
        >
            <TouchableOpacity
                onLongPress={() => {
                    setSelectedScheduleItem(item);
                    setContextMenuVisible(true);
                }}
                delayLongPress={500}
            >
                <Card style={styles.scheduleCard}>
                    <LinearGradient
                        colors={['#FFFFFF', '#F8FAFC']}
                        style={styles.cardGradient}
                    >
                        <Card.Content>
                            <View style={styles.scheduleHeader}>
                                <View style={styles.timeIndicator}>
                                    <View style={[styles.timeDot, { backgroundColor: getTypeColor(item.type) }]} />
                                    <Text style={styles.timeText}>{item.time}</Text>
                                </View>
                                <Chip
                                    mode="flat"
                                    style={[styles.typeChip, { backgroundColor: getTypeColor(item.type) + '20' }]}
                                    textStyle={{ color: getTypeColor(item.type), fontWeight: '600' }}
                                    avatar={<Avatar.Icon size={24} icon={getTypeIcon(item.type)} style={{ backgroundColor: getTypeColor(item.type) }} />}
                                >
                                    {item.type}
                                </Chip>
                            </View>

                            <Title style={styles.subjectTitle}>{item.subject}</Title>

                            <View style={styles.detailsGrid}>
                                <View style={styles.detailItem}>
                                    <Avatar.Icon size={24} icon="person" style={styles.detailIcon} />
                                    <Text style={styles.detailText} numberOfLines={1}>{item.teacher}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Avatar.Icon size={24} icon="place" style={styles.detailIcon} />
                                    <Text style={styles.detailText}>{item.classroom}</Text>
                                </View>
                            </View>

                            {item.student_group && item.student_group !== 'Ручное добавление' && (
                                <View style={styles.groupBadge}>
                                    <Text style={styles.groupText}>{item.student_group}</Text>
                                </View>
                            )}
                        </Card.Content>
                    </LinearGradient>
                </Card>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <PaperProvider>
            <View style={styles.container}>
                {/* Красивый хедер с датой */}
                <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.headerGradient}
                >
                    <View style={styles.dateHeader}>
                        <Button
                            icon="chevron-left"
                            onPress={() => handleDateChange('prev')}
                            mode="text"
                            textColor="#FFFFFF"
                            compact
                        >
                            {''}
                        </Button>

                        <TouchableOpacity
                            style={styles.dateInfo}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateDay}>
                                {format(selectedDate, 'EEEE', { locale: ru })}
                            </Text>
                            <Text style={styles.dateNumber}>
                                {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                            </Text>
                            <Text style={styles.dateHint}>
                                Нажмите для выбора даты
                            </Text>
                        </TouchableOpacity>

                        <Button
                            icon="chevron-right"
                            onPress={() => handleDateChange('next')}
                            mode="text"
                            textColor="#FFFFFF"
                            compact
                        >
                            {''}
                        </Button>
                    </View>
                </LinearGradient>

                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="default"
                        onChange={handleDateSelect}
                    />
                )}

                {/* Контент расписания */}
                <View style={styles.content}>
                    <View style={styles.scheduleHeader}>
                        <Text style={styles.sectionTitle}>
                            Расписание на день
                        </Text>
                        <Chip mode="outlined" style={styles.countChip}>
                            {filteredSchedule.length} пар
                        </Chip>
                    </View>

                    {filteredSchedule.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Avatar.Icon
                                size={80}
                                icon="calendar-remove"
                                style={styles.emptyIcon}
                            />
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

                <FAB
                    icon="calendar-today"
                    style={styles.fab}
                    onPress={() => setSelectedDate(new Date())}
                    label="Сегодня"
                    color="#FFFFFF"
                />

                {/* Контекстное меню */}
                <Portal>
                    <Menu
                        visible={contextMenuVisible}
                        onDismiss={() => setContextMenuVisible(false)}
                        anchor={{ x: 0, y: 0 }}
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
                            title="Информация"
                            onPress={() => {
                                if (selectedScheduleItem) {
                                    // Можно добавить детальную информацию
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
                        <Card style={styles.modalCard}>
                            <LinearGradient
                                colors={['#FFFFFF', '#F8FAFC']}
                                style={styles.modalGradient}
                            >
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
                                        <View style={styles.dateSection}>
                                            <Text style={styles.dateLabel}>Дата выполнения</Text>
                                            <Button
                                                mode="outlined"
                                                onPress={() => setShowNoteDatePicker(true)}
                                                style={styles.dateButton}
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
                            </LinearGradient>
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
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    dateInfo: {
        alignItems: 'center',
        flex: 1,
        padding: 10,
    },
    dateDay: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.9,
    },
    dateNumber: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 4,
    },
    dateHint: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.7,
        marginTop: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
    },
    countChip: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
    },
    scheduleList: {
        paddingBottom: 20,
    },
    scheduleItemContainer: {
        marginBottom: 12,
    },
    scheduleCard: {
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardGradient: {
        borderRadius: 16,
    },
    timeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    typeChip: {
        height: 32,
    },
    subjectTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 12,
        lineHeight: 24,
    },
    detailsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    detailIcon: {
        backgroundColor: 'transparent',
        marginRight: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#64748B',
        flex: 1,
    },
    groupBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    groupText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    separator: {
        height: 12,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        backgroundColor: '#E2E8F0',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    emptyButton: {
        borderColor: '#6366F1',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#6366F1',
    },
    menuContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    modalContainer: {
        margin: 20,
    },
    modalCard: {
        borderRadius: 20,
    },
    modalGradient: {
        borderRadius: 20,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 4,
        color: '#1E293B',
        fontSize: 24,
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
        fontSize: 16,
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
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1E293B',
    },
    dateButton: {
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
});

export default ScheduleScreen;