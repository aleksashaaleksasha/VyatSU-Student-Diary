
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Button, List } from 'react-native-paper';

const ImportScreen = () => {
    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Импорт расписания</Title>
                    <Paragraph>Выберите источник для загрузки расписания</Paragraph>

                    <Button
                        mode="contained"
                        icon="file-import"
                        style={styles.button}
                        onPress={() => console.log('Import from phone')}
                    >
                        Из памяти телефона
                    </Button>

                    <Button
                        mode="outlined"

                    style={styles.button}
                    onPress={() => console.log('Import from VK')}
                    >
                    Из группы ВКонтакте
                </Button>
            </Card.Content>
        </Card>

    <Card style={styles.card}>
        <Card.Content>
            <Title>Последние импорты</Title>
            <List.Item
                title="Расписание на декабрь"
                description="Импортировано 15.12.2024"
                left={props => <List.Icon {...props} icon="file-check" />}
            />
            <List.Item
                title="Расписание на ноябрь"
                description="Импортировано 10.11.2024"
                left={props => <List.Icon {...props} icon="file-check" />}
            />
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
        marginVertical: 8,
    },
});

export default ImportScreen;