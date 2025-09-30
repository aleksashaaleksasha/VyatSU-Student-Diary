import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Switch, List, Button, Menu, Divider } from 'react-native-paper';

const SettingsScreen = () => {
    const [notifications, setNotifications] = useState(true);
    const [deadlineReminders, setDeadlineReminders] = useState(true);
    const [scheduleChanges, setScheduleChanges] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Импорт расписания</Title>
                    <Paragraph>Загрузите расписание из различных источников</Paragraph>

                    <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <Button
                                mode="outlined"
                                onPress={() => setMenuVisible(true)}
                                style={styles.button}
                            >
                                Выбрать источник импорта
                            </Button>
                        }
                    >
                        <Menu.Item
                            onPress={() => {
                                setMenuVisible(false);
                                console.log('Import from phone');
                            }}
                            title="Из памяти телефона"
                            leadingIcon="file-import"
                        />
                        <Menu.Item
                            onPress={() => {
                                setMenuVisible(false);
                                console.log('Import from VK');
                            }}
                            title="Из группы ВКонтакте"

                        />
                    </Menu>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Уведомления</Title>
                    <List.Item
                        title="Включить уведомления"
                        description="Получать push-уведомления"
                        right={() => (
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                            />
                        )}
                    />
                    <List.Item
                        title="Напоминания о дедлайнах"
                        description="Уведомления о заданиях"
                        right={() => (
                            <Switch
                                value={deadlineReminders}
                                onValueChange={setDeadlineReminders}
                            />
                        )}
                    />
                    <List.Item
                        title="Изменения расписания"
                        description="Уведомления об изменениях"
                        right={() => (
                            <Switch
                                value={scheduleChanges}
                                onValueChange={setScheduleChanges}
                            />
                        )}
                    />
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>Данные</Title>
                    <Button mode="outlined" style={styles.button}>
                        Создать резервную копию
                    </Button>
                    <Button mode="outlined" style={styles.button}>
                        Восстановить из копии
                    </Button>
                    <Button mode="outlined" style={styles.button} textColor="red">
                        Очистить все данные
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Content>
                    <Title>О приложении</Title>
                    <Paragraph>Дневник студента ВятГУ</Paragraph>
                    <Paragraph>Версия 1.0.0</Paragraph>
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
    button: {
        marginVertical: 4,
    },
});

export default SettingsScreen;