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
    speciality?: string;
    educationForm?: string;
    institution?: string;
    academicYear?: string;
    semester?: string;
}

export interface GroupInfo {
    group: string;
    startColumn: number;
    speciality: string;
    educationForm: string;
    institution: string;
    academicYear: string;
    semester: string;
}

export interface ExcelImportResult {
    success: boolean;
    data: ParsedScheduleItem[];
    error?: string;
    groups?: GroupInfo[];
}

export class ExcelScheduleParser {
    private static readonly DAYS_OF_WEEK = [
        'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'
    ];

    private static readonly SCHEDULE_START_COLUMN = 6;

    private static extractGroupFromCell(cellValue: string): string | null {
        if (!cellValue) return null;

        const cleanValue = cellValue.toString().trim();

        const groupMatch = cleanValue.match(/Группа\s+([^\s,;]+)/i);
        if (groupMatch && groupMatch[1]) {
            return groupMatch[1].trim();
        }

        const directMatch = cleanValue.match(/[А-Я]{2,}к?-\d{3}-\d{2}-\d{2}/);
        if (directMatch) {
            return directMatch[0].trim();
        }

        return null;
    }

    private static extractAcademicInfo(data: any[][]): {
        academicYear?: string;
        semester?: string;
    } {
        const result: any = {};

        for (let row = 20; row <= 25; row++) {
            const rowData = data[row];
            if (!rowData) continue;

            for (let col = this.SCHEDULE_START_COLUMN; col < rowData.length; col++) {
                const cellValue = rowData[col]?.toString().trim();
                if (!cellValue) continue;

                console.log(`Checking cell [${row},${col}]: "${cellValue}"`);

                const yearMatch = cellValue.match(/На\s+(\d+)\s+(?:полугодие|семестр)\s+(\d{4})\s*-\s*(\d{4})\s+учебного года/i);
                if (yearMatch) {
                    console.log(`FOUND ACADEMIC INFO: ${yearMatch[0]}`);

                    result.semester = yearMatch[1].includes('1') ? '1 полугодие' : '2 полугодие';
                    result.academicYear = `${yearMatch[2]}-${yearMatch[3]}`;

                    return result;
                }

                const altMatch = cellValue.match(/(\d{4})\s*-\s*(\d{4})\s+учебный год/i);
                if (altMatch) {
                    result.academicYear = `${altMatch[1]}-${altMatch[2]}`;
                    result.semester = '1 полугодие';
                    return result;
                }
            }
        }

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        result.academicYear = `${currentYear}-${currentYear + 1}`;
        result.semester = currentMonth >= 9 ? '1 полугодие' : '2 полугодие';

        console.log(`Using default academic year: ${result.academicYear}, ${result.semester}`);

        return result;
    }

    private static extractSpecialityInfo(data: any[][]): {
        speciality?: string;
        educationForm?: string;
        institution?: string;
    } {
        const result: any = {};

        for (let i = 16; i <= 19; i++) {
            const row = data[i];
            if (!row) continue;

            for (let col = this.SCHEDULE_START_COLUMN; col < row.length; col++) {
                const cellValue = row[col]?.toString().trim();
                if (!cellValue) continue;

                if (cellValue.includes('Форма обучения')) {
                    result.educationForm = cellValue.replace('Форма обучения', '').replace('-', '').trim();
                }

                if (cellValue.includes('Колледж') || cellValue.includes('Университет')) {
                    result.institution = cellValue;
                }

                if (cellValue.includes('Специальность') || /\d{2}\.\d{2}\.\d{2}/.test(cellValue)) {
                    result.speciality = cellValue;
                }
            }
        }

        return result;
    }

    private static analyzeGroupName(groupName: string): {
        code: string;
        speciality: string;
        institution: string;
        course: number;
        groupNumber: number;
    } {
        const match = groupName.match(/^([А-Я]{2,})(к?)-(\d)(\d{2})-(\d{2})-(\d{2})$/);

        if (match) {
            const [, code, isCollege, course, groupNum] = match;

            const specialityMap: {[key: string]: string} = {
                'ДО': 'Дошкольное образование',
                'ИСП': 'Информационные системы и программирование',
                'ПНК': 'Прикладная информатика',
                'ЮР': 'Юриспруденция',
                'ФК': 'Физическая культура',
                'МР': 'Менеджмент',
                'З': 'Землеустройство',
                'ФН': 'Финансы',
                'Р': 'Реклама',
                'ЭКОО': 'Экономика'
            };

            return {
                code: code,
                speciality: specialityMap[code] || `Специальность ${code}`,
                institution: isCollege ? 'Колледж' : 'Университет',
                course: parseInt(course),
                groupNumber: parseInt(groupNum)
            };
        }

        return {
            code: groupName,
            speciality: groupName,
            institution: 'Неизвестно',
            course: 0,
            groupNumber: 0
        };
    }

    private static parseDate(
        dayInfo: { day: string, dayNumber: number, month: number },
        academicYear: string,
        semester: string
    ): Date {
        const [startYearStr, endYearStr] = academicYear.split('-');
        const startYear = parseInt(startYearStr);
        const endYear = parseInt(endYearStr);

        let year: number;

        if (semester.includes('1')) {
            year = startYear;
        } else {
            year = endYear;
        }

        if (dayInfo.dayNumber < 1 || dayInfo.dayNumber > 31) {
            console.error(`Incorrect day: ${dayInfo.dayNumber}`);
            return new Date();
        }

        if (dayInfo.month < 1 || dayInfo.month > 12) {
            console.error(`Incorrect month: ${dayInfo.month}`);
            return new Date();
        }

        console.log(`DATE PARSED: ${dayInfo.dayNumber}.${dayInfo.month}.${year} (${dayInfo.day}, ${semester})`);

        return new Date(year, dayInfo.month - 1, dayInfo.dayNumber);
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

    private static extractGroupsWithInfo(data: any[][]): GroupInfo[] {
        const groups: GroupInfo[] = [];
        const row24 = data[23];

        if (!row24) {
            console.log('Row 24 (groups) not found');
            return [];
        }

        console.log('    ANALYZING EXCEL STRUCTURE    ');
        console.log(`Schedule starts from column: ${this.SCHEDULE_START_COLUMN} (column G)`);

        const academicInfo = this.extractAcademicInfo(data);
        console.log(`Academic year: ${academicInfo.academicYear}, Semester: ${academicInfo.semester}`);

        const specialityInfo = this.extractSpecialityInfo(data);
        console.log('Speciality info:', specialityInfo);

        for (let col = this.SCHEDULE_START_COLUMN; col < row24.length; col++) {
            const cellValue = row24[col]?.toString().trim();

            if (cellValue) {
                console.log(`Found group cell at column ${col}: "${cellValue}"`);

                const lines = cellValue.split('\n');
                const groupsInCell: string[] = [];

                for (const line of lines) {
                    const groupName = this.extractGroupFromCell(line);
                    if (groupName) {
                        groupsInCell.push(groupName);
                    }
                }

                if (groupsInCell.length > 0) {
                    console.log(`Groups in cell: ${groupsInCell.join(', ')}`);

                    groupsInCell.forEach((groupName) => {
                        const groupStartColumn = col;
                        const groupAnalysis = this.analyzeGroupName(groupName);

                        groups.push({
                            group: groupName,
                            startColumn: groupStartColumn,
                            speciality: specialityInfo.speciality || groupAnalysis.speciality,
                            educationForm: specialityInfo.educationForm || 'очная',
                            institution: specialityInfo.institution || groupAnalysis.institution,
                            academicYear: academicInfo.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                            semester: academicInfo.semester || '1 полугодие'
                        });

                        console.log(`GROUP: ${groupName} -> columns ${groupStartColumn}-${groupStartColumn + 3}`);
                    });

                    col += 3;
                }
            }
        }

        console.log('\n    FINAL GROUP STRUCTURE    ');
        groups.forEach(g => {
            console.log(`${g.group}: columns ${g.startColumn}-${g.startColumn + 3}, ${g.speciality}`);
        });

        return groups;
    }

    private static extractDayInfo(row: any[]): { day: string, dayNumber: number, month: number } | null {
        const firstCell = row[this.SCHEDULE_START_COLUMN]?.toString().trim();
        if (!firstCell) return null;

        console.log(`RAW DAY ROW: "${firstCell}"`);

        const match = firstCell.match(/(ПОНЕДЕЛЬНИК|ВТОРНИК|СРЕДА|ЧЕТВЕРГ|ПЯТНИЦА|СУББОТА)\s+(\d{1,2})\.(\d{1,2})/i);

        if (match) {
            const dayNumber = parseInt(match[2]);
            const month = parseInt(match[3]);

            console.log(`PARSED DATE: ${match[1]} - ${dayNumber}.${month} from "${firstCell}"`);

            return {
                day: match[1].toUpperCase(),
                dayNumber: dayNumber,
                month: month
            };
        }

        console.log(`FAILED TO PARSE DATE: "${firstCell}"`);
        return null;
    }

    private static getCellValue(data: any[][], row: number, col: number): string {
        if (row < 0 || row >= data.length) return '';
        const rowData = data[row];
        if (!rowData || col >= rowData.length) return '';

        const value = rowData[col]?.toString().trim();
        return value || '';
    }

    private static createMergedCellsMap(mergedCells: XLSX.Range[]): Map<string, { startRow: number, startCol: number }> {
        const map = new Map();

        if (!mergedCells || mergedCells.length === 0) {
            console.log('No merged cells found in the worksheet');
            return map;
        }

        console.log(`Processing ${mergedCells.length} merged cell ranges`);

        mergedCells.forEach((merge: XLSX.Range, index: number) => {
            const { s, e } = merge;

            console.log(`Merged range ${index}: [${s.r},${s.c}] to [${e.r},${e.c}]`);

            for (let row = s.r; row <= e.r; row++) {
                for (let col = s.c; col <= e.c; col++) {
                    if (row !== s.r || col !== s.c) {
                        const key = `${row},${col}`;
                        map.set(key, { startRow: s.r, startCol: s.c });
                        console.log(`  Mapped [${row},${col}] -> [${s.r},${s.c}]`);
                    }
                }
            }
        });

        console.log(`Created merged cells map with ${map.size} entries`);
        return map;
    }

    private static getMergedCellValue(
        data: any[][],
        mergedCellsMap: Map<string, { startRow: number, startCol: number }>,
        row: number,
        col: number
    ): string {
        const key = `${row},${col}`;

        if (mergedCellsMap.has(key)) {
            const mergeInfo = mergedCellsMap.get(key)!;
            const mainValue = this.getCellValue(data, mergeInfo.startRow, mergeInfo.startCol);
            console.log(`Merged cell [${row},${col}] -> [${mergeInfo.startRow},${mergeInfo.startCol}]: "${mainValue}"`);
            return mainValue;
        }

        const value = this.getCellValue(data, row, col);
        return value;
    }

    private static parseSubjectDataWithMergedCells(
        data: any[][],
        userGroup: string,
        mergedCells: XLSX.Range[]
    ): ParsedScheduleItem[] {
        const scheduleItems: ParsedScheduleItem[] = [];

        const allGroups = this.extractGroupsWithInfo(data);
        const targetGroup = allGroups.find(g => g.group === userGroup);

        if (!targetGroup) {
            console.log(`Group ${userGroup} not found in groups list`);
            return [];
        }

        console.log(`\n    PARSING SCHEDULE FOR ${userGroup} WITH MERGED CELLS SUPPORT    `);
        console.log(`Target group:`, targetGroup);

        const mergedCellsMap = this.createMergedCellsMap(mergedCells);

        let currentDayInfo: { day: string, dayNumber: number, month: number } | null = null;
        let currentPairNumber = 0;

        for (let rowIndex = 25; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (!Array.isArray(row)) continue;

            const dayInfo = this.extractDayInfo(row);
            if (dayInfo) {
                currentDayInfo = dayInfo;
                currentPairNumber = 0;
                console.log(`\nNEW DAY: ${dayInfo.day} ${dayInfo.dayNumber}.${dayInfo.month} at row ${rowIndex}`);
                continue;
            }

            if (!currentDayInfo) {
                continue;
            }

            const timeCell = row[this.SCHEDULE_START_COLUMN + 1]?.toString().trim();
            if (!timeCell || !timeCell.includes('-')) {
                continue;
            }

            const subjectCol = targetGroup.startColumn;
            const typeCol = targetGroup.startColumn + 1;
            const teacherCol = targetGroup.startColumn + 2;
            const classroomCol = targetGroup.startColumn + 3;

            const subject = this.getMergedCellValue(data, mergedCellsMap, rowIndex, subjectCol);
            const type = this.getMergedCellValue(data, mergedCellsMap, rowIndex, typeCol);
            const teacher = this.getMergedCellValue(data, mergedCellsMap, rowIndex, teacherCol);
            const classroom = this.getMergedCellValue(data, mergedCellsMap, rowIndex, classroomCol);

            const isSpecialDay = subject && (
                subject.includes('День самост. подгот.') ||
                subject.includes('День самостоятельной подготовки') ||
                subject.includes('самостоятельной подготовки') ||
                subject.includes('выходной') ||
                subject.includes('Выходной день')
            );

            const isEmptySubject = !subject || subject.length === 0;

            if (!isEmptySubject && !isSpecialDay) {
                const scheduleDate = this.parseDate(currentDayInfo, targetGroup.academicYear, targetGroup.semester);

                const scheduleItem: ParsedScheduleItem = {
                    subject: subject,
                    time: timeCell,
                    teacher: teacher || 'Не указан',
                    classroom: classroom || 'Не указана',
                    date: scheduleDate,
                    type: this.determineType(type || 'Лекция'),
                    group: userGroup,
                    dayOfWeek: currentDayInfo.day,
                    pairNumber: currentPairNumber,
                    speciality: targetGroup.speciality,
                    educationForm: targetGroup.educationForm,
                    institution: targetGroup.institution,
                    academicYear: targetGroup.academicYear,
                    semester: targetGroup.semester
                };

                console.log(`   PARSED [${currentPairNumber}]: ${scheduleItem.time} - ${scheduleItem.subject}`);
                console.log(`   Teacher: ${scheduleItem.teacher}, Classroom: ${scheduleItem.classroom}, Type: ${scheduleItem.type}`);

                scheduleItems.push(scheduleItem);
                currentPairNumber++;
            } else if (isSpecialDay) {
                console.log(`   SKIPPED SPECIAL: ${subject}`);
            } else if (isEmptySubject) {
                console.log(`   EMPTY SLOT: ${timeCell}`);
            }
        }

        console.log(`\n    TOTAL PARSED ITEMS: ${scheduleItems.length}    `);
        scheduleItems.forEach(item => {
            const dateStr = item.date.toLocaleDateString('ru-RU');
            console.log(`   ${item.dayOfWeek} ${dateStr}: ${item.time} - ${item.subject}`);
        });

        return scheduleItems;
    }

    private static restoreMergedCellsData(data: any[][]): any[][] {
        const restoredData = JSON.parse(JSON.stringify(data));

        console.log('   Restoring merged cells data...');

        for (let row = 25; row < restoredData.length; row++) {
            if (!restoredData[row]) continue;

            for (let col = this.SCHEDULE_START_COLUMN; col < restoredData[row].length; col++) {
                const currentValue = restoredData[row][col];

                if ((!currentValue || currentValue.toString().trim() === '') && row > 25) {
                    const valueAbove = restoredData[row - 1][col];
                    const timeCurrent = restoredData[row][this.SCHEDULE_START_COLUMN + 1];
                    const timeAbove = restoredData[row - 1][this.SCHEDULE_START_COLUMN + 1];

                    if (valueAbove && timeCurrent && timeAbove &&
                        timeCurrent.toString().includes('-') && timeAbove.toString().includes('-')) {
                        restoredData[row][col] = valueAbove;
                        console.log(`   Restored [${row},${col}] from [${row-1},${col}]: "${valueAbove}"`);
                    }
                }
            }
        }

        return restoredData;
    }

    private static parseSubjectData(
        data: any[][],
        userGroup: string
    ): ParsedScheduleItem[] {
        const restoredData = this.restoreMergedCellsData(data);
        return this.parseSubjectDataWithMergedCells(restoredData, userGroup, []);
    }

    private static getAllGroups(data: any[][]): GroupInfo[] {
        return this.extractGroupsWithInfo(data);
    }

    public static async importFromArrayBuffer(arrayBuffer: ArrayBuffer, userGroup: string): Promise<ExcelImportResult> {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const mergedCells = worksheet['!merges'] || [];
            console.log(`Found ${mergedCells.length} merged cell ranges in the worksheet`);

            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            console.log('    EXCEL FILE FROM ARRAYBUFFER LOADED    ');
            console.log('Total rows:', jsonData.length);
            console.log(`Schedule starts from column: ${this.SCHEDULE_START_COLUMN} (column G)`);
            console.log(`Merged cells: ${mergedCells.length}`);

            const allGroups = this.getAllGroups(jsonData);
            console.log('All groups found:', allGroups.map(g => ({
                group: g.group,
                speciality: g.speciality,
                academicYear: g.academicYear,
                semester: g.semester
            })));

            if (!userGroup) {
                return {
                    success: true,
                    data: [],
                    groups: allGroups
                };
            }

            const targetGroup = allGroups.find(g => g.group === userGroup);
            if (!targetGroup) {
                return {
                    success: false,
                    data: [],
                    error: `Группа "${userGroup}" не найдена в файле. Доступные группы: ${allGroups.map(g => g.group).join(', ')}`,
                    groups: allGroups
                };
            }

            console.log(`\n    STARTING IMPORT FOR GROUP: ${userGroup}    `);

            let parsedData: ParsedScheduleItem[];

            if (mergedCells.length > 0) {
                console.log('   Using merged cells information for parsing');
                parsedData = this.parseSubjectDataWithMergedCells(jsonData, userGroup, mergedCells);
            } else {
                console.log('   Using heuristic method for merged cells');
                parsedData = this.parseSubjectData(jsonData, userGroup);
            }

            if (parsedData.length === 0) {
                return {
                    success: false,
                    data: [],
                    error: `Группа "${userGroup}" найдена, но занятия не обнаружены. Проверьте структуру файла.`,
                    groups: allGroups
                };
            }

            return {
                success: true,
                data: parsedData,
                groups: allGroups
            };

        } catch (error) {
            console.error('Error importing from ArrayBuffer:', error);
            return {
                success: false,
                data: [],
                error: `Ошибка импорта: ${error}`
            };
        }
    }

    public static async importFromExcel(userGroup?: string): Promise<ExcelImportResult> {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                copyToCacheDirectory: true,
            });

            if (result.assets && result.assets.length > 0) {
                const file = result.assets[0];

                console.log('Reading Excel file...');
                const response = await fetch(file.uri);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status}`);
                }

                const arrayBuffer = await response.arrayBuffer();

                return await this.importFromArrayBuffer(arrayBuffer, userGroup || '');
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