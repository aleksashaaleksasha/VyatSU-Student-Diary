import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Text,
    Platform
} from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Modal, Portal, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { db } from '../utils/databaseService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
    const [userGroup, setUserGroup] = useState('');
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [newGroup, setNewGroup] = useState('');
    const navigation = useNavigation();

    useEffect(() => {
        initDatabase();
        loadUserGroup();
    }, []);

    const initDatabase = () => {
        try {
            db.execSync(`
                CREATE TABLE IF NOT EXISTS settings (
                                                        key TEXT PRIMARY KEY,
                                                        value TEXT
                );
            `);
        } catch (error) {
            console.log('Error creating settings table:', error);
        }
    };

    const loadUserGroup = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            if (result) {
                setUserGroup(result.value);
            }
        } catch (error) {
            console.log('Error loading user group:', error);
        }
    };

    const saveGroup = () => {
        if (!newGroup.trim()) {
            Alert.alert('Ошибка', 'Введите номер группы');
            return;
        }

        try {
            db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                ['user_group', newGroup.trim()]
            );
            setUserGroup(newGroup.trim());
            setGroupModalVisible(false);
            setNewGroup('');
            Alert.alert('Успех', 'Группа сохранена');
        } catch (error) {
            console.log('Error saving group:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить группу');
        }
    };

    const showGroupModal = () => {
        setNewGroup(userGroup || '');
        setGroupModalVisible(true);
    };

    const hideGroupModal = () => {
        setGroupModalVisible(false);
        setNewGroup('');
    };

    const clearAllData = () => {
        try {
            db.withTransactionSync(() => {
                db.runSync('DELETE FROM schedule;');
                db.runSync('DELETE FROM update_history;');
                db.runSync('DELETE FROM notes;');
                db.runSync('DELETE FROM settings WHERE key != "user_group";');
            });

            Alert.alert('Успех', 'Все данные успешно очищены');
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert('Ошибка', 'Не удалось очистить данные');
        }
    };

    const clearAllDataIncludingGroup = () => {
        try {
            db.withTransactionSync(() => {
                db.runSync('DELETE FROM schedule;');
                db.runSync('DELETE FROM update_history;');
                db.runSync('DELETE FROM notes;');
                db.runSync('DELETE FROM settings;');
            });

            setUserGroup('');
            Alert.alert('Успех', 'Все данные успешно очищены, включая выбранную группу');
            navigation.navigate('Расписание' as never);

        } catch (error) {
            console.log('Error clearing data:', error);
            Alert.alert('Ошибка', 'Не удалось очистить данные');
        }
    };

    const handleClearData = () => {
        Alert.alert(
            'Очистка данных',
            'Что вы хотите очистить?',
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                },
                {
                    text: 'Только расписание',
                    onPress: clearAllData,
                    style: 'default',
                },
                {
                    text: 'Всё (включая группу)',
                    onPress: clearAllDataIncludingGroup,
                    style: 'destructive',
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1E88E5', '#42A5F5']}
                style={styles.headerGradient}
            >
                <View style={styles.headerTopRow}>
                    <View style={styles.groupContainer}>
                        <TouchableOpacity
                            style={styles.groupRow}
                            onPress={showGroupModal}
                        >
                            <View style={styles.groupCenter}>
                                {userGroup ? (
                                    <Text style={styles.groupText}>{userGroup}</Text>
                                ) : (
                                    <Text style={styles.groupPlaceholder}>Выберите группу</Text>
                                )}
                                <Ionicons name="pencil" size={20} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
            >
                {Platform.OS !== 'web' && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Title style={styles.cardTitle}>Импорт расписания</Title>
                            <Paragraph style={styles.cardDescription}>Загрузите расписание из Excel файла</Paragraph>

                            <Button
                                mode="contained"
                                icon="file-import"
                                onPress={() => navigation.navigate('Import' as never)}
                                style={styles.button}
                                buttonColor="#1E88E5"
                            >
                                Импорт из Excel
                            </Button>
                        </Card.Content>
                    </Card>
                )}

                <Card style={styles.card}>
                    <Card.Content>
                        <Title style={styles.cardTitle}>Обновление из VK</Title>
                        <Paragraph style={styles.cardDescription}>Автоматическая загрузка расписания из группы ВятГУ</Paragraph>

                        <Button
                            mode="contained"
                            icon="refresh"
                            onPress={() => navigation.navigate('VkSchedule' as never)}
                            style={styles.button}
                            buttonColor="#1E88E5"
                        >
                            Управление обновлениями
                        </Button>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Content>
                        <Title style={styles.cardTitle}>Данные</Title>
                        <Paragraph style={styles.cardDescription}>Управление данными приложения</Paragraph>
                        <Button
                            mode="outlined"
                            style={[styles.button, styles.clearButton]}
                            textColor="#EF4444"
                            icon="delete"
                            onPress={handleClearData}
                        >
                            Очистить все данные
                        </Button>
                    </Card.Content>
                </Card>

                <View style={styles.bottomSpacer} />
            </ScrollView>

            <Portal>
                <Modal
                    visible={groupModalVisible}
                    onDismiss={hideGroupModal}
                    contentContainerStyle={styles.modalContainer}
                >
                    <LinearGradient
                        colors={['#1E88E5', '#42A5F5']}
                        style={styles.modalGradient}
                    >
                        <Card style={styles.modalCard}>
                            <LinearGradient
                                colors={['#1E88E5', '#42A5F5']}
                                style={styles.modalHeader}
                            >
                                <View style={styles.modalHeaderContent}>
                                    <Ionicons name="school" size={24} color="#FFFFFF" />
                                    <Title style={styles.modalTitle}>Выбор группы</Title>
                                </View>
                            </LinearGradient>

                            <Card.Content style={styles.modalContent}>
                                <View style={styles.currentGroupSection}>
                                    <Text style={styles.currentGroupLabel}>Текущая группа:</Text>
                                    {userGroup ? (
                                        <Chip
                                            mode="flat"
                                            style={styles.currentGroupChip}
                                            textStyle={styles.currentGroupChipText}
                                        >
                                            {userGroup}
                                        </Chip>
                                    ) : (
                                        <Text style={styles.noGroupText}>Не выбрана</Text>
                                    )}
                                </View>

                                <TextInput
                                    label="Номер новой группы"
                                    value={newGroup}
                                    onChangeText={setNewGroup}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Например: ИСПк-104-52-00"
                                    autoFocus={true}
                                    outlineColor="#1E88E5"
                                    activeOutlineColor="#1565C0"
                                    left={<TextInput.Icon icon="account-group" color="#1E88E5" />}
                                />
                            </Card.Content>

                            <Card.Actions style={styles.modalActions}>
                                <Button
                                    mode="outlined"
                                    onPress={hideGroupModal}
                                    style={styles.modalButton}
                                    textColor="#1E88E5"
                                    icon="close"
                                >
                                    Отмена
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={saveGroup}
                                    style={styles.modalButton}
                                    disabled={!newGroup.trim()}
                                    buttonColor="#1E88E5"
                                    icon="check"
                                >
                                    Сохранить
                                </Button>
                            </Card.Actions>
                        </Card>
                    </LinearGradient>
                </Modal>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerGradient: {
        paddingTop: 0,
        paddingBottom: 12,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginTop: 0,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    groupContainer: {
        alignItems: 'center',
        width: '100%',
    },
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    groupCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    groupText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    groupPlaceholder: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        opacity: 0.9,
    },
    editButton: {
        padding: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 20,
        paddingBottom: 80,
    },
    card: {
        marginBottom: 16,
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
        lineHeight: 20,
    },
    button: {
        marginVertical: 4,
    },
    clearButton: {
        borderColor: '#EF4444',
    },
    bottomSpacer: {
        height: 40,
    },
    modalContainer: {
        margin: 20,
        borderRadius: 20,
        overflow: 'hidden',
    },
    modalGradient: {
        borderRadius: 20,
    },
    modalCard: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        margin: 2,
    },
    modalHeader: {
        padding: 20,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
    },
    modalHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    modalContent: {
        padding: 20,
        gap: 16,
    },
    currentGroupSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currentGroupLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    currentGroupChip: {
        backgroundColor: '#E3F2FD',
    },
    currentGroupChipText: {
        color: '#1E88E5',
        fontWeight: '600',
    },
    noGroupText: {
        fontSize: 14,
        color: '#EF4444',
        fontStyle: 'italic',
    },
    input: {
        backgroundColor: '#FFFFFF',
    },
    modalActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    modalButton: {
        flex: 1,
        minWidth: 120,
    },
});

export default SettingsScreen;