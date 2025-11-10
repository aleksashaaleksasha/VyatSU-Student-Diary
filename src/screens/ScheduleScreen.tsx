// ScheduleScreen.tsx - исправленная версия без добавления пар и без реакции на долгое нажатие

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
import { useIsFocused } from '@react-navigation/native';
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
    const isFocused = useIsFocused();
    const [touchStartX, setTouchStartX] = useState(0);

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

    const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
        // УБИРАЕМ onLongPress - теперь при долгом нажатии ничего не происходит
        <View>
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
        </View>
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

                {/* УБИРАЕМ FAB для добавления пар */}
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
});

export default ScheduleScreen;