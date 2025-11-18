import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Интерфейс для универсальной работы с БД
interface DatabaseResult {
    rows: any[];
    insertId?: number;
    rowsAffected: number;
}

class DatabaseService {
    private isWeb: boolean;
    private db: any;

    constructor() {
        this.isWeb = Platform.OS === 'web';

        if (this.isWeb) {
            this.initWebStorage();
        } else {
            this.db = SQLite.openDatabaseSync('student_diary.db');
        }
    }

    // Инициализация Web Storage
    private initWebStorage() {
        // Проверяем, есть ли необходимые ключи в localStorage
        const requiredKeys = ['settings', 'schedule', 'notes', 'update_history'];

        requiredKeys.forEach(key => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify([]));
            }
        });
    }

    // Универсальный метод выполнения SQL
    execSync(sql: string, params: any[] = []): void {
        if (this.isWeb) {
            this.execWeb(sql, params);
        } else {
            this.db.execSync(sql);
        }
    }

    // Универсальный метод получения первой записи
    getFirstSync(sql: string, params: any[] = []): any {
        if (this.isWeb) {
            return this.getFirstWeb(sql, params);
        } else {
            return this.db.getFirstSync(sql, params);
        }
    }

    // Универсальный метод получения всех записей
    getAllSync(sql: string, params: any[] = []): any[] {
        if (this.isWeb) {
            return this.getAllWeb(sql, params);
        } else {
            return this.db.getAllSync(sql, params);
        }
    }

    // Универсальный метод выполнения запросов с возвратом результата
    runSync(sql: string, params: any[] = []): DatabaseResult {
        if (this.isWeb) {
            return this.runWeb(sql, params);
        } else {
            return this.db.runSync(sql, params);
        }
    }

    // Web-реализация методов
    private execWeb(sql: string, params: any[] = []): void {
        // Для простых CREATE TABLE
        console.log('Web EXEC:', sql);
    }

    private getFirstWeb(sql: string, params: any[] = []): any {
        const results = this.getAllWeb(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    private getAllWeb(sql: string, params: any[] = []): any[] {
        try {
            const { table, action } = this.parseSQL(sql);

            switch (action) {
                case 'SELECT':
                    return this.handleSelectWeb(table, sql, params);
                default:
                    return [];
            }
        } catch (error) {
            console.error('Web getAll error:', error);
            return [];
        }
    }

    private runWeb(sql: string, params: any[] = []): DatabaseResult {
        try {
            const { table, action } = this.parseSQL(sql);

            switch (action) {
                case 'INSERT':
                    return this.handleInsertWeb(table, sql, params);
                case 'UPDATE':
                    return this.handleUpdateWeb(table, sql, params);
                case 'DELETE':
                    return this.handleDeleteWeb(table, sql, params);
                case 'CREATE':
                    return { rows: [], rowsAffected: 0 };
                default:
                    return { rows: [], rowsAffected: 0 };
            }
        } catch (error) {
            console.error('Web run error:', error);
            return { rows: [], rowsAffected: 0 };
        }
    }

    // Парсинг SQL запросов
    private parseSQL(sql: string): { table: string; action: string } {
        const trimmed = sql.trim().toUpperCase();
        const words = trimmed.split(/\s+/);

        let action = words[0];
        let table = '';

        if (action === 'CREATE' && words[1] === 'TABLE') {
            table = words[3] || ''; // CREATE TABLE IF NOT EXISTS table_name
        } else if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
            // Находим таблицу после INTO, UPDATE, или FROM
            const tableIndex = words.findIndex(word =>
                word === 'INTO' || word === 'UPDATE' || word === 'FROM'
            );
            if (tableIndex !== -1 && words[tableIndex + 1]) {
                table = words[tableIndex + 1];
            }
        } else if (action === 'SELECT') {
            // Для SELECT находим таблицу после FROM
            const fromIndex = words.findIndex(word => word === 'FROM');
            if (fromIndex !== -1 && words[fromIndex + 1]) {
                table = words[fromIndex + 1];
            }
        }

        return { table, action };
    }

    // Обработка SELECT для Web
    private handleSelectWeb(table: string, sql: string, params: any[]): any[] {
        const data = this.getWebStorage(table);

        // Простая фильтрация по условиям WHERE
        let filteredData = [...data];

        // Базовая фильтрация по параметрам
        if (params.length > 0) {
            filteredData = filteredData.filter(item => {
                return params.every((param, index) => {
                    const keys = Object.keys(item);
                    if (keys[index]) {
                        return item[keys[index]] === param;
                    }
                    return true;
                });
            });
        }

        // Сортировка по ORDER BY
        if (sql.includes('ORDER BY')) {
            const orderMatch = sql.match(/ORDER BY\s+([^\s,]+)\s+(ASC|DESC)?/i);
            if (orderMatch) {
                const field = orderMatch[1];
                const direction = (orderMatch[2] || 'ASC').toUpperCase();

                filteredData.sort((a, b) => {
                    if (a[field] < b[field]) return direction === 'ASC' ? -1 : 1;
                    if (a[field] > b[field]) return direction === 'ASC' ? 1 : -1;
                    return 0;
                });
            }
        }

        // LIMIT
        if (sql.includes('LIMIT')) {
            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1]);
                filteredData = filteredData.slice(0, limit);
            }
        }

        return filteredData;
    }

    // Обработка INSERT для Web
    private handleInsertWeb(table: string, sql: string, params: any[]): DatabaseResult {
        const data = this.getWebStorage(table);
        const newItem: any = {};

        // Заполняем данные из SQL запроса
        const keyMatch = sql.match(/\(([^)]+)\)/);
        if (keyMatch) {
            const keys = keyMatch[1].split(',').map(k => k.trim());

            keys.forEach((key, index) => {
                newItem[key] = params[index];
            });

            // ГАРАНТИРОВАННО создаем ID для веб-версии
            if (!newItem.id) {
                newItem.id = this.generateWebId(table, newItem);
            }

            data.push(newItem);
            this.setWebStorage(table, data);

            return {
                rows: [newItem],
                insertId: newItem.id,
                rowsAffected: 1
            };
        }

        return { rows: [], rowsAffected: 0 };
    }

    // Обработка UPDATE для Web
    private handleUpdateWeb(table: string, sql: string, params: any[]): DatabaseResult {
        const data = this.getWebStorage(table);
        let rowsAffected = 0;

        // Простой UPDATE с WHERE
        if (sql.includes('WHERE')) {
            const whereIndex = sql.indexOf('WHERE');
            const whereClause = sql.substring(whereIndex + 5).trim();

            data.forEach(item => {
                // Простая проверка условия WHERE
                if (this.matchesWhereCondition(item, whereClause, params)) {
                    // Обновляем поля
                    const setIndex = sql.indexOf('SET');
                    const setClause = sql.substring(setIndex + 3, whereIndex).trim();
                    const setParts = setClause.split(',').map(part => part.trim());

                    setParts.forEach(part => {
                        const [key] = part.split('=').map(k => k.trim());
                        const paramIndex = setParts.indexOf(part);
                        if (key && params[paramIndex] !== undefined) {
                            item[key] = params[paramIndex];
                        }
                    });

                    rowsAffected++;
                }
            });

            this.setWebStorage(table, data);
        }

        return { rows: [], rowsAffected };
    }

    // Обработка DELETE для Web
    private handleDeleteWeb(table: string, sql: string, params: any[]): DatabaseResult {
        const data = this.getWebStorage(table);
        let rowsAffected = 0;

        if (sql.includes('WHERE')) {
            const whereIndex = sql.indexOf('WHERE');
            const whereClause = sql.substring(whereIndex + 5).trim();

            const newData = data.filter(item => {
                const matches = this.matchesWhereCondition(item, whereClause, params);
                if (matches) rowsAffected++;
                return !matches;
            });

            this.setWebStorage(table, newData);
        } else {
            // DELETE без WHERE - очищаем таблицу
            rowsAffected = data.length;
            this.setWebStorage(table, []);
        }

        return { rows: [], rowsAffected };
    }

    // Проверка условий WHERE
    private matchesWhereCondition(item: any, whereClause: string, params: any[]): boolean {
        // Простая реализация для основных случаев
        if (whereClause.includes('LIKE')) {
            const [key, value] = whereClause.split('LIKE').map(part => part.trim());
            const cleanKey = key.replace(/'/g, '').replace(/"/g, '');
            const cleanValue = value.replace(/'/g, '').replace(/"/g, '').replace(/%/g, '');

            return item[cleanKey] && item[cleanKey].includes(cleanValue);
        } else if (whereClause.includes('=')) {
            const [key, value] = whereClause.split('=').map(part => part.trim());
            const cleanKey = key.replace(/'/g, '').replace(/"/g, '');
            const cleanValue = value.replace(/'/g, '').replace(/"/g, '');

            return item[cleanKey] == cleanValue;
        }

        return false;
    }

    // Работа с Web Storage
    private getWebStorage(table: string): any[] {
        try {
            const data = localStorage.getItem(table);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    }

    private setWebStorage(table: string, data: any[]): void {
        try {
            localStorage.setItem(table, JSON.stringify(data));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    }

    private generateWebId(table: string, data: any): string | number {
        if (table === 'schedule') {
            // Для расписания создаем уникальный ID на основе данных
            const { subject, time, date, student_group } = data;
            const dateStr = date instanceof Date ? date.toISOString() : date;

            // Создаем хэш из данных предмета
            const keyString = `${subject}-${time}-${dateStr}-${student_group}`;
            return this.stringToHash(keyString);
        }

        // Для других таблиц используем timestamp
        return Date.now();
    }

    private stringToHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Транзакции (упрощенная версия для Web)
    withTransactionSync(callback: () => void): void {
        if (this.isWeb) {
            callback(); // В Web просто выполняем callback
        } else {
            // В Native используем транзакции SQLite
            try {
                this.db.execSync('BEGIN TRANSACTION;');
                callback();
                this.db.execSync('COMMIT;');
            } catch (error) {
                this.db.execSync('ROLLBACK;');
                throw error;
            }
        }
    }
}

// Экспортируем синглтон
export const databaseService = new DatabaseService();
export const db = databaseService;