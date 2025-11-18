// HomeScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Card, Title, Text, FAB } from 'react-native-paper';
import { format, addDays, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

const { width } = Dimensions.get('window');

const ScheduleScreen = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const handleSwipe = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            setCurrentDate(addDays(currentDate, 1));
        } else {
            setCurrentDate(subDays(currentDate, 1));
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'lecture': return '#4CAF50';
            case 'practice': return '#2196F3';
            case 'lab': return '#FF9800';
            default: return '#757575';
        }
    };

    const getTypeText = (type: string) => {
        switch (type) {
            case 'lecture': return 'Лекция';
            case 'practice': return 'Практика';
            case 'lab': return 'Лаб. работа';
            default: return type;
        }
    };

    return (
        <View style={styles.container}>
            <Card style={styles.headerCard}>
                <Card.Content>
                    <Title style={styles.dateTitle}>
                        {format(currentDate, 'EEEE, d MMMM yyyy', { locale: ru })}
                    </Title>
                    <Text style={styles.weekDay}>
                        {format(currentDate, 'cccc', { locale: ru })}
                    </Text>
                </Card.Content>
            </Card>

            <ScrollView
                style={styles.scheduleScroll}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                    const offsetX = event.nativeEvent.contentOffset.x;
                    if (offsetX === width) {
                        handleSwipe('left');
                    } else if (offsetX === 0) {
                        handleSwipe('right');
                    }
                }}
                scrollEventThrottle={16}
            >
                <View style={{ width }}>
                    <Card style={styles.scheduleCard}>
                        <Card.Content>
                            <View style={styles.noClasses}>
                                <Text style={styles.noClassesText}>Данные загружаются из Excel или VK</Text>
                                <Text style={styles.noClassesSubtext}>
                                    Используйте импорт из Excel или обновление из VK для загрузки расписания
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                </View>
            </ScrollView>

            <View style={styles.navigationHint}>
                <Text style={styles.hintText}>Свайпните для переключения дней</Text>
            </View>

            <FAB
                icon="calendar"
                style={styles.fab}
                onPress={() => setCurrentDate(new Date())}
                label="Сегодня"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerCard: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#1E88E5',
    },
    dateTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    weekDay: {
        color: '#E3F2FD',
        fontSize: 14,
    },
    scheduleScroll: {
        flex: 1,
    },
    scheduleCard: {
        margin: 16,
        marginTop: 8,
    },
    lessonItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    typeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    subjectText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    detailsText: {
        fontSize: 14,
        color: '#666',
    },
    noClasses: {
        padding: 40,
        alignItems: 'center',
    },
    noClassesText: {
        fontSize: 18,
        color: '#666',
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
    },
    noClassesSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },
    navigationHint: {
        padding: 16,
        alignItems: 'center',
    },
    hintText: {
        color: '#1E88E5',
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#1E88E5',
    },
});

export default ScheduleScreen;