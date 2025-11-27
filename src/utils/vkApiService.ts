import { Platform } from 'react-native';
import { db } from './databaseService';
import { ExcelScheduleParser, ParsedScheduleItem } from './excelParser';

export interface VKPost {
    id: number;
    date: number;
    text: string;
    attachments?: VKAttachment[];
}

export interface VKAttachment {
    type: string;
    doc?: VKDoc;
}

export interface VKDoc {
    id: number;
    owner_id: number;
    title: string;
    size: number;
    ext: string;
    url: string;
    date: number;
    access_key?: string;
}

export interface ScheduleUpdateResult {
    success: boolean;
    newScheduleCount: number;
    lastUpdate: Date;
    error?: string;
}

class VKApiService {
    private static readonly ACCESS_TOKENS = {
        web: '9d4ded009d4ded009d4ded001d9e70e02599d4d9d4ded00f450489dea2361513364a537',
        android: '37be43fd37be43fd37be43fddc34834edb337be37be43fd5ea3e66060620b2892cbcca3',
        ios: '2b4359da2b4359da2b4359dabd287e54f322b432b4359da425efc478ad709a144070304'
    };

    private static readonly GROUP_ID = -85060840;
    private static readonly API_VERSION = '5.199';

    private static readonly PROXY_SERVER = 'http://localhost:3001';

    private static readonly SCHEDULE_KEYWORDS = [
        'расписание', 'расписан', 'занятия', 'пары', 'недел', 'изменен', 'обновлен',
        'экзамен', 'сессия', 'учебн', 'занятий', 'пар', 'график',
        '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
        '10.11', '11.11', '12.11', '13.11', '14.11', '15.11', '16.11', '17.11', '18.11', '19.11', '20.11',
        'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
        'осенн', 'весенн', 'семестр', 'полугод', 'четверт'
    ];

    private lastCheckedPostId: number = 0;

    private getAccessToken(): string {
        if (Platform.OS === 'web') {
            return VKApiService.ACCESS_TOKENS.web;
        } else if (Platform.OS === 'android') {
            return VKApiService.ACCESS_TOKENS.android;
        } else if (Platform.OS === 'ios') {
            return VKApiService.ACCESS_TOKENS.ios;
        }
        return VKApiService.ACCESS_TOKENS.web;
    }

    public async getGroupPosts(count: number = 50): Promise<VKPost[]> {
        return this.getRealGroupPosts(count);
    }

    public async downloadScheduleFile(doc: VKDoc): Promise<ArrayBuffer> {
        console.log(`📥 Загрузка файла: ${doc.title}`);

        if (Platform.OS === 'web') {
            return await this.downloadScheduleFileWithProxy(doc);
        } else {
            return await this.downloadScheduleFileDirect(doc);
        }
    }

    private async downloadScheduleFileWithProxy(doc: VKDoc): Promise<ArrayBuffer> {
        try {
            const proxyUrl = `${VKApiService.PROXY_SERVER}/api/simple-file-proxy?url=${encodeURIComponent(doc.url)}`;

            console.log(`🌐 Загрузка через улучшенный прокси`);
            console.log(`📡 URL: ${proxyUrl.substring(0, 100)}...`);

            const response = await this.fetchWithTimeout(proxyUrl, {}, 30000);

            if (!response.ok) {
                throw new Error(`Ошибка загрузки файла: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log(`✅ Загружено ${arrayBuffer.byteLength} байт`);
            return arrayBuffer;

        } catch (error) {
            console.error('❌ Ошибка загрузки через прокси:', error);
            throw new Error(`Не удалось загрузить файл: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async downloadScheduleFileDirect(doc: VKDoc): Promise<ArrayBuffer> {
        try {
            console.log(`📥 Прямая загрузка файла`);
            const response = await this.fetchWithTimeout(doc.url, {}, 15000);

            if (!response.ok) {
                throw new Error(`Ошибка загрузки файла: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log(`✅ Загружено ${arrayBuffer.byteLength} байт`);
            return arrayBuffer;

        } catch (error) {
            console.error('❌ Ошибка прямой загрузки:', error);
            throw new Error(`Не удалось загрузить файл: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 15000): Promise<Response> {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: abortController.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    public async getRealGroupPosts(count: number = 50): Promise<VKPost[]> {
        try {
            console.log('🔄 Получение постов из VK...');

            if (Platform.OS === 'web') {
                return await this.getRealPostsWithProxy(count);
            } else {
                return await this.getRealPostsDirect(count);
            }
        } catch (error) {
            console.error('Ошибка получения постов:', error);
            throw new Error('Не удалось получить постов из VK');
        }
    }

    private async getRealPostsWithProxy(count: number): Promise<VKPost[]> {
        try {
            const accessToken = this.getAccessToken();
            const params = `owner_id=${VKApiService.GROUP_ID}&count=${count}&filter=all&access_token=${accessToken}&v=${VKApiService.API_VERSION}`;

            const proxyUrl = `${VKApiService.PROXY_SERVER}/api/vk-proxy?method=wall.get&params=${encodeURIComponent(params)}`;

            console.log(`🌐 Запрос через собственный прокси`);
            console.log(`🔑 Используется ${Platform.OS.toUpperCase()} ключ`);

            const response = await this.fetchWithTimeout(proxyUrl, {}, 15000);

            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                console.error('Ошибка VK API:', data.error);
                throw new Error(`VK API: ${data.error.error_msg}`);
            }

            const posts = data.response?.items || [];
            console.log(`📝 Получено ${posts.length} постов`);

            return posts;

        } catch (error) {
            console.error('❌ Ошибка запроса через собственный прокси:', error);
            throw new Error(`Прокси сервер не доступен. Убедитесь, что он запущен на порту 3001. ${error instanceof Error ? error.message : ''}`);
        }
    }

    private async getRealPostsDirect(count: number): Promise<VKPost[]> {
        try {
            const accessToken = this.getAccessToken();
            const vkUrl = `https://api.vk.com/method/wall.get?` +
                `owner_id=${VKApiService.GROUP_ID}&` +
                `count=${count}&` +
                `filter=all&` +
                `access_token=${accessToken}&` +
                `v=${VKApiService.API_VERSION}`;

            console.log(`🌐 Прямой запрос к VK API`);
            console.log(`🔑 Используется ${Platform.OS.toUpperCase()} ключ`);

            const response = await this.fetchWithTimeout(vkUrl, {
                headers: {
                    'User-Agent': 'VyatSU-Diary-App/1.0',
                    'Accept': 'application/json',
                }
            }, 15000);

            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Ответ от VK API получен');

            if (data.error) {
                console.error('Ошибка VK API:', data.error);
                throw new Error(`VK API: ${data.error.error_msg}`);
            }

            const posts = data.response?.items || [];
            console.log(`📝 Получено ${posts.length} постов`);

            return posts;

        } catch (error) {
            console.error('❌ Ошибка прямого запроса:', error);
            throw new Error(`Не удалось получить посты: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public isSchedulePost(post: VKPost): boolean {
        const text = post.text.toLowerCase();

        console.log(`🔍 Проверка поста ${post.id}: "${text.substring(0, 100)}..."`);

        const hasKeywords = VKApiService.SCHEDULE_KEYWORDS.some(keyword => {
            const found = text.includes(keyword.toLowerCase());
            if (found) {
                console.log(`✅ Найден ключ: "${keyword}"`);
            }
            return found;
        });

        let hasExcelFile = false;
        if (post.attachments && post.attachments.length > 0) {
            post.attachments.forEach((attachment: VKAttachment, index: number) => {
                if (attachment.type === 'doc' && attachment.doc) {
                    const doc = attachment.doc;
                    console.log(`📎 Вложение ${index}: "${doc.title}" (${doc.ext})`);

                    if (doc.ext === 'xlsx' || doc.ext === 'xls') {
                        const isScheduleFile = this.isScheduleFileName(doc.title);
                        console.log(`📊 Excel файл "${doc.title}" - расписание: ${isScheduleFile}`);
                        if (isScheduleFile) {
                            hasExcelFile = true;
                        }
                    }
                }
            });
        }

        const isSchedule = hasKeywords || hasExcelFile;
        console.log(`📋 Пост ${post.id} - расписание: ${isSchedule} (ключи: ${hasKeywords}, Excel: ${hasExcelFile})`);

        return isSchedule;
    }

    private isScheduleFileName(fileName: string): boolean {
        const name = fileName.toLowerCase();

        const scheduleIndicators = [
            'расписание', 'расписан', 'schedule',
            'недел', 'week', 'занятия', 'classes',
            'пар', 'lessons', 'сессия', 'session',
            'экзамен', 'exam', 'график', 'timetable'
        ];

        const dateIndicators = [
            '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
            'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
            'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
        ];

        const hasScheduleWord = scheduleIndicators.some(word => name.includes(word));
        const hasDate = dateIndicators.some(date => name.includes(date));
        const hasExcelExtension = name.endsWith('.xlsx') || name.endsWith('.xls');

        const isSchedule = (hasScheduleWord || hasDate) && hasExcelExtension;

        console.log(`📁 Файл "${fileName}" - расписание: ${isSchedule} (расписание: ${hasScheduleWord}, дата: ${hasDate}, excel: ${hasExcelExtension})`);

        return isSchedule;
    }

    async checkForScheduleUpdates(userGroup: string): Promise<ScheduleUpdateResult> {
        try {
            console.log('🔍 Проверка обновлений расписания...');
            console.log(`👥 Группа: ${userGroup}`);

            if (!userGroup) {
                throw new Error('Группа не выбрана');
            }

            const posts = await this.getRealGroupPosts(30);
            let newScheduleCount = 0;

            console.log(`📝 Анализируем ${posts.length} постов...`);

            const sortedPosts = posts.sort((a: VKPost, b: VKPost) => b.date - a.date);
            const schedulePosts = sortedPosts.filter(post => this.isSchedulePost(post));

            console.log(`🎯 Найдено ${schedulePosts.length} постов с расписанием`);

            for (const post of schedulePosts) {
                console.log(`📋 Обработка поста ${post.id}...`);

                const excelAttachments = post.attachments?.filter((att: VKAttachment) =>
                    att.type === 'doc' &&
                    att.doc &&
                    (att.doc.ext === 'xlsx' || att.doc.ext === 'xls') &&
                    this.isScheduleFileName(att.doc.title)
                ) || [];

                console.log(`📎 Найдено ${excelAttachments.length} Excel файлов в посте ${post.id}`);

                for (const attachment of excelAttachments) {
                    if (attachment.doc) {
                        try {
                            console.log(`📥 Загрузка файла: ${attachment.doc.title}`);

                            const arrayBuffer = await this.downloadScheduleFile(attachment.doc);
                            const count = await this.processScheduleFile(arrayBuffer, userGroup);

                            newScheduleCount += count;
                            console.log(`✅ Файл обработан: ${attachment.doc.title}, добавлено ${count} занятий`);

                        } catch (error) {
                            console.error(`❌ Ошибка обработки файла ${attachment.doc.title}:`, error);
                        }
                    }
                }
            }

            console.log(`✅ Проверка завершена. Новых занятий: ${newScheduleCount}`);

            return {
                success: true,
                newScheduleCount,
                lastUpdate: new Date()
            };

        } catch (error) {
            console.error('❌ Ошибка проверки обновлений:', error);
            return {
                success: false,
                newScheduleCount: 0,
                lastUpdate: new Date(),
                error: error instanceof Error ? error.message : 'Неизвестная ошибка'
            };
        }
    }

    async forceCheckUpdates(userGroup: string): Promise<ScheduleUpdateResult> {
        console.log('🔄 Принудительная проверка обновлений...');
        return await this.checkForScheduleUpdates(userGroup);
    }

    public async processScheduleFile(arrayBuffer: ArrayBuffer, userGroup: string): Promise<number> {
        try {
            console.log(`🔧 Обработка Excel файла для группы: ${userGroup}`);

            const result = await ExcelScheduleParser.importFromArrayBuffer(arrayBuffer, userGroup);

            if (result.success && result.data.length > 0) {
                return this.saveScheduleToDB(result.data, userGroup);
            } else {
                throw new Error(result.error || 'Не удалось распарсить файл');
            }

        } catch (error) {
            console.error('Ошибка обработки файла:', error);
            throw error;
        }
    }

    private saveScheduleToDB(scheduleItems: ParsedScheduleItem[], userGroup: string): number {
        let importedCount = 0;

        try {
            const datesToUpdate = [...new Set(scheduleItems.map(item =>
                item.date.toISOString().split('T')[0]
            ))];

            console.log(`🗑️ Обновление дат: ${datesToUpdate.join(', ')}`);

            datesToUpdate.forEach(date => {
                try {
                    db.runSync(
                        'DELETE FROM schedule WHERE date LIKE ? AND student_group = ?',
                        [`${date}%`, userGroup]
                    );
                    console.log(`✅ Удалено старое расписание для ${date}, группа: ${userGroup}`);
                } catch (error) {
                    console.log('Ошибка удаления старого расписания:', error);
                }
            });

            scheduleItems.forEach(item => {
                try {
                    db.runSync(
                        `INSERT INTO schedule (subject, time, teacher, classroom, date, type, student_group)
                         VALUES (?, ?, ?, ?, ?, ?, ?);`,
                        [
                            item.subject,
                            item.time,
                            item.teacher,
                            item.classroom,
                            item.date.toISOString(),
                            item.type,
                            userGroup
                        ]
                    );
                    importedCount++;
                    console.log(`✅ Сохранено занятие: ${item.subject} ${item.date.toISOString()}`);
                } catch (error) {
                    console.log('Ошибка сохранения занятия:', error, {
                        subject: item.subject,
                        time: item.time,
                        teacher: item.teacher,
                        classroom: item.classroom,
                        date: typeof item.date,
                        dateValue: item.date,
                        type: item.type,
                        group: userGroup
                    });
                }
            });

            console.log(`✅ Импортировано ${importedCount} занятий для группы ${userGroup}`);
            return importedCount;
        } catch (error) {
            console.log('Ошибка сохранения в БД:', error);
            throw error;
        }
    }

    async initialize(): Promise<void> {
        await this.initDatabase();
        await this.loadLastCheckedPostId();
        console.log('VK Service initialized. Last checked post ID:', this.lastCheckedPostId);
    }

    private async initDatabase(): Promise<void> {
        try {
            db.execSync(`
                CREATE TABLE IF NOT EXISTS update_history (
                                                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                              timestamp TEXT NOT NULL,
                                                              new_items_count INTEGER NOT NULL,
                                                              success INTEGER NOT NULL,
                                                              error_message TEXT
                );
            `);
            console.log('Update history table checked/created');
        } catch (error) {
            console.log('Error creating update_history table:', error);
        }
    }

    private async loadLastCheckedPostId(): Promise<void> {
        try {
            const result = db.getFirstSync('SELECT value FROM settings WHERE key = "last_checked_post_id"') as any;
            if (result) {
                this.lastCheckedPostId = parseInt(result.value);
                console.log('Loaded last checked post ID:', this.lastCheckedPostId);
            } else {
                console.log('No last checked post ID found, starting from 0');
                this.lastCheckedPostId = 0;
            }
        } catch (error) {
            console.log('Error loading last checked post ID:', error);
            this.lastCheckedPostId = 0;
        }
    }

    private async saveLastCheckedPostId(postId: number): Promise<void> {
        try {
            db.runSync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
                ['last_checked_post_id', postId.toString()]
            );
            this.lastCheckedPostId = postId;
            console.log('Saved last checked post ID:', postId);
        } catch (error) {
            console.log('Error saving last checked post ID:', error);
        }
    }
}

export const vkApiService = new VKApiService();