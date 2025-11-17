import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Animated, Alert, TouchableOpacity } from 'react-native';
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
    Menu,
    Divider,
    Avatar,
    SegmentedButtons,
    IconButton,
} from 'react-native-paper';
import { format, isAfter, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SQLite from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const db = SQLite.openDatabaseSync('student_diary.db');

interface Note {
    id: string;
    title: string;
    content: string;
    subject: string;
    deadline?: string;
    deadlineType: 'date' | 'next_class' | 'none';
    createdAt: string;
    important: boolean;
    completed: boolean;
    nextClassDate?: string;
}

const NotesScreen = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [visible, setVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);
    const [deadlineTypeMenuVisible, setDeadlineTypeMenuVisible] = useState(false);
    const [scheduleSubjects, setScheduleSubjects] = useState<string[]>([]);
    const fadeAnim = useState(new Animated.Value(0))[0];

    const [newNote, setNewNote] = useState({
        title: '',
        content: '',
        subject: '',
        deadlineType: 'none' as 'date' | 'next_class' | 'none'
    });

    useEffect(() => {
        initNotesDatabase();
        loadNotes();
        loadScheduleSubjects();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const initNotesDatabase = () => {
        try {
            db.execSync(`
                CREATE TABLE IF NOT EXISTS notes (
                                                     id TEXT PRIMARY KEY,
                                                     title TEXT NOT NULL,
                                                     content TEXT NOT NULL,
                                                     subject TEXT NOT NULL,
                                                     deadline TEXT,
                                                     deadlineType TEXT NOT NULL,
                                                     createdAt TEXT NOT NULL,
                                                     important INTEGER DEFAULT 0,
                                                     completed INTEGER DEFAULT 0,
                                                     nextClassDate TEXT
                );
            `);
            console.log('Notes table checked/created');
        } catch (error) {
            console.log('Error creating notes table:', error);
        }
    };

    const loadNotes = () => {
        try {
            const results = db.getAllSync('SELECT * FROM notes ORDER BY createdAt DESC;') as any[];
            const loadedNotes = results.map(item => ({
                ...item,
                completed: item.completed === 1,
                important: item.important === 1
            }));
            console.log('Loaded notes:', loadedNotes.length);
            setNotes(loadedNotes);
        } catch (error) {
            console.log('Error loading notes:', error);
        }
    };

    const loadScheduleSubjects = () => {
        try {
            const results = db.getAllSync('SELECT DISTINCT subject FROM schedule WHERE date >= date("now") ORDER BY subject;') as any[];
            const subjects = results.map(item => item.subject).filter(Boolean);
            setScheduleSubjects(subjects);
            console.log('Loaded subjects:', subjects);
        } catch (error) {
            console.log('Error loading schedule subjects:', error);
        }
    };

    const getNextClassDate = (subject: string): Date | null => {
        try {
            const result = db.getFirstSync(
                'SELECT date FROM schedule WHERE subject = ? AND date >= date("now") ORDER BY date LIMIT 1;',
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

    const showModal = () => {
        console.log('Opening modal...');
        setVisible(true);
    };

    const hideModal = () => {
        console.log('Closing modal...');
        setVisible(false);
        setNewNote({
            title: '',
            content: '',
            subject: '',
            deadlineType: 'none'
        });
        setSelectedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        setShowDatePicker(false);
    };

    const addNote = () => {
        console.log('Add note clicked');
        console.log('Current note data:', newNote);

        if (!newNote.title.trim()) {
            Alert.alert('Ошибка', 'Введите заголовок заметки');
            return;
        }
        if (!newNote.content.trim()) {
            Alert.alert('Ошибка', 'Введите описание заметки');
            return;
        }
        if (!newNote.subject.trim()) {
            Alert.alert('Ошибка', 'Введите предмет');
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

        if (newNote.deadlineType === 'date') {
            deadline = selectedDate.toISOString();
            console.log('Using custom date:', deadline);
        } else if (newNote.deadlineType === 'next_class') {
            const nextClass = getNextClassDate(newNote.subject);
            if (nextClass) {
                deadline = nextClass.toISOString();
                nextClassDate = nextClass.toISOString();
                console.log('Using next class date:', deadline);
            } else {
                console.log('No next class found for subject:', newNote.subject);
            }
        }

        const note: Note = {
            id: Date.now().toString(),
            title: newNote.title.trim(),
            content: newNote.content.trim(),
            subject: newNote.subject.trim(),
            deadline,
            deadlineType: newNote.deadlineType,
            createdAt: new Date().toISOString(),
            important: false,
            completed: false,
            nextClassDate
        };

        console.log('Saving note to database:', note);

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

            console.log('Note saved successfully');
            setNotes(prevNotes => [note, ...prevNotes]);
            hideModal();
            Alert.alert('Успех', 'Заметка создана');
        } catch (error) {
            console.log('Error saving note:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить заметку: ' + error);
        }
    };

    const toggleImportant = (id: string) => {
        const updatedNotes = notes.map(note =>
            note.id === id ? { ...note, important: !note.important } : note
        );
        setNotes(updatedNotes);

        const note = updatedNotes.find(n => n.id === id);
        if (note) {
            db.runSync(
                'UPDATE notes SET important = ? WHERE id = ?;',
                [note.important ? 1 : 0, id]
            );
        }
    };

    const toggleCompleted = (id: string) => {
        const updatedNotes = notes.map(note =>
            note.id === id ? { ...note, completed: !note.completed } : note
        );
        setNotes(updatedNotes);

        const note = updatedNotes.find(n => n.id === id);
        if (note) {
            db.runSync(
                'UPDATE notes SET completed = ? WHERE id = ?;',
                [note.completed ? 1 : 0, id]
            );
        }
    };

    const deleteNote = (id: string) => {
        Alert.alert(
            'Удаление заметки',
            'Вы уверены, что хотите удалить эту заметку?',
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => {
                        try {
                            db.runSync('DELETE FROM notes WHERE id = ?;', [id]);
                            setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
                        } catch (error) {
                            console.log('Error deleting note:', error);
                            Alert.alert('Ошибка', 'Не удалось удалить заметку');
                        }
                    },
                },
            ]
        );
    };

    const getDeadlineColor = (deadline: string | undefined) => {
        if (!deadline) return '#64748B';

        const deadlineDate = new Date(deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return '#EF4444';
        if (isTomorrow(deadlineDate)) return '#F59E0B';
        if (isAfter(today, deadlineDate)) return '#DC2626';
        return '#10B981';
    };

    const getDeadlineText = (note: Note) => {
        if (!note.deadline) {
            if (note.deadlineType === 'next_class') {
                return 'До след. пары';
            }
            return 'Без дедлайна';
        }

        const deadlineDate = new Date(note.deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return 'Сегодня';
        if (isTomorrow(deadlineDate)) return 'Завтра';
        if (isAfter(today, deadlineDate)) return 'Просрочено';

        if (note.deadlineType === 'next_class') {
            return `До пары: ${format(deadlineDate, 'd MMM', { locale: ru })}`;
        }

        return format(deadlineDate, 'd MMM', { locale: ru });
    };

    const getFilteredNotes = () => {
        let filtered = [...notes];

        if (filter === 'active') {
            filtered = filtered.filter(note => !note.completed);
        } else if (filter === 'completed') {
            filtered = filtered.filter(note => note.completed);
        }

        return filtered.sort((a, b) => {
            if (a.important && !b.important) return -1;
            if (!a.important && b.important) return 1;
            if (!a.deadline && b.deadline) return 1;
            if (a.deadline && !b.deadline) return -1;

            if (a.deadline && b.deadline) {
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }

            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    };

    const formatDisplayDate = (date: Date) => {
        return format(date, 'd MMMM yyyy', { locale: ru });
    };

    const formatDisplayDateShort = (date: Date) => {
        return format(date, 'dd.MM.yyyy', { locale: ru });
    };

    const onDateChange = (event: any, date?: Date) => {
        if (date) {
            setSelectedDate(date);
        }
    };

    const showDatePickerModal = () => {
        setShowDatePicker(true);
    };

    const hideDatePicker = () => {
        setShowDatePicker(false);
    };

    const confirmDate = () => {
        setShowDatePicker(false);
    };

    const renderNote = ({ item, index }: { item: Note; index: number }) => (
        <Animated.View
            style={[
                styles.noteContainer,
                {
                    opacity: fadeAnim,
                    transform: [{
                        translateY: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20 * (index + 1), 0],
                        }),
                    }],
                },
            ]}
        >
            <Card style={[
                styles.noteCard,
                item.completed && styles.completedCard,
                item.important && styles.importantCard
            ]}>
                <Card.Content style={styles.cardContent}>
                    {/* Верхняя часть с предметом и дедлайном */}
                    <View style={styles.noteHeader}>
                        <Chip
                            mode="flat"
                            style={styles.subjectChip}
                            textStyle={{ fontSize: 12, fontWeight: '600' }}
                        >
                            {item.subject}
                        </Chip>

                        <Chip
                            mode="flat"
                            style={[
                                styles.deadlineChip,
                                {
                                    backgroundColor: getDeadlineColor(item.deadline) + '20',
                                    borderColor: getDeadlineColor(item.deadline) + '40',
                                }
                            ]}
                            textStyle={{
                                color: getDeadlineColor(item.deadline),
                                fontSize: 12,
                                fontWeight: '600'
                            }}
                        >
                            {getDeadlineText(item)}
                        </Chip>
                    </View>

                    {/* Заголовок заметки */}
                    <Text style={[
                        styles.title,
                        item.completed && styles.completedText
                    ]} numberOfLines={2}>
                        {item.title}
                    </Text>

                    {/* Описание заметки */}
                    <Text
                        style={[styles.noteContent, item.completed && styles.completedText]}
                        numberOfLines={3}
                    >
                        {item.content}
                    </Text>

                    {/* Нижняя часть с красивыми кнопками действий */}
                    <View style={styles.actionsContainer}>
                        {/* Кнопка избранного - только иконка */}
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.favoriteButton,
                                item.important && styles.favoriteButtonActive
                            ]}
                            onPress={() => toggleImportant(item.id)}
                        >
                            {item.important ? (
                                <IconButton
                                    icon="star"
                                    size={20}
                                    iconColor="#F59E0B"
                                    style={styles.actionIcon}
                                />
                            ) : (
                                <IconButton
                                    icon="star-outline"
                                    size={20}
                                    iconColor="#64748B"
                                    style={styles.actionIcon}
                                />
                            )}
                        </TouchableOpacity>

                        {/* Кнопка выполнения - только иконка */}
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.completeButton,
                                item.completed && styles.completeButtonActive
                            ]}
                            onPress={() => toggleCompleted(item.id)}
                        >
                            {item.completed ? (
                                <IconButton
                                    icon="check-circle"
                                    size={20}
                                    iconColor="#10B981"
                                    style={styles.actionIcon}
                                />
                            ) : (
                                <IconButton
                                    icon="checkbox-blank-circle-outline"
                                    size={20}
                                    iconColor="#64748B"
                                    style={styles.actionIcon}
                                />
                            )}
                        </TouchableOpacity>

                        {/* Кнопка удаления - только иконка */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.deleteButton]}
                            onPress={() => deleteNote(item.id)}
                        >
                            <IconButton
                                icon="delete-outline"
                                size={20}
                                iconColor="#EF4444"
                                style={styles.actionIcon}
                            />
                        </TouchableOpacity>
                    </View>
                </Card.Content>
            </Card>
        </Animated.View>
    );

    return (
        <PaperProvider>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    {/* Хедер с фильтрами - ОБНОВЛЕННЫЙ как в ScheduleScreen */}
                    <LinearGradient
                        colors={['#EC4899', '#F472B6']}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerTopRow}>
                            <View style={styles.groupContainer}>
                                <Title style={styles.headerTitle}>Мои заметки</Title>
                            </View>
                        </View>

                        <SegmentedButtons
                            value={filter}
                            onValueChange={setFilter}
                            buttons={[
                                {
                                    value: 'all',
                                    label: 'Все',
                                    style: {
                                        backgroundColor: filter === 'all' ? '#FFFFFF20' : 'transparent',
                                    },
                                },
                                {
                                    value: 'active',
                                    label: 'Активные',
                                    style: {
                                        backgroundColor: filter === 'active' ? '#FFFFFF20' : 'transparent',
                                    },
                                },
                                {
                                    value: 'completed',
                                    label: 'Готово',
                                    style: {
                                        backgroundColor: filter === 'completed' ? '#FFFFFF20' : 'transparent',
                                    },
                                },
                            ]}
                            style={styles.segmentedButtons}
                        />
                    </LinearGradient>

                    <View style={styles.content}>
                        {getFilteredNotes().length === 0 ? (
                            <View style={styles.emptyState}>
                                <Avatar.Icon
                                    size={80}
                                    icon="note"
                                    style={styles.emptyIcon}
                                />
                                <Title style={styles.emptyTitle}>
                                    {filter === 'completed' ? 'Нет готовых заметок' : 'Заметок пока нет'}
                                </Title>
                                <Text style={styles.emptyText}>
                                    {filter === 'completed'
                                        ? 'Готовые заметки появятся здесь'
                                        : 'Создайте первую заметку для отслеживания заданий'
                                    }
                                </Text>
                                <Button
                                    mode="contained"
                                    icon="plus"
                                    onPress={showModal}
                                    style={styles.emptyButton}
                                >
                                    Создать заметку
                                </Button>
                            </View>
                        ) : (
                            <FlatList
                                data={getFilteredNotes()}
                                keyExtractor={item => item.id}
                                renderItem={renderNote}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        )}
                    </View>

                    {/* FAB кнопка добавления - перенесена налево */}
                    <FAB
                        icon="plus"
                        style={styles.fab}
                        onPress={showModal}
                        color="#FFFFFF"
                    />

                    {/* Модальное окно создания заметки */}
                    <Portal>
                        <Modal
                            visible={visible}
                            onDismiss={hideModal}
                            contentContainerStyle={styles.modalContainer}
                        >
                            <Card style={styles.modalCard}>
                                <Card.Content>
                                    <Title style={styles.modalTitle}>Новая заметка</Title>

                                    <TextInput
                                        label="Заголовок *"
                                        value={newNote.title}
                                        onChangeText={(text) => setNewNote({...newNote, title: text})}
                                        mode="outlined"
                                        style={styles.input}
                                        placeholder="Название задания"
                                    />

                                    <TextInput
                                        label="Предмет *"
                                        value={newNote.subject}
                                        onChangeText={(text) => setNewNote({...newNote, subject: text})}
                                        mode="outlined"
                                        style={styles.input}
                                        placeholder="Например: Математика"
                                    />

                                    <TextInput
                                        label="Описание *"
                                        value={newNote.content}
                                        onChangeText={(text) => setNewNote({...newNote, content: text})}
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
                                                mode={newNote.deadlineType === 'none' ? "contained" : "outlined"}
                                                onPress={() => setNewNote({...newNote, deadlineType: 'none'})}
                                                style={styles.deadlineButton}
                                            >
                                                Без дедлайна
                                            </Button>
                                            <Button
                                                mode={newNote.deadlineType === 'next_class' ? "contained" : "outlined"}
                                                onPress={() => setNewNote({...newNote, deadlineType: 'next_class'})}
                                                style={styles.deadlineButton}
                                            >
                                                До след. пары
                                            </Button>
                                            <Button
                                                mode={newNote.deadlineType === 'date' ? "contained" : "outlined"}
                                                onPress={() => setNewNote({...newNote, deadlineType: 'date'})}
                                                style={styles.deadlineButton}
                                            >
                                                Конкретная дата
                                            </Button>
                                        </View>
                                    </View>

                                    {newNote.deadlineType === 'date' && (
                                        <View style={styles.dateSection}>
                                            <Text style={styles.label}>Дата выполнения</Text>
                                            <View style={styles.dateInputRow}>
                                                <TextInput
                                                    value={formatDisplayDateShort(selectedDate)}
                                                    mode="outlined"
                                                    style={styles.dateInput}
                                                    editable={false}
                                                    right={<TextInput.Icon icon="calendar" onPress={showDatePickerModal} />}
                                                />
                                                <Button
                                                    mode="outlined"
                                                    onPress={showDatePickerModal}
                                                    style={styles.datePickerButton}
                                                >
                                                    Выбрать
                                                </Button>
                                            </View>
                                        </View>
                                    )}
                                </Card.Content>
                                <Card.Actions style={styles.modalActions}>
                                    <Button
                                        mode="outlined"
                                        onPress={hideModal}
                                        style={styles.modalButton}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        mode="contained"
                                        onPress={addNote}
                                        style={styles.modalButton}
                                        disabled={!newNote.title.trim() || !newNote.content.trim() || !newNote.subject.trim()}
                                    >
                                        Добавить
                                    </Button>
                                </Card.Actions>
                            </Card>
                        </Modal>
                    </Portal>

                    {/* Модальное окно выбора даты */}
                    <Portal>
                        <Modal
                            visible={showDatePicker}
                            onDismiss={hideDatePicker}
                            contentContainerStyle={styles.datePickerModalContainer}
                        >
                            <Card style={styles.datePickerCard}>
                                <Card.Content>
                                    <Title style={styles.datePickerTitle}>Выберите дату</Title>
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event, date) => {
                                            if (date) {
                                                setSelectedDate(date);
                                                setShowDatePicker(false);
                                            }
                                        }}
                                        locale="ru"
                                        style={styles.datePicker}
                                        minimumDate={new Date()}
                                    />
                                    <View style={styles.datePickerActions}>
                                        <Button
                                            mode="contained"
                                            onPress={hideDatePicker}
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
            </SafeAreaView>
        </PaperProvider>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#EC4899',
    },
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    // ОБНОВЛЕННЫЕ СТИЛИ HEADER как в ScheduleScreen
    headerGradient: {
        paddingTop: 8,
        paddingBottom: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    groupContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    segmentedButtons: {
        marginHorizontal: 16,
        marginTop: 8,
    },
    content: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F8FAFC',
        paddingBottom: 90,
    },
    listContent: {
        paddingBottom: 20,
    },
    noteContainer: {
        marginBottom: 12,
    },
    noteCard: {
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardContent: {
        padding: 16,
        gap: 12,
    },
    completedCard: {
        opacity: 0.7,
    },
    importantCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    subjectChip: {
        backgroundColor: '#E0E7FF',
        flex: 1,
    },
    deadlineChip: {
        borderWidth: 1,
        flexShrink: 0,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        lineHeight: 20,
    },
    noteContent: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    // Новые стили для красивых кнопок действий
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    actionButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: {
        margin: 0,
        width: 24,
        height: 24,
    },
    // Стили для кнопки избранного
    favoriteButton: {
        borderColor: '#FEF3C7',
        backgroundColor: '#FFFBEB',
    },
    favoriteButtonActive: {
        borderColor: '#F59E0B',
        backgroundColor: '#FEF3C7',
    },
    // Стили для кнопки выполнения
    completeButton: {
        borderColor: '#D1FAE5',
        backgroundColor: '#ECFDF5',
    },
    completeButtonActive: {
        borderColor: '#10B981',
        backgroundColor: '#D1FAE5',
    },
    // Стили для кнопки удаления
    deleteButton: {
        borderColor: '#FEE2E2',
        backgroundColor: '#FEF2F2',
    },
    separator: {
        height: 12,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        paddingBottom: 90,
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
        backgroundColor: '#EC4899',
    },
    // FAB кнопка перенесена налево
    fab: {
        position: 'absolute',
        margin: 16,
        left: 0,
        bottom: 100,
    },
    modalContainer: {
        margin: 20,
    },
    modalCard: {
        borderRadius: 20,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#1E293B',
        fontSize: 24,
        fontWeight: '700',
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
    datePickerButton: {
        minWidth: 100,
    },
    modalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    modalButton: {
        minWidth: 100,
    },
    // Стили для модального окна выбора даты
    datePickerModalContainer: {
        margin: 20,
    },
    datePickerCard: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
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
});

export default NotesScreen;