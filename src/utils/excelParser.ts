
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

export interface ParsedScheduleItem {
    id?: number;
    subject: string;
    time: string;
    teacher: string;
    classroom: string;
    date: Date;
    type: string;
    group: string;
    dayOfWeek: string;
    pairNumber: number;
}

export interface ExcelImportResult {
    success: boolean;
    data: ParsedScheduleItem[];
    error?: string;
    groups?: string[];
}

export class ExcelScheduleParser {
    private static readonly DAYS_OF_WEEK = [
        'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'
    ];

    // Метод для извлечения группы из ячейки формата "Группа ДОк-202-52-00"
    private static extractGroupFromCell(cellValue: string): string | null {
        if (!cellValue) return null;

        const cleanValue = cellValue.toString().trim();

        // Ищем паттерн "Группа XXXXX"
        const groupMatch = cleanValue.match(/Группа\s+([^\s,;]+)/i);
        if (groupMatch && groupMatch[1]) {
            return groupMatch[1].trim();
        }

        // Если нет "Группа", но есть паттерн группы (буквы-цифры-тире)
        const directMatch = cleanValue.match(/[А-Яа-я]+\s*-\s*\d+-\s*\d+-\s*\d+/);
        if (directMatch) {
            return directMatch[0].trim();
        }

        return null;
    }

    private static parseDate(baseDate: Date, dayOfWeek: string): Date {
        const dayIndex = this.DAYS_OF_WEEK.indexOf(dayOfWeek.toUpperCase());
        if (dayIndex === -1) return baseDate;

        const result = new Date(baseDate);
        const currentDay = baseDate.getDay();
        const targetDay = dayIndex === 6 ? 0 : dayIndex + 1; // Воскресенье = 0, Понедельник = 1

        let diff = targetDay - currentDay;
        if (diff < 0) diff += 7;

        result.setDate(result.getDate() + diff);
        return result;
    }

    private static determineType(typeStr: string): string {
        if (!typeStr) return 'Лекция';

        const lowerType = typeStr.toLowerCase();
        if (lowerType.includes('лекция')) return 'Лекция';
        if (lowerType.includes('практика') || lowerType.includes('пр. занятие')) return 'Практика';
        if (lowerType.includes('лабораторная') || lowerType.includes('лаб.')) return 'Лабораторная';
        if (lowerType.includes('семинар')) return 'Семинар';
        return 'Лекция';
    }

    // Извлекает все группы из строки 24 с учетом структуры
    private static extractGroupsFromRow24(row: any[]): {group: string, startColumn: number}[] {
        const groups: {group: string, startColumn: number}[] = [];

        console.log('Row 24 structure analysis:', row);

        // Структура: пусто пусто | группа группа группа | пусто пусто | группа группа группа | ...
        let col = 0;

        while (col < row.length) {
            // Проверяем текущую позицию - должны быть 2 пустых
            const isEmptyBlock = !row[col] && !row[col + 1];

            if (isEmptyBlock) {
                // Пропускаем 2 пустых колонки
                col += 2;

                // Теперь должны идти 3 ячейки с названием группы (объединенные ячейки)
                // Берем первую непустую ячейку из следующих трех
                let groupName = null;
                let groupCol = col;

                for (let i = 0; i < 3 && col + i < row.length; i++) {
                    const cellValue = row[col + i]?.toString().trim();
                    if (cellValue) {
                        groupName = this.extractGroupFromCell(cellValue);
                        if (groupName) {
                            groupCol = col + i;
                            break;
                        }
                    }
                }

                if (groupName) {
                    console.log(`Found group "${groupName}" at columns ${col}-${col+2}`);
                    groups.push({
                        group: groupName,
                        startColumn: col // Начало блока группы (первая из 4 колонок)
                    });
                }

                // Переходим к следующему блоку (пропускаем 3 колонки группы + 1 колонка?)
                col += 4;
            } else {
                // Если структура нарушена, пробуем найти группы в любом месте
                const cellValue = row[col]?.toString().trim();
                if (cellValue) {
                    const groupName = this.extractGroupFromCell(cellValue);
                    if (groupName) {
                        groups.push({
                            group: groupName,
                            startColumn: col
                        });
                    }
                }
                col++;
            }
        }

        console.log('Extracted groups:', groups);
        return groups;
    }

    private static isDayRow(row: any[]): boolean {
        const firstCell = row[0]?.toString().trim().toUpperCase();
        return this.DAYS_OF_WEEK.some(day => firstCell.includes(day));
    }

    private static extractDayInfo(row: any[]): { day: string, dateStr: string } | null {
        const firstCell = row[0]?.toString().trim();
        if (!firstCell) return null;

        for (const day of this.DAYS_OF_WEEK) {
            if (firstCell.toUpperCase().includes(day)) {
                const dateMatch = firstCell.match(/(\d{1,2})\.(\d{1,2})/);
                return {
                    day: day,
                    dateStr: dateMatch ? `${dateMatch[1]}.${dateMatch[2]}` : ''
                };
            }
        }
        return null;
    }

    // Основной метод парсинга расписания
    private static parseSubjectData(
        data: any[][],
        baseDate: Date,
        userGroup: string
    ): ParsedScheduleItem[] {
        const scheduleItems: ParsedScheduleItem[] = [];

        // Получаем группы из строки 24
        const row24 = data[23]; // 24 строка = индекс 23
        if (!row24 || !Array.isArray(row24)) {
            console.log('Row 24 not found or invalid');
            return [];
        }

        const allGroups = this.extractGroupsFromRow24(row24);
        const targetGroup = allGroups.find(g => g.group === userGroup);

        if (!targetGroup) {
            console.log(`Group ${userGroup} not found in row 24`);
            return [];
        }

        console.log(`Target group "${userGroup}" starts at column ${targetGroup.startColumn}`);

        let currentDayInfo: { day: string, dateStr: string } | null = null;
        let currentPairInDay = 0;

        // Начинаем парсинг с строки 26 (индекс 25)
        for (let i = 25; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row)) continue;

            // Проверяем, является ли строка заголовком дня
            const dayInfo = this.extractDayInfo(row);
            if (dayInfo) {
                currentDayInfo = dayInfo;
                currentPairInDay = 0;
                console.log(`Found day: ${dayInfo.day} at row ${i}`);
                continue;
            }

            // Пропускаем строки без информации о текущем дне
            if (!currentDayInfo) {
                continue;
            }

            // Определяем максимальное количество пар для дня
            const isSaturday = currentDayInfo.day === 'СУББОТА';
            const maxPairs = isSaturday ? 6 : 7;

            // Если превысили максимальное количество пар для дня, сбрасываем
            if (currentPairInDay >= maxPairs) {
                currentDayInfo = null;
                currentPairInDay = 0;
                continue;
            }

            // Получаем время из второй колонки (индекс 1)
            const timeCell = row[1]?.toString().trim();
            if (!timeCell || !/^\d+\.\d+-\d+\.\d+/.test(timeCell)) {
                // Если нет времени, но мы в середине дня, увеличиваем счетчик
                currentPairInDay++;
                continue;
            }

            // Получаем данные для целевой группы (4 колонки на группу)
            const subjectCol = targetGroup.startColumn;
            const typeCol = targetGroup.startColumn + 1;
            const teacherCol = targetGroup.startColumn + 2;
            const classroomCol = targetGroup.startColumn + 3;

            const subject = row[subjectCol]?.toString().trim();
            const type = row[typeCol]?.toString().trim();
            const teacher = row[teacherCol]?.toString().trim();
            const classroom = row[classroomCol]?.toString().trim();

            // Проверяем, есть ли данные для этой пары
            const hasData = subject && subject.length > 0;

            // Проверяем специальные отметки
            const isSpecialDay = subject && (
                subject.includes('День самост. подгот.') ||
                subject.includes('Выходной день') ||
                subject.includes('День самостоятельной подготовки') ||
                subject.includes('самостоятельной подготовки') ||
                subject.includes('выходной')
            );

            // Проверяем объединенные ячейки (если subject есть, но остальные поля пустые)
            const hasMergedCells = subject && (!type && !teacher && !classroom);

            if (hasData && !isSpecialDay) {
                const scheduleDate = this.parseDate(baseDate, currentDayInfo.day);

                const scheduleItem: ParsedScheduleItem = {
                    subject: subject,
                    time: timeCell, // Используем время из файла
                    teacher: teacher || 'Не указан',
                    classroom: classroom || 'Не указана',
                    date: scheduleDate,
                    type: this.determineType(type || 'Лекция'),
                    group: userGroup,
                    dayOfWeek: currentDayInfo.day,
                    pairNumber: currentPairInDay
                };

                console.log(`Parsed item at pair ${currentPairInDay}:`, {
                    subject: scheduleItem.subject,
                    time: scheduleItem.time,
                    pair: currentPairInDay
                });

                scheduleItems.push(scheduleItem);
            } else if (hasData && isSpecialDay) {
                console.log(`Skipped special day at pair ${currentPairInDay}: ${subject}`);
            } else if (hasMergedCells) {
                console.log(`Found merged cells at pair ${currentPairInDay}: ${subject}`);
                // Можно обработать объединенные ячейки особым образом
            }

            currentPairInDay++;
        }

        console.log(`Total parsed items for ${userGroup}: ${scheduleItems.length}`);
        return scheduleItems;
    }

    private static getAllGroups(data: any[][]): string[] {
        const row24 = data[23]; // 24 строка
        if (!row24 || !Array.isArray(row24)) {
            return [];
        }

        const groups = this.extractGroupsFromRow24(row24);
        return groups.map(g => g.group);
    }

    public static async importFromExcel(userGroup?: string): Promise<ExcelImportResult> {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                copyToCacheDirectory: true,
            });

            if (result.assets && result.assets.length > 0) {
                const file = result.assets[0];

                // Используем fetch для чтения файла
                const response = await fetch(file.uri);

                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                // Выводим отладочную информацию
                console.log('=== Excel File Analysis ===');
                console.log('Total rows:', jsonData.length);

                // Показываем строку 24 для отладки
                if (jsonData[23]) {
                    console.log('Row 24 (groups):', jsonData[23].map((cell, index) =>
                        `${index}: "${cell}"`).filter(x => x.includes('"') && !x.includes('"null"'))
                    );
                }

                // Показываем начало расписания (строки 25-30)
                for (let i = 25; i < Math.min(32, jsonData.length); i++) {
                    if (jsonData[i]) {
                        console.log(`Row ${i}:`, jsonData[i].slice(0, 10)); // Первые 10 колонок
                    }
                }

                // Получаем все группы из файла
                const allGroups = this.getAllGroups(jsonData);
                console.log('All groups found:', allGroups);

                // Если группа не указана, возвращаем список групп
                if (!userGroup) {
                    return {
                        success: true,
                        data: [],
                        groups: allGroups
                    };
                }

                // Проверяем, есть ли выбранная группа в файле
                if (!allGroups.includes(userGroup)) {
                    return {
                        success: false,
                        data: [],
                        error: `Группа "${userGroup}" не найдена в файле. Доступные группы: ${allGroups.join(', ')}`,
                        groups: allGroups
                    };
                }

                // Базовая дата - понедельник текущей недели
                const baseDate = new Date();
                const day = baseDate.getDay();
                const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
                baseDate.setDate(diff);

                console.log(`Base date for parsing: ${baseDate.toISOString()}`);

                // Парсим данные для выбранной группы
                const parsedData = this.parseSubjectData(jsonData, baseDate, userGroup);

                return {
                    success: true,
                    data: parsedData,
                    groups: allGroups
                };
            }

            return {
                success: false,
                data: [],
                error: 'Файл не выбран'
            };

        } catch (error) {
            console.error('Error importing Excel:', error);
            return {
                success: false,
                data: [],
                error: `Ошибка импорта: ${error}`
            };
        }
    }
}
