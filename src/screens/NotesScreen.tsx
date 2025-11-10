// NotesScreen.tsx - улучшенная версия
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
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
    Divider
} from 'react-native-paper';
import { format, isAfter, isToday, isTomorrow, addDays, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SQLite from 'expo-sqlite';

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

interface ScheduleItem {
    id: number;
    subject: string;
    date: Date;
    type: string;
}

const NotesScreen = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [scheduleSubjects, setScheduleSubjects] = useState<string[]>([]);
    const [visible, setVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);
    const [deadlineTypeMenuVisible, setDeadlineTypeMenuVisible] = useState(false);

    const [newNote, setNewNote] = useState({
        title: '',
        content: '',
        subject: '',
        deadlineType: 'none' as 'date' | 'next_class' | 'none'
    });

    // Загрузка данных при монтировании
    useEffect(() => {
        loadNotes();
        loadScheduleSubjects();
    }, []);

    // Загрузка заметок из базы данных
    const loadNotes = () => {
        try {
            const results = db.getAllSync('SELECT * FROM notes ORDER BY createdAt DESC;') as any[];
            const loadedNotes = results.map(item => ({
                ...item,
                completed: item.completed === 1
            }));
            setNotes(loadedNotes);
        } catch (error) {
            console.log('Error loading notes:', error);
        }
    };

    // Загрузка предметов из расписания
    const loadScheduleSubjects = () => {
        try {
            const results = db.getAllSync('SELECT DISTINCT subject FROM schedule WHERE date >= date("now") ORDER BY subject;') as any[];
            const subjects = results.map(item => item.subject).filter(Boolean);
            setScheduleSubjects(subjects);
        } catch (error) {
            console.log('Error loading schedule subjects:', error);
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

    const showModal = () => setVisible(true);
    const hideModal = () => {
        setVisible(false);
        setNewNote({
            title: '',
            content: '',
            subject: '',
            deadlineType: 'none'
        });
        setSelectedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    };

    const onDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setSelectedDate(date);
        }
    };

    const showDatepicker = () => {
        setShowDatePicker(true);
    };

    // Добавление новой заметки
    const addNote = () => {
        if (!newNote.title.trim() || !newNote.content.trim() || !newNote.subject.trim()) {
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

        // Определяем дедлайн в зависимости от типа
        if (newNote.deadlineType === 'date') {
            deadline = selectedDate.toISOString();
        } else if (newNote.deadlineType === 'next_class') {
            const nextClass = getNextClassDate(newNote.subject);
            if (nextClass) {
                deadline = nextClass.toISOString();
                nextClassDate = nextClass.toISOString();
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

            setNotes(prevNotes => [note, ...prevNotes]);
            hideModal();
        } catch (error) {
            console.log('Error saving note:', error);
        }
    };

    // Переключение важности
    const toggleImportant = (id: string) => {
        const updatedNotes = notes.map(note =>
            note.id === id ? { ...note, important: !note.important } : note
        );
        setNotes(updatedNotes);

        // Обновляем в базе данных
        const note = updatedNotes.find(n => n.id === id);
        if (note) {
            db.runSync(
                'UPDATE notes SET important = ? WHERE id = ?;',
                [note.important ? 1 : 0, id]
            );
        }
    };

    // Переключение выполнения
    const toggleCompleted = (id: string) => {
        const updatedNotes = notes.map(note =>
            note.id === id ? { ...note, completed: !note.completed } : note
        );
        setNotes(updatedNotes);

        // Обновляем в базе данных
        const note = updatedNotes.find(n => n.id === id);
        if (note) {
            db.runSync(
                'UPDATE notes SET completed = ? WHERE id = ?;',
                [note.completed ? 1 : 0, id]
            );
        }
    };

    // Удаление заметки
    const deleteNote = (id: string) => {
        try {
            db.runSync('DELETE FROM notes WHERE id = ?;', [id]);
            setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
        } catch (error) {
            console.log('Error deleting note:', error);
        }
    };

    const getDeadlineColor = (deadline: string | undefined) => {
        if (!deadline) return '#666';

        const deadlineDate = new Date(deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return '#FF6B6B';
        if (isTomorrow(deadlineDate)) return '#FFA726';
        if (isAfter(today, deadlineDate)) return '#D32F2F';
        return '#666';
    };

    const getDeadlineText = (note: Note) => {
        if (!note.deadline) return 'Без дедлайна';

        const deadlineDate = new Date(note.deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return 'Сегодня';
        if (isTomorrow(deadlineDate)) return 'Завтра';
        if (isAfter(today, deadlineDate)) return 'Просрочено';

        if (note.deadlineType === 'next_class') {
            return `До след. занятия: ${format(deadlineDate, 'd MMMM', { locale: ru })}`;
        }

        return format(deadlineDate, 'd MMMM', { locale: ru });
    };

    const formatDisplayDate = (date: Date) => {
        return format(date, 'd MMMM yyyy', { locale: ru });
    };

    const getDeadlineTypeText = (type: string) => {
        switch (type) {
            case 'date': return 'Конкретная дата';
            case 'next_class': return 'До следующего занятия';
            case 'none': return 'Без дедлайна';
            default: return type;
        }
    };

    const sortedNotes = [...notes].sort((a, b) => {
        if (a.important && !b.important) return -1;
        if (!a.important && b.important) return 1;
        if (!a.deadline && b.deadline) return 1;
        if (a.deadline && !b.deadline) return -1;

        if (a.deadline && b.deadline) {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const renderNote = ({ item }: { item: Note }) => (
        <Card
            style={[
                styles.noteCard,
                item.completed && styles.completedCard,
                item.important && styles.importantCard
            ]}
        >
            <Card.Content>
                <View style={styles.noteHeader}>
                    <Title style={[styles.title, item.completed && styles.completedText]}>
                        {item.title}
                    </Title>
                    <Chip
                        mode="outlined"
                        textStyle={{
                            color: getDeadlineColor(item.deadline),
                            fontSize: 12
                        }}
                        style={{
                            borderColor: getDeadlineColor(item.deadline),
                            backgroundColor: item.completed ? '#E8F5E8' : 'transparent'
                        }}
                    >
                        {getDeadlineText(item)}
                    </Chip>
                </View>

                <Text
                    style={[styles.content, item.completed && styles.completedText]}
                    numberOfLines={3}
                >
                    {item.content}
                </Text>

                <View style={styles.noteFooter}>
                    <Chip
                        mode="outlined"
                        style={styles.subjectChip}
                        textStyle={{ fontSize: 12 }}
                    >
                        {item.subject}
                    </Chip>

                    <View style={styles.actions}>
                        <Button
                            mode={item.important ? "contained" : "outlined"}
                            compact
                            onPress={() => toggleImportant(item.id)}
                            style={styles.smallButton}
                        >
                            Важно
                        </Button>
                        <Button
                            mode={item.completed ? "contained" : "outlined"}
                            compact
                            onPress={() => toggleCompleted(item.id)}
                            style={styles.smallButton}
                        >
                            Готово
                        </Button>
                        <Button
                            mode="outlined"
                            compact
                            onPress={() => deleteNote(item.id)}
                            style={styles.smallButton}
                            textColor="#FF6B6B"
                        >
                            Удалить
                        </Button>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <PaperProvider>
            <View style={styles.container}>
                <FlatList
                    data={sortedNotes}
                    keyExtractor={item => item.id}
                    renderItem={renderNote}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                <FAB
                    icon="plus"
                    style={styles.fab}
                    onPress={showModal}
                    color="#FFFFFF"
                />

                <Portal>
                    <Modal
                        visible={visible}
                        onDismiss={hideModal}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <Card>
                            <Card.Content>
                                <Title style={styles.modalTitle}>Новая заметка</Title>

                                {/* Выбор предмета */}
                                <View style={styles.menuContainer}>
                                    <Text style={styles.label}>Предмет *</Text>
                                    <Menu
                                        visible={subjectMenuVisible}
                                        onDismiss={() => setSubjectMenuVisible(false)}
                                        anchor={
                                            <Button
                                                mode="outlined"
                                                onPress={() => setSubjectMenuVisible(true)}
                                                style={styles.menuButton}
                                                icon="book"
                                            >
                                                {newNote.subject || 'Выберите предмет'}
                                            </Button>
                                        }
                                    >
                                        {scheduleSubjects.map((subject) => (
                                            <Menu.Item
                                                key={subject}
                                                title={subject}
                                                onPress={() => {
                                                    setNewNote({...newNote, subject});
                                                    setSubjectMenuVisible(false);
                                                }}
                                            />
                                        ))}
                                        <Divider />
                                        <Menu.Item
                                            title="Другой предмет..."
                                            onPress={() => {
                                                setNewNote({...newNote, subject: ''});
                                                setSubjectMenuVisible(false);
                                            }}
                                        />
                                    </Menu>
                                </View>

                                {/* Поле для ввода своего предмета */}
                                {!newNote.subject && (
                                    <TextInput
                                        label="Введите предмет *"
                                        value={newNote.subject}
                                        onChangeText={(text) => setNewNote({...newNote, subject: text})}
                                        mode="outlined"
                                        style={styles.input}
                                        placeholder="Например: Математика"
                                    />
                                )}

                                <TextInput
                                    label="Заголовок *"
                                    value={newNote.title}
                                    onChangeText={(text) => setNewNote({...newNote, title: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Краткое описание задания"
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

                                {/* Выбор типа дедлайна */}
                                <View style={styles.menuContainer}>
                                    <Text style={styles.label}>Дедлайн</Text>
                                    <Menu
                                        visible={deadlineTypeMenuVisible}
                                        onDismiss={() => setDeadlineTypeMenuVisible(false)}
                                        anchor={
                                            <Button
                                                mode="outlined"
                                                onPress={() => setDeadlineTypeMenuVisible(true)}
                                                style={styles.menuButton}
                                                icon="calendar"
                                            >
                                                {getDeadlineTypeText(newNote.deadlineType)}
                                            </Button>
                                        }
                                    >
                                        <Menu.Item
                                            title="Без дедлайна"
                                            onPress={() => {
                                                setNewNote({...newNote, deadlineType: 'none'});
                                                setDeadlineTypeMenuVisible(false);
                                            }}
                                        />
                                        <Menu.Item
                                            title="До следующего занятия"
                                            onPress={() => {
                                                if (newNote.subject) {
                                                    const nextClass = getNextClassDate(newNote.subject);
                                                    if (nextClass) {
                                                        setNewNote({...newNote, deadlineType: 'next_class'});
                                                    } else {
                                                        alert('Следующих занятий по этому предмету не найдено');
                                                    }
                                                } else {
                                                    alert('Сначала выберите предмет');
                                                }
                                                setDeadlineTypeMenuVisible(false);
                                            }}
                                        />
                                        <Menu.Item
                                            title="Конкретная дата"
                                            onPress={() => {
                                                setNewNote({...newNote, deadlineType: 'date'});
                                                setDeadlineTypeMenuVisible(false);
                                            }}
                                        />
                                    </Menu>
                                </View>

                                {/* Выбор даты, если выбран тип "date" */}
                                {newNote.deadlineType === 'date' && (
                                    <View style={styles.dateSection}>
                                        <Text style={styles.dateLabel}>Дата выполнения</Text>
                                        <Button
                                            mode="outlined"
                                            onPress={showDatepicker}
                                            style={styles.dateButton}
                                            icon="calendar"
                                        >
                                            {formatDisplayDate(selectedDate)}
                                        </Button>
                                    </View>
                                )}

                                {/* Информация о следующем занятии */}
                                {newNote.deadlineType === 'next_class' && newNote.subject && (
                                    <View style={styles.infoSection}>
                                        <Text style={styles.infoText}>
                                            Следующее занятие: {
                                            getNextClassDate(newNote.subject)
                                                ? formatDisplayDate(getNextClassDate(newNote.subject)!)
                                                : 'не найдено'
                                        }
                                        </Text>
                                    </View>
                                )}

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={onDateChange}
                                        minimumDate={new Date()}
                                    />
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
            </View>
        </PaperProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 16,
    },
    listContent: {
        paddingBottom: 80,
    },
    noteCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    importantCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#1E88E5',
    },
    completedCard: {
        backgroundColor: '#f8f9fa',
        opacity: 0.7,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#666',
    },
    content: {
        fontSize: 14,
        color: '#333',
        marginBottom: 12,
        lineHeight: 20,
    },
    noteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    subjectChip: {
        backgroundColor: '#E3F2FD',
        borderColor: '#1E88E5',
    },
    actions: {
        flexDirection: 'row',
        gap: 4,
    },
    smallButton: {
        margin: 0,
        padding: 0,
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
        marginBottom: 16,
        color: '#1E88E5',
    },
    input: {
        marginBottom: 12,
    },
    menuContainer: {
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    menuButton: {
        borderColor: '#1E88E5',
        justifyContent: 'flex-start',
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

export default NotesScreen;