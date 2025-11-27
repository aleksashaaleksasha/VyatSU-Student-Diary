import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Card, Title, Paragraph, Button, List, ActivityIndicator, Chip, Switch } from 'react-native-paper';
import { vkApiService, ScheduleUpdateResult } from '../utils/vkApiService';
import { db } from '../utils/databaseService';
import { useIsFocused } from '@react-navigation/native';



const VkScheduleScreen: React.FC = () => {
    const [checking, setChecking] = useState(false);
    const [autoUpdate, setAutoUpdate] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [userGroup, setUserGroup] = useState('');
    const [updateHistory, setUpdateHistory] = useState<any[]>([]);
    const isFocused = useIsFocused();

    const initDatabase = () => {
        try {
            db.execSync(`
                CREATE TABLE IF NOT EXISTS update_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    new_items_count INTEGER NOT NULL,
                    success INTEGER NOT NULL,
                    error_message TEXT
                );
                
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);
            console.log('Database tables checked/created');
        } catch (error) {
            console.log('Error creating tables:', error);
        }
    };

    useEffect(() => {
        if (isFocused) {
            console.log('VkScheduleScreen focused, initializing...');
            initDatabase();
            loadUserGroup();
            loadLastUpdate();
            loadUpdateHistory();
        }
    }, [isFocused]);



    const loadUserGroup = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "user_group"') as any;
            console.log('Loaded user group from DB:', result);
            
            if (result && result.value) {
                setUserGroup(result.value);
                console.log('User group set to:', result.value);
            } else {
                console.log('No user group found in settings');
                setUserGroup('');
            }
        } catch (error) {
            console.log('Error loading user group:', error);
            setUserGroup('');
        }
    };

    const loadLastUpdate = () => {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "last_vk_update"') as any;
            if (result) {
                setLastUpdate(new Date(result.value));
                console.log('Last update loaded:', result.value);
            } else {
                console.log('No last update found');
            }
        } catch (error) {
            console.log('Error loading last update:', error);
        }
    };

    const saveLastUpdate = (date: Date) => {
        try {
            db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                ['last_vk_update', date.toISOString()]
            );
            setLastUpdate(date);
            console.log('Last update saved:', date.toISOString());
        } catch (error) {
            console.log('Error saving last update:', error);
        }
    };

    const loadUpdateHistory = () => {
        try {
            const results = db.getAllSync(
                'SELECT * FROM update_history ORDER BY timestamp DESC LIMIT 10;'
            ) as any[];
            console.log('Loaded update history:', results.length, 'items');
            setUpdateHistory(results);
        } catch (error) {
            console.log('Error loading update history:', error);
        }
    };

    const saveUpdateHistory = (result: ScheduleUpdateResult) => {
        try {
            db.runSync(
                `INSERT INTO update_history (timestamp, new_items_count, success, error_message) 
                 VALUES (?, ?, ?, ?)`,
                [new Date().toISOString(), result.newScheduleCount, result.success ? 1 : 0, result.error || '']
            );
            console.log('Update history saved:', result.newScheduleCount, 'items');
            loadUpdateHistory();
        } catch (error) {
            console.log('Error saving update history:', error);
        }
    };


    const checkForUpdates = async () => {
        console.log('🔍 РЕАЛЬНАЯ проверка обновлений...');
        console.log(`Группа: ${userGroup}`);

        if (!userGroup) {
            Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
            return;
        }

        if (Platform.OS === 'web') {
            Alert.alert(
                'Веб-версия',
                'В веб-версии используйте функцию "Весь семестр" для загрузки расписания или импортируйте Excel файл вручную',
                [{ text: 'OK' }]
            );
            return;
        }

        console.log('Запуск реальной проверки обновлений...');
        setChecking(true);

        try {
            let result: ScheduleUpdateResult;

            result = await vkApiService.checkForScheduleUpdates(userGroup);

            console.log('Результат проверки:', result);

            saveUpdateHistory(result);

            if (result.success) {
                if (result.newScheduleCount > 0) {
                    Alert.alert(
                        'Успех',
                        `Обновлено ${result.newScheduleCount} занятий для группы "${userGroup}"`
                    );
                } else {
                    Alert.alert('Информация', 'Новых расписаний не найдено');
                }
                saveLastUpdate(result.lastUpdate);
            } else {
                Alert.alert('Ошибка', result.error || 'Не удалось проверить обновления');
            }
        } catch (error) {
            console.error('Ошибка проверки обновлений:', error);
            Alert.alert('Ошибка', 'Произошла ошибка при проверке обновлений');
        } finally {
            setChecking(false);
        }
    };

    const forceCheckUpdates = async () => {
        console.log('Force checking updates, userGroup:', userGroup);
        
        if (!userGroup || userGroup === '') {
            Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
            return;
        }

        setChecking(true);

        try {
            const result = await vkApiService.forceCheckUpdates(userGroup);

            saveUpdateHistory(result);

            if (result.success) {
                if (result.newScheduleCount > 0) {
                    Alert.alert(
                        'Успех',
                        `Обновлено ${result.newScheduleCount} занятий для группы "${userGroup}"`
                    );
                } else {
                    Alert.alert('Информация', 'Расписаний не найдено');
                }
                saveLastUpdate(result.lastUpdate);
            } else {
                Alert.alert('Ошибка', result.error || 'Не удалось проверить обновления');
            }
        } catch (error) {
            console.error('Force update check error:', error);
            Alert.alert('Ошибка', 'Произошла ошибка при проверке обновлений');
        } finally {
            setChecking(false);
        }
    };

    const loadLastThreeSchedules = async () => {
        console.log('Loading last 3 schedules, userGroup:', userGroup);
        
        if (!userGroup || userGroup === '') {
            Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
            return;
        }

        setChecking(true);

        try {
            const posts = await vkApiService.getGroupPosts(50);
            let totalImported = 0;
            let processedFiles = 0;
            let scheduleCount = 0;

            const sortedPosts = posts.sort((a, b) => b.date - a.date);

            for (const post of sortedPosts) {
                if (scheduleCount >= 3) break;

                if (vkApiService.isSchedulePost(post)) {
                    scheduleCount++;
                    console.log(`Processing schedule ${scheduleCount}: post ${post.id}`);

                    const excelAttachments = post.attachments?.filter(att =>
                        att.type === 'doc' && att.doc?.ext === 'xlsx'
                    ) || [];

                    for (const attachment of excelAttachments) {
                        if (attachment.doc) {
                            try {
                                console.log(`Processing recent file: ${attachment.doc.title}`);
                                const arrayBuffer = await vkApiService.downloadScheduleFile(attachment.doc);
                                const count = await vkApiService.processScheduleFile(arrayBuffer, userGroup);
                                totalImported += count;
                                processedFiles++;
                            } catch (error) {
                                console.error(`Error processing attachment:`, error);
                            }
                        }
                    }
                }
            }

            const result: ScheduleUpdateResult = {
                success: true,
                newScheduleCount: totalImported,
                lastUpdate: new Date()
            };

            saveUpdateHistory(result);
            saveLastUpdate(result.lastUpdate);

            Alert.alert(
                'Загрузка завершена',
                `Найдено ${scheduleCount} расписаний\nОбработано ${processedFiles} файлов\nДобавлено ${totalImported} занятий`,
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.error('Recent schedules load error:', error);
            Alert.alert('Ошибка', 'Произошла ошибка при загрузке последних расписаний');
        } finally {
            setChecking(false);
        }
    };

    const loadFullSemesterSchedule = async () => {
        console.log('Loading full semester, userGroup:', userGroup);
        
        if (!userGroup || userGroup === '') {
            Alert.alert('Ошибка', 'Сначала выберите вашу группу в настройках');
            return;
        }

        setChecking(true);

        try {
            const posts = await vkApiService.getGroupPosts(100);
            let totalImported = 0;
            let processedFiles = 0;

            const schedulePosts = posts.filter(post => vkApiService.isSchedulePost(post));
            console.log(`Found ${schedulePosts.length} schedule posts`);

            for (const post of schedulePosts) {
                const excelAttachments = post.attachments?.filter(att =>
                    att.type === 'doc' && att.doc?.ext === 'xlsx'
                ) || [];

                for (const attachment of excelAttachments) {
                    if (attachment.doc) {
                        try {
                            console.log(`Processing semester file: ${attachment.doc.title}`);
                            const arrayBuffer = await vkApiService.downloadScheduleFile(attachment.doc);
                            const count = await vkApiService.processScheduleFile(arrayBuffer, userGroup);
                            totalImported += count;
                            processedFiles++;
                        } catch (error) {
                            console.error(`Error processing attachment:`, error);
                        }
                    }
                }
            }

            const result: ScheduleUpdateResult = {
                success: true,
                newScheduleCount: totalImported,
                lastUpdate: new Date()
            };

            saveUpdateHistory(result);
            saveLastUpdate(result.lastUpdate);

            Alert.alert(
                'Загрузка семестра завершена',
                `Обработано ${processedFiles} файлов\nДобавлено ${totalImported} занятий`,
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.error('Semester load error:', error);
            Alert.alert('Ошибка', 'Произошла ошибка при загрузке расписания семестра');
        } finally {
            setChecking(false);
        }
    };

    const openVkGroup = () => {
        Linking.openURL('https://vk.com/kollegevyatsu');
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Автообновление из VK</Title>

                    {Platform.OS === 'web' && (
                        <Chip mode="outlined" style={styles.demoChip} icon="information">
                            Демонстрационный режим для Web
                        </Chip>
                    )}

                    {userGroup ? (
                        <Chip mode="outlined" style={styles.groupChip}>
                            Группа: {userGroup}
                        </Chip>
                    ) : (
                        <Paragraph style={styles.warningText}>
                            Группа не выбрана. Сначала выберите группу в настройках.
                        </Paragraph>
                    )}

                    <View style={styles.autoUpdateRow}>
                        <Paragraph>Автоматическая проверка при открытии</Paragraph>
                        <Switch
                            value={autoUpdate}
                            onValueChange={setAutoUpdate}
                        />
                    </View>

                    {lastUpdate && (
                        <Paragraph style={styles.lastUpdate}>
                            Последняя проверка: {lastUpdate.toLocaleString('ru-RU')}
                        </Paragraph>
                    )}

                    {checking ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1E88E5" />
                            <Paragraph style={styles.loadingText}>
                                Загрузка данных...
                            </Paragraph>
                        </View>
                    ) : (
                        <View style={styles.buttonContainer}>
                            <Button
                                mode="contained"
                                icon="refresh"
                                style={styles.button}
                                onPress={checkForUpdates}
                                disabled={!userGroup}
                            >
                                Проверить обновления
                            </Button>
                            <Button
                                mode="outlined"
                                icon="sync"
                                style={styles.button}
                                onPress={forceCheckUpdates}
                                disabled={!userGroup}
                            >
                                Принудительная проверка
                            </Button>

                            <Button
                                mode="outlined"
                                icon="calendar-month"
                                style={styles.button}
                                onPress={loadLastThreeSchedules}
                                disabled={!userGroup}
                            >
                                Последние 3 расписания
                            </Button>
                            <Button
                                mode="contained"
                                icon="school"
                                style={styles.button}
                                onPress={loadFullSemesterSchedule}
                                disabled={!userGroup}
                            >
                                Весь семестр
                            </Button>
                        </View>
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>История обновлений</Title>

                    {updateHistory.length === 0 ? (
                        <Paragraph style={styles.emptyText}>Нет данных об обновлениях</Paragraph>
                    ) : (
                        updateHistory.map((item) => (
                            <List.Item
                                key={item.id}
                                title={`${new Date(item.timestamp).toLocaleString('ru-RU')}`}
                                description={
                                    item.success ?
                                        `Добавлено ${item.new_items_count} занятий` :
                                        `Ошибка: ${item.error_message}`
                                }
                                left={props => (
                                    <List.Icon
                                        {...props}
                                        icon={item.success ? "check-circle" : "alert-circle"}
                                        color={item.success ? "#4CAF50" : "#FF6B6B"}
                                    />
                                )}
                            />
                        ))
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Информация</Title>
                    <Paragraph>
                        Расписание автоматически загружается из группы VK Колледжа ВятГУ.
                        Система проверяет новые посты на наличие Excel файлов с расписанием.
                    </Paragraph>

                    <Button
                        mode="contained"
                        icon="open-in-new"
                        onPress={openVkGroup}
                        style={styles.button}
                    >
                        Открыть группу VK
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
    groupChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    warningText: {
        color: '#FF6B6B',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    autoUpdateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    lastUpdate: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        textAlign: 'center',
    },
    buttonContainer: {
        gap: 8,
    },
    button: {
        marginVertical: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontStyle: 'italic',
    },
    demoChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
        backgroundColor: '#FFF3CD',
        borderColor: '#FFEAA7',
    },
});

export default VkScheduleScreen;