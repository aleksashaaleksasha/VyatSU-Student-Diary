import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { Card, Title, Text, FAB, Chip, Button, Modal, Portal, TextInput, Provider as PaperProvider } from 'react-native-paper';
import { format, isAfter, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

const NotesScreen = () => {
    const [notes, setNotes] = useState([
        {
            id: '1',
            title: 'Домашнее задание по математике',
            content: 'Решить задачи 1-10 из учебника, страницы 45-48',
            subject: 'Математика',
            deadline: '2024-12-20',
            createdAt: '2024-12-15',
            important: true,
            completed: false,
        },
        {
            id: '2',
            title: 'Подготовка к экзамену',
            content: 'Повторить главы 5-8, сделать конспект',
            subject: 'Программирование',
            deadline: '2024-12-25',
            createdAt: '2024-12-10',
            important: true,
            completed: false,
        },
        {
            id: '3',
            title: 'Лабораторная работа',
            content: 'Написать программу для сортировки данных',
            subject: 'Алгоритмы',
            deadline: '2024-12-18',
            createdAt: '2024-12-12',
            important: false,
            completed: false,
        },
        {
            id: '4',
            title: 'Курсовая работа',
            content: 'Начать работу над введением',
            subject: 'Базы данных',
            deadline: '2024-12-30',
            createdAt: '2024-12-01',
            important: false,
            completed: true,
        },
    ]);

    const [visible, setVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // +7 дней по умолчанию
    const [newNote, setNewNote] = useState({
        title: '',
        content: '',
        subject: '',
    });

    const showModal = () => setVisible(true);
    const hideModal = () => {
        setVisible(false);
        setNewNote({
            title: '',
            content: '',
            subject: '',
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

    const addNote = () => {
        if (!newNote.title.trim() || !newNote.content.trim() || !newNote.subject.trim()) {
            return;
        }

        const note = {
            id: Date.now().toString(),
            title: newNote.title.trim(),
            content: newNote.content.trim(),
            subject: newNote.subject.trim(),
            deadline: format(selectedDate, 'yyyy-MM-dd'),
            createdAt: format(new Date(), 'yyyy-MM-dd'),
            important: false,
            completed: false,
        };

        setNotes(prevNotes => [note, ...prevNotes]);
        hideModal();
    };

    const sortedNotes = [...notes].sort((a, b) => {
        if (a.important && !b.important) return -1;
        if (!a.important && b.important) return 1;

        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    const toggleImportant = (id: string) => {
        setNotes(notes.map(note =>
            note.id === id ? { ...note, important: !note.important } : note
        ));
    };

    const toggleCompleted = (id: string) => {
        setNotes(notes.map(note =>
            note.id === id ? { ...note, completed: !note.completed } : note
        ));
    };

    const getDeadlineColor = (deadline: string) => {
        const deadlineDate = new Date(deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return '#FF6B6B';
        if (isTomorrow(deadlineDate)) return '#FFA726';
        if (isAfter(today, deadlineDate)) return '#D32F2F';
        return '#666';
    };

    const getDeadlineText = (deadline: string) => {
        const deadlineDate = new Date(deadline);
        const today = new Date();

        if (isToday(deadlineDate)) return 'Сегодня';
        if (isTomorrow(deadlineDate)) return 'Завтра';
        if (isAfter(today, deadlineDate)) return 'Просрочено';

        return format(deadlineDate, 'd MMMM', { locale: ru });
    };

    const formatDisplayDate = (date: Date) => {
        return format(date, 'd MMMM yyyy', { locale: ru });
    };

    const renderNote = ({ item }: any) => (
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
                        {getDeadlineText(item.deadline)}
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
                                
                                <TextInput
                                    label="Предмет"
                                    value={newNote.subject}
                                    onChangeText={(text) => setNewNote({...newNote, subject: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: Математика"
                                />
                                
                                <TextInput
                                    label="Заголовок"
                                    value={newNote.title}
                                    onChangeText={(text) => setNewNote({...newNote, title: text})}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Краткое описание"
                                />
                                
                                <TextInput
                                    label="Описание"
                                    value={newNote.content}
                                    onChangeText={(text) => setNewNote({...newNote, content: text})}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={3}
                                    style={styles.input}
                                    placeholder="Подробное описание задания"
                                />
                                
                                <View style={styles.dateSection}>
                                    <Text style={styles.dateLabel}>Дедлайн</Text>
                                    <Button 
                                        mode="outlined" 
                                        onPress={showDatepicker}
                                        style={styles.dateButton}
                                        icon="calendar"
                                    >
                                        {formatDisplayDate(selectedDate)}
                                    </Button>
                                </View>

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