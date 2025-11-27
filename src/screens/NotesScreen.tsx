import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Animated,
    Alert,
    TouchableOpacity,
    ScrollView,
    Platform
} from 'react-native';
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
import { db } from '../utils/databaseService';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const [filter, setFilter] = useState<'all' | 'important' | 'overdue' | 'completed'>('all');
    const [visible, setVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);
    const [scheduleSubjects, setScheduleSubjects] = useState<string[]>([]);
    const [viewNoteModalVisible, setViewNoteModalVisible] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];

    const [newNote, setNewNote] = useState({
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

        if (!newNote.content.trim()) {
            Alert.alert('Ошибка', 'Введите описание заметки');
            return;
        }
        if (!newNote.subject.trim()) {
            Alert.alert('Ошибка', 'Выберите предмет');
            return;
        }

        const title = `${newNote.subject} - задание`;

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
                Alert.alert('Информация', 'Следующая пара по этому предмету не найдена');
                return;
            }
        }

        const note: Note = {
            id: Date.now().toString(),
            title: title,
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
                            if (selectedNote?.id === id) {
                                setViewNoteModalVisible(false);
                                setSelectedNote(null);
                            }
                        } catch (error) {
                            console.log('Error deleting note:', error);
                            Alert.alert('Ошибка', 'Не удалось удалить заметку');
                        }
                    },
                },
            ]
        );
    };

    const openNote = (note: Note) => {
        setSelectedNote(note);
        setEditingNote({...note});
        setIsEditing(false);
        setViewNoteModalVisible(true);
    };

    const saveNoteChanges = () => {
        if (!editingNote) return;

        try {
            db.runSync(
                `UPDATE notes SET
                                  content = ?,
                                  subject = ?,
                                  deadline = ?,
                                  deadlineType = ?,
                                  important = ?,
                                  completed = ?
                 WHERE id = ?;`,
                [
                    editingNote.content,
                    editingNote.subject,
                    editingNote.deadline || null,
                    editingNote.deadlineType,
                    editingNote.important ? 1 : 0,
                    editingNote.completed ? 1 : 0,
                    editingNote.id
                ]
            );

            const updatedNotes = notes.map(note =>
                note.id === editingNote.id ? editingNote : note
            );
            setNotes(updatedNotes);
            setSelectedNote(editingNote);

            Alert.alert('Успех', 'Заметка обновлена');
            setIsEditing(false);
        } catch (error) {
            console.log('Error updating note:', error);
            Alert.alert('Ошибка', 'Не удалось обновить заметку');
        }
    };

    const startEditing = () => {
        if (selectedNote) {
            setEditingNote({...selectedNote});
            setIsEditing(true);
        }
    };

    const cancelEditing = () => {
        setEditingNote(selectedNote ? {...selectedNote} : null);
        setIsEditing(false);
    };

    const getSubjectColor = (subject: string) => {
        const lowerSubject = subject.toLowerCase();
        if (lowerSubject.includes('лекция') || lowerSubject.includes('лек.')) return '#6366F1';
        if (lowerSubject.includes('практика') || lowerSubject.includes('пр.')) return '#10B981';
        if (lowerSubject.includes('лабораторная') || lowerSubject.includes('лаб.')) return '#F59E0B';
        if (lowerSubject.includes('семинар')) return '#EC4899';

        const subjectHash = subject.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const colors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
        return colors[Math.abs(subjectHash) % colors.length];
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

        if (filter === 'important') {
            filtered = filtered.filter(note => note.important && !note.completed);
        } else if (filter === 'overdue') {
            filtered = filtered.filter(note => {
                if (!note.deadline || note.completed) return false;
                const deadlineDate = new Date(note.deadline);
                const today = new Date();
                return isAfter(today, deadlineDate);
            });
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

    const renderNote = ({ item, index }: { item: Note; index: number }) => {
        const subjectColor = getSubjectColor(item.subject);

        return (
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
                <TouchableOpacity onPress={() => openNote(item)}>
                    <Card style={[
                        styles.noteCard,
                        item.completed && styles.completedCard,
                        item.important && styles.importantCard
                    ]}>
                        <Card.Content style={styles.cardContent}>
                            <View style={styles.topRow}>
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
                                        fontSize: 11,
                                        fontWeight: '600'
                                    }}
                                >
                                    {getDeadlineText(item)}
                                </Chip>

                                <TouchableOpacity
                                    style={[
                                        styles.importantButton,
                                        item.important && styles.importantButtonActive
                                    ]}
                                    onPress={() => toggleImportant(item.id)}
                                >
                                    <IconButton
                                        icon={item.important ? "star" : "star-outline"}
                                        size={20}
                                        iconColor={item.important ? "#F59E0B" : "#64748B"}
                                        style={styles.actionIcon}
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.centerContent}>
                                <Text style={[
                                    styles.subjectTitle,
                                    item.completed && styles.completedText
                                ]} numberOfLines={2}>
                                    {item.subject}
                                </Text>

                                <Text
                                    style={[styles.noteContent, item.completed && styles.completedText]}
                                    numberOfLines={3}
                                >
                                    {item.content}
                                </Text>
                            </View>

                            <View style={styles.bottomRow}>
                                <TouchableOpacity
                                    style={[styles.deleteButton]}
                                    onPress={() => deleteNote(item.id)}
                                >
                                    <Text style={styles.deleteButtonText}>Удалить</Text>
                                    <IconButton
                                        icon="delete-outline"
                                        size={20}
                                        iconColor="#EF4444"
                                        style={styles.actionIcon}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.completeButton,
                                        item.completed && styles.completeButtonActive
                                    ]}
                                    onPress={() => toggleCompleted(item.id)}
                                >
                                    <IconButton
                                        icon={item.completed ? "check-circle" : "checkbox-blank-circle-outline"}
                                        size={20}
                                        iconColor={item.completed ? "#10B981" : "#64748B"}
                                        style={styles.actionIcon}
                                    />
                                    <Text style={styles.completeButtonText}>Готово</Text>
                                </TouchableOpacity>
                            </View>
                        </Card.Content>
                    </Card>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <PaperProvider>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <LinearGradient
                        colors={['#EC4899', '#F472B6']}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerTopRow}>
                            <View style={styles.groupContainer}>
                                <Title style={styles.headerTitle}>Мои заметки</Title>
                            </View>
                        </View>

                        <View style={styles.filterScrollContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterScrollContent}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.filterButton,
                                        filter === 'all' && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilter('all')}
                                >
                                    <Text style={[
                                        styles.filterButtonText,
                                        filter === 'all' && styles.filterButtonTextActive
                                    ]}>
                                        Все
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.filterButton,
                                        filter === 'important' && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilter('important')}
                                >
                                    <Text style={[
                                        styles.filterButtonText,
                                        filter === 'important' && styles.filterButtonTextActive
                                    ]}>
                                        Важные
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.filterButton,
                                        filter === 'overdue' && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilter('overdue')}
                                >
                                    <Text style={[
                                        styles.filterButtonText,
                                        filter === 'overdue' && styles.filterButtonTextActive
                                    ]}>
                                        Просроченные
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.filterButton,
                                        filter === 'completed' && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilter('completed')}
                                >
                                    <Text style={[
                                        styles.filterButtonText,
                                        filter === 'completed' && styles.filterButtonTextActive
                                    ]}>
                                        Готовые
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
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
                                        : filter === 'important'
                                            ? 'Важные заметки появятся здесь'
                                            : filter === 'overdue'
                                                ? 'Просроченные заметки появятся здесь'
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
                        style={[
                            styles.fab,
                            Platform.OS === 'web' && styles.fabWeb
                        ]}
                        onPress={showModal}
                        color="#FFFFFF"
                    />

                    <Portal>
                        <Modal
                            visible={visible}
                            onDismiss={hideModal}
                            contentContainerStyle={styles.modalContainer}
                        >
                            <Card style={styles.modalCard}>
                                <Card.Content>
                                    <Title style={styles.modalTitle}>Новая заметка</Title>

                                    <View style={styles.inputSection}>
                                        <Text style={styles.label}>Предмет *</Text>
                                        <Menu
                                            visible={subjectMenuVisible}
                                            onDismiss={() => setSubjectMenuVisible(false)}
                                            anchor={
                                                <Button
                                                    mode="outlined"
                                                    onPress={() => setSubjectMenuVisible(!subjectMenuVisible)}
                                                    style={styles.selectButton}
                                                    contentStyle={styles.selectButtonContent}
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
                                        </Menu>
                                    </View>

                                    <View style={styles.inputSection}>
                                        <Text style={styles.label}>Описание *</Text>
                                        <TextInput
                                            value={newNote.content}
                                            onChangeText={(text) => setNewNote({...newNote, content: text})}
                                            mode="outlined"
                                            multiline
                                            numberOfLines={3}
                                            style={styles.input}
                                            placeholder="Опишите задание..."
                                        />
                                    </View>

                                    <View style={styles.inputSection}>
                                        <Text style={styles.label}>Дедлайн</Text>
                                        <View style={styles.deadlineButtons}>
                                            <Button
                                                mode={newNote.deadlineType === 'none' ? "contained" : "outlined"}
                                                onPress={() => setNewNote({...newNote, deadlineType: 'none'})}
                                                style={styles.deadlineButton}
                                                compact
                                            >
                                                Без дедлайна
                                            </Button>
                                            <Button
                                                mode={newNote.deadlineType === 'next_class' ? "contained" : "outlined"}
                                                onPress={() => setNewNote({...newNote, deadlineType: 'next_class'})}
                                                style={styles.deadlineButton}
                                                compact
                                            >
                                                До след. пары
                                            </Button>
                                            <Button
                                                mode={newNote.deadlineType === 'date' ? "contained" : "outlined"}
                                                onPress={() => {
                                                    setNewNote({...newNote, deadlineType: 'date'});
                                                    setTimeout(() => setShowDatePicker(true), 100);
                                                }}
                                                style={styles.deadlineButton}
                                                compact
                                            >
                                                Конкретная дата
                                            </Button>
                                        </View>
                                    </View>

                                    {newNote.deadlineType === 'date' && (
                                        <View style={styles.inputSection}>
                                            <Text style={styles.label}>Дата выполнения</Text>
                                            <View style={styles.dateInputRow}>
                                                <TextInput
                                                    value={formatDisplayDateShort(selectedDate)}
                                                    mode="outlined"
                                                    style={styles.dateInput}
                                                    editable={false}
                                                    right={<TextInput.Icon icon="calendar" onPress={showDatePickerModal} />}
                                                />
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
                                        disabled={!newNote.content.trim() || !newNote.subject.trim()}
                                    >
                                        Добавить
                                    </Button>
                                </Card.Actions>
                            </Card>
                        </Modal>
                    </Portal>

                    <Portal>
                        <Modal
                            visible={viewNoteModalVisible}
                            onDismiss={() => setViewNoteModalVisible(false)}
                            contentContainerStyle={styles.viewModalContainer}
                        >
                            <Card style={styles.viewModalCard}>
                                <Card.Content>
                                    {isEditing && editingNote ? (
                                        <ScrollView>
                                            <Title style={styles.modalTitle}>Редактирование заметки</Title>

                                            <View style={styles.inputSection}>
                                                <Text style={styles.label}>Предмет *</Text>
                                                <Menu
                                                    visible={subjectMenuVisible}
                                                    onDismiss={() => setSubjectMenuVisible(false)}
                                                    anchor={
                                                        <Button
                                                            mode="outlined"
                                                            onPress={() => setSubjectMenuVisible(!subjectMenuVisible)}
                                                            style={styles.selectButton}
                                                            contentStyle={styles.selectButtonContent}
                                                        >
                                                            {editingNote.subject || 'Выберите предмет'}
                                                        </Button>
                                                    }
                                                >
                                                    {scheduleSubjects.map((subject) => (
                                                        <Menu.Item
                                                            key={subject}
                                                            title={subject}
                                                            onPress={() => {
                                                                setEditingNote({...editingNote, subject});
                                                                setSubjectMenuVisible(false);
                                                            }}
                                                        />
                                                    ))}
                                                </Menu>
                                            </View>

                                            <View style={styles.inputSection}>
                                                <Text style={styles.label}>Описание *</Text>
                                                <TextInput
                                                    value={editingNote.content}
                                                    onChangeText={(text) => setEditingNote({...editingNote, content: text})}
                                                    mode="outlined"
                                                    multiline
                                                    numberOfLines={6}
                                                    style={styles.input}
                                                    placeholder="Подробное описание задания"
                                                />
                                            </View>

                                            <View style={styles.editActions}>
                                                <Button
                                                    mode="outlined"
                                                    onPress={cancelEditing}
                                                    style={styles.editButton}
                                                >
                                                    Отмена
                                                </Button>
                                                <Button
                                                    mode="contained"
                                                    onPress={saveNoteChanges}
                                                    style={styles.editButton}
                                                    disabled={!editingNote.content.trim() || !editingNote.subject.trim()}
                                                >
                                                    Сохранить
                                                </Button>
                                            </View>
                                        </ScrollView>
                                    ) : (
                                        <ScrollView>
                                            <View style={styles.viewHeader}>
                                                <Title style={styles.viewTitle}>{selectedNote?.subject}</Title>
                                                <View style={styles.viewBadges}>
                                                    {selectedNote?.important && (
                                                        <Chip mode="flat" style={styles.importantBadge} textStyle={styles.importantBadgeText}>
                                                            Важная
                                                        </Chip>
                                                    )}
                                                    {selectedNote?.completed && (
                                                        <Chip mode="flat" style={styles.completedBadge} textStyle={styles.completedBadgeText}>
                                                            Выполнена
                                                        </Chip>
                                                    )}
                                                </View>
                                            </View>

                                            <View style={styles.viewContent}>
                                                <Text style={styles.viewContentText}>{selectedNote?.content}</Text>
                                            </View>

                                            <View style={styles.viewMeta}>
                                                <Text style={styles.viewMetaText}>
                                                    Создано: {selectedNote?.createdAt ? format(new Date(selectedNote.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : 'Неизвестно'}
                                                </Text>
                                                {selectedNote?.deadline && (
                                                    <Text style={[
                                                        styles.viewMetaText,
                                                        {color: getDeadlineColor(selectedNote.deadline)}
                                                    ]}>
                                                        Дедлайн: {format(new Date(selectedNote.deadline), 'dd.MM.yyyy', { locale: ru })}
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={styles.viewActions}>
                                                <Button
                                                    mode="outlined"
                                                    icon="pencil"
                                                    onPress={startEditing}
                                                    style={styles.viewActionButton}
                                                >
                                                    Редактировать
                                                </Button>
                                                <Button
                                                    mode="contained"
                                                    onPress={() => setViewNoteModalVisible(false)}
                                                    style={styles.viewActionButton}
                                                >
                                                    Закрыть
                                                </Button>
                                            </View>
                                        </ScrollView>
                                    )}
                                </Card.Content>
                            </Card>
                        </Modal>
                    </Portal>

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
        backgroundColor: '#FFFFFF',
    },
    cardContent: {
        padding: 16,
        gap: 16,
        minHeight: 140,
    },
    completedCard: {
        opacity: 0.7,
        backgroundColor: '#F8FAFC',
    },
    importantCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    deadlineChip: {
        borderWidth: 1,
        height: 28,
    },
    importantButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    importantButtonActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginVertical: 8,
    },
    subjectTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        lineHeight: 20,
    },
    noteContent: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 18,
        textAlign: 'center',
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#94A3B8',
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 8,
    },
    actionIcon: {
        margin: 0,
        width: 24,
        height: 24,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 80,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        paddingHorizontal: 8,
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 80,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#D1FAE5',
        paddingHorizontal: 8,
    },
    completeButtonActive: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    completeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
        marginLeft: 4,
        textAlign: 'center',
    },
    deleteButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
        marginRight: 4,
        textAlign: 'center',
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
    fab: {
        position: 'absolute',
        bottom: 110,
        alignSelf: 'center',
        backgroundColor: '#EC4899',
    },
    fabWeb: {
        bottom: 30,
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
    inputSection: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#1E293B',
    },
    selectButton: {
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    selectButtonContent: {
        justifyContent: 'space-between',
    },
    input: {
        backgroundColor: '#FFFFFF',
    },
    deadlineButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    deadlineButton: {
        flex: 1,
        minWidth: 100,
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
    datePickerButton: {
        minWidth: 120,
    },
    filterScrollContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    filterScrollContent: {
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF20',
        borderWidth: 1,
        borderColor: '#FFFFFF40',
        marginRight: 8,
    },
    filterButtonActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    filterButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    filterButtonTextActive: {
        color: '#EC4899',
    },
    buttonText: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
    },
    viewModalContainer: {
        margin: 20,
        maxHeight: '85%',
    },
    viewModalCard: {
        borderRadius: 20,
        maxHeight: '100%',
    },
    viewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    viewTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
        marginRight: 12,
    },
    viewBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    importantBadge: {
        backgroundColor: '#FEF3C7',
    },
    importantBadgeText: {
        color: '#D97706',
        fontSize: 12,
        fontWeight: '600',
    },
    completedBadge: {
        backgroundColor: '#D1FAE5',
    },
    completedBadgeText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '600',
    },
    viewContent: {
        marginBottom: 16,
        maxHeight: 200,
    },
    viewContentText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#374151',
    },
    viewMeta: {
        marginBottom: 20,
        gap: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    viewMetaText: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    viewActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    viewActionButton: {
        flex: 1,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 16,
    },
    editButton: {
        flex: 1,
    },
});

export default NotesScreen;