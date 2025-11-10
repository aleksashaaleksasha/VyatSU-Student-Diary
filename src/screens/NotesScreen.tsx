import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Animated } from 'react-native';
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
} from 'react-native-paper';
import { format, isAfter, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SQLite from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';

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
        loadNotes();
        loadScheduleSubjects();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

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

    const loadScheduleSubjects = () => {
        try {
            const results = db.getAllSync('SELECT DISTINCT subject FROM schedule WHERE date >= date("now") ORDER BY subject;') as any[];
            const subjects = results.map(item => item.subject).filter(Boolean);
            setScheduleSubjects(subjects);
        } catch (error) {
            console.log('Error loading schedule subjects:', error);
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

    const addNote = () => {
        if (!newNote.title.trim() || !newNote.content.trim() || !newNote.subject.trim()) {
            return;
        }

        let deadline: string | undefined;
        let nextClassDate: string | undefined;

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
        try {
            db.runSync('DELETE FROM notes WHERE id = ?;', [id]);
            setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
        } catch (error) {
            console.log('Error deleting note:', error);
        }
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
        if (!note.deadline) return 'Без дедлайна';

        const deadlineDate = new Date(note.deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return 'Сегодня';
        if (isTomorrow(deadlineDate)) return 'Завтра';
        if (isAfter(today, deadlineDate)) return 'Просрочено';

        if (note.deadlineType === 'next_class') {
            return `До занятия: ${format(deadlineDate, 'd MMM', { locale: ru })}`;
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

    const getDeadlineTypeText = (type: string) => {
        switch (type) {
            case 'date': return 'Конкретная дата';
            case 'next_class': return 'До следующего занятия';
            case 'none': return 'Без дедлайна';
            default: return type;
        }
    };

    const onDateChange = (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
        }
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
                            outputRange: [50 * (index + 1), 0],
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
                <LinearGradient
                    colors={item.important ?
                        ['#FEF3C7', '#FEF3C7'] :
                        item.completed ?
                            ['#F1F5F9', '#F1F5F9'] :
                            ['#FFFFFF', '#F8FAFC']
                    }
                    style={styles.cardGradient}
                >
                    <Card.Content>
                        <View style={styles.noteHeader}>
                            <View style={styles.titleSection}>
                                <Title style={[
                                    styles.title,
                                    item.completed && styles.completedText
                                ]}>
                                    {item.title}
                                </Title>
                                {item.important && (
                                    <Avatar.Icon
                                        size={24}
                                        icon="star"
                                        style={styles.importantIcon}
                                    />
                                )}
                            </View>

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

                        <Text
                            style={[styles.content, item.completed && styles.completedText]}
                            numberOfLines={3}
                        >
                            {item.content}
                        </Text>

                        <View style={styles.noteFooter}>
                            <Chip
                                mode="flat"
                                style={styles.subjectChip}
                                textStyle={{ fontSize: 12, fontWeight: '500' }}
                                avatar={
                                    <Avatar.Icon
                                        size={20}
                                        icon="book"
                                        style={styles.subjectIcon}
                                    />
                                }
                            >
                                {item.subject}
                            </Chip>

                            <View style={styles.actions}>
                                <Button
                                    mode={item.important ? "contained" : "outlined"}
                                    compact
                                    onPress={() => toggleImportant(item.id)}
                                    style={styles.smallButton}
                                    icon="star"
                                >
                                    {''}
                                </Button>
                                <Button
                                    mode={item.completed ? "contained" : "outlined"}
                                    compact
                                    onPress={() => toggleCompleted(item.id)}
                                    style={styles.smallButton}
                                    icon={item.completed ? "check-circle" : "circle-outline"}
                                >
                                    {''}
                                </Button>
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => deleteNote(item.id)}
                                    style={styles.smallButton}
                                    icon="delete"
                                    textColor="#EF4444"
                                >
                                    {''}
                                </Button>
                            </View>
                        </View>
                    </Card.Content>
                </LinearGradient>
            </Card>
        </Animated.View>
    );

    return (
        <PaperProvider>
            <View style={styles.container}>
                {/* Хедер с фильтрами */}
                <LinearGradient
                    colors={['#EC4899', '#F472B6']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <Title style={styles.headerTitle}>Мои заметки</Title>
                        <Text style={styles.headerSubtitle}>
                            {getFilteredNotes().length} заметок
                        </Text>
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
                                label: 'Выполнены',
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
                                {filter === 'completed' ? 'Нет выполненных заметок' : 'Заметок пока нет'}
                            </Title>
                            <Text style={styles.emptyText}>
                                {filter === 'completed'
                                    ? 'Выполненные заметки появятся здесь'
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
                            <LinearGradient
                                colors={['#FFFFFF', '#F8FAFC']}
                                style={styles.modalGradient}
                            >
                                <Card.Content>
                                    <Title style={styles.modalTitle}>Новая заметка</Title>

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
                                                    contentStyle={styles.menuButtonContent}
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
                                                    contentStyle={styles.menuButtonContent}
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
                                                        }
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

                                    {newNote.deadlineType === 'date' && (
                                        <View style={styles.dateSection}>
                                            <Text style={styles.dateLabel}>Дата выполнения</Text>
                                            <Button
                                                mode="outlined"
                                                onPress={() => setShowDatePicker(true)}
                                                style={styles.dateButton}
                                                icon="calendar"
                                            >
                                                {formatDisplayDate(selectedDate)}
                                            </Button>
                                        </View>
                                    )}

                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={selectedDate}
                                            mode="date"
                                            display="default"
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
    headerContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
    },
    headerSubtitle: {
        color: '#FFFFFF',
        fontSize: 16,
        opacity: 0.9,
        marginTop: 4,
    },
    segmentedButtons: {
        marginHorizontal: 20,
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
    cardGradient: {
        borderRadius: 16,
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
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        marginRight: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
        color: '#1E293B',
    },
    importantIcon: {
        backgroundColor: '#F59E0B',
        marginLeft: 8,
    },
    deadlineChip: {
        borderWidth: 1,
    },
    content: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 16,
        lineHeight: 20,
        flex: 1,
        padding: 20,
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    noteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    subjectChip: {
        backgroundColor: '#E0E7FF',
    },
    subjectIcon: {
        backgroundColor: '#6366F1',
    },
    actions: {
        flexDirection: 'row',
        gap: 4,
    },
    smallButton: {
        margin: 0,
        minWidth: 40,
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
        backgroundColor: '#EC4899',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#EC4899',
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
        marginBottom: 20,
        color: '#1E293B',
        fontSize: 24,
        fontWeight: '700',
    },
    menuContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1E293B',
    },
    menuButton: {
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    menuButtonContent: {
        justifyContent: 'space-between',
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
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

export default NotesScreen;