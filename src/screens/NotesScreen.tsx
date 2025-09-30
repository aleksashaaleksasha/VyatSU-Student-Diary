import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Title, Text, FAB, Chip, Button } from 'react-native-paper';
import { format, isAfter, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';

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
                onPress={() => console.log('Add new note')}
                color="#FFFFFF"
            />
        </View>
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
});

export default NotesScreen;