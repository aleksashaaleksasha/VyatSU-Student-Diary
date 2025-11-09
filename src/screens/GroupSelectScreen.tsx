
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, TextInput, Button, List, Chip } from 'react-native-paper';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('student_diary.db');

const GroupSelectScreen = ({ navigation }: any) => {
    const [selectedGroup, setSelectedGroup] = useState('');
    const [customGroup, setCustomGroup] = useState('');
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);

    // Предопределенные группы
    const predefinedGroups = [
        'ИСПк-104-52-00',
        'ИСПк-105-52-00',
        'ИСПк-106-52-00',
        'ИСПк-107-52-00',
        'ИСПк-108-52-00',
        'ИСПк-109-52-00',
        'ИСПк-110-52-00',
    ];

    useEffect(() => {
        loadUserGroup();
        loadImportedGroups();
    }, []);

    const loadUserGroup = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            if (result) {
                setSelectedGroup(result.value);
            }
        } catch (error) {
            console.log('Error loading user group:', error);
        }
    };

    const loadImportedGroups = () => {
        try {
            const results = db.getAllSync('SELECT DISTINCT student_group FROM schedule ORDER BY student_group') as any[];
            const groups = results.map(item => item.student_group).filter(Boolean);
            setAvailableGroups([...new Set([...predefinedGroups, ...groups])]);
        } catch (error) {
            console.log('Error loading imported groups:', error);
            setAvailableGroups(predefinedGroups);
        }
    };

    const saveGroup = (group: string) => {
        try {
            db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                ['user_group', group]
            );
            setSelectedGroup(group);
            navigation.goBack();
        } catch (error) {
            console.log('Error saving group:', error);
        }
    };

    const saveCustomGroup = () => {
        if (customGroup.trim()) {
            saveGroup(customGroup.trim());
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Выберите вашу группу</Title>

                    {selectedGroup ? (
                        <Chip mode="outlined" style={styles.currentGroup}>
                            Текущая группа: {selectedGroup}
                        </Chip>
                    ) : null}

                    <Title style={styles.sectionTitle}>Предопределенные группы</Title>
                    {predefinedGroups.map((group) => (
                        <List.Item
                            key={group}
                            title={group}
                            onPress={() => saveGroup(group)}
                            right={props => selectedGroup === group ?
                                <List.Icon {...props} icon="check" /> : null
                            }
                        />
                    ))}

                    <Title style={styles.sectionTitle}>Группы из импорта</Title>
                    {availableGroups.filter(group => !predefinedGroups.includes(group)).map((group) => (
                        <List.Item
                            key={group}
                            title={group}
                            onPress={() => saveGroup(group)}
                            right={props => selectedGroup === group ?
                                <List.Icon {...props} icon="check" /> : null
                            }
                        />
                    ))}

                    <Title style={styles.sectionTitle}>Другая группа</Title>
                    <TextInput
                        label="Введите номер группы"
                        value={customGroup}
                        onChangeText={setCustomGroup}
                        mode="outlined"
                        style={styles.input}
                        placeholder="Например: ИСПк-111-52-00"
                    />
                    <Button
                        mode="contained"
                        onPress={saveCustomGroup}
                        disabled={!customGroup.trim()}
                    >
                        Сохранить группу
                    </Button>
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f8f9fa',
    },
    card: {
        marginBottom: 16,
    },
    currentGroup: {
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    sectionTitle: {
        fontSize: 16,
        marginTop: 20,
        marginBottom: 10,
    },
    input: {
        marginBottom: 12,
    },
});

export default GroupSelectScreen;