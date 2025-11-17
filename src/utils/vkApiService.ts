// vkApiService.ts - исправленная версия с улучшенной отладкой

import * as SQLite from 'expo-sqlite';
import { ExcelScheduleParser, ParsedScheduleItem } from './excelParser';

const db = SQLite.openDatabaseSync('student_diary.db');

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
}

export interface ScheduleUpdateResult {
    success: boolean;
    newScheduleCount: number;
    lastUpdate: Date;
    error?: string;
}

class VKApiService {
    // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ТОКЕН!
    private static readonly ACCESS_TOKEN = '0703d2530703d2530703d25392043faa99007030703d2536e123af6c8dc115819766127';
    private static readonly GROUP_ID = -85060840; // kollegevyatsu
    private static readonly API_VERSION = '5.199';
    private static readonly SCHEDULE_KEYWORDS = [
        'расписание', '11', '10.11', '15.11', 'xlsx', 'excel',
        'неделя', 'занятия', 'пар', 'учебн'
    ];

    private lastCheckedPostId: number = 0;

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

    public async getGroupPosts(count: number = 50): Promise<VKPost[]> {
        try {
            const url = `https://api.vk.com/method/wall.get?` +
                `owner_id=${VKApiService.GROUP_ID}&` +
                `count=${count}&` +
                `filter=all&` +
                `access_token=${VKApiService.ACCESS_TOKEN}&` +
                `v=${VKApiService.API_VERSION}`;

            console.log('Fetching VK posts from URL...');

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            console.log('VK API response received');

            if (data.error) {
                console.error('VK API error:', data.error);
                throw new Error(`VK API: ${data.error.error_msg} (code: ${data.error.error_code})`);
            }

            const posts = data.response?.items || [];
            console.log(`Received ${posts.length} posts from VK`);

            return posts;

        } catch (error) {
            console.error('Error fetching VK posts:', error);
            throw error;
        }
    }


    public isSchedulePost(post: VKPost): boolean {
        const text = post.text.toLowerCase();

        console.log(`Checking post ${post.id}: "${text.substring(0, 50)}..."`);

        // Проверяем наличие ключевых слов в тексте поста
        const hasKeywords = VKApiService.SCHEDULE_KEYWORDS.some(keyword => {
            const found = text.includes(keyword.toLowerCase());
            if (found) console.log(`✅ Found keyword: ${keyword}`);
            return found;
        });

        // Проверяем наличие Excel файлов в attachments
        let hasExcelFile = false;
        if (post.attachments) {
            post.attachments.forEach((attachment, index) => {
                if (attachment.type === 'doc' && attachment.doc) {
                    console.log(`📎 Attachment ${index}: ${attachment.doc.title} (${attachment.doc.ext})`);
                    if (attachment.doc.ext === 'xlsx' && this.isScheduleFileName(attachment.doc.title)) {
                        console.log(`✅ Found Excel schedule file: ${attachment.doc.title}`);
                        hasExcelFile = true;
                    }
                }
            });
        }

        const isSchedule = hasKeywords || hasExcelFile;
        console.log(`Post ${post.id} is schedule: ${isSchedule}`);

        return isSchedule;
    }

    private isScheduleFileName(fileName: string): boolean {
        const name = fileName.toLowerCase();
        const isSchedule = (
            name.includes('расписание') ||
            name.includes('11') ||
            name.includes('10.11') ||
            name.includes('15.11') ||
            name.includes('недел') ||
            /расписание.*\.xlsx?$/i.test(name) ||
            /11.*\.xlsx?$/i.test(name)
        );

        console.log(`File "${fileName}" is schedule: ${isSchedule}`);
        return isSchedule;
    }

    public async downloadScheduleFile(doc: VKDoc): Promise<ArrayBuffer> {
        try {
            console.log(`Downloading file: ${doc.title} from ${doc.url}`);
            const response = await fetch(doc.url);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log(`Downloaded ${arrayBuffer.byteLength} bytes`);
            return arrayBuffer;
        } catch (error) {
            console.error('Error downloading schedule file:', error);
            throw error;
        }
    }

    public async processScheduleFile(arrayBuffer: ArrayBuffer, userGroup: string): Promise<number> {
        try {
            console.log(`Processing Excel file for group: ${userGroup}`);
            const result = await ExcelScheduleParser.importFromArrayBuffer(arrayBuffer, userGroup);

            if (result.success) {
                console.log(`Excel parsing successful: ${result.data.length} items found`);
                if (result.data.length > 0) {
                    return this.saveScheduleToDB(result.data, userGroup);
                } else {
                    console.log('No schedule items found in Excel file');
                }
            } else {
                console.error('Excel parsing failed:', result.error);
            }

            return 0;
        } catch (error) {
            console.error('Error processing schedule file:', error);
            throw error;
        }
    }

    private saveScheduleToDB(scheduleItems: ParsedScheduleItem[], userGroup: string): number {
        let importedCount = 0;

        try {
            // ЗАМЕНИТЕ withTransactionSync на обычные вызовы
            // Удаляем старые данные для тех же дат и группы
            const datesToUpdate = [...new Set(scheduleItems.map(item =>
                item.date.toISOString().split('T')[0]
            ))];

            console.log(`Updating dates: ${datesToUpdate.join(', ')}`);

            datesToUpdate.forEach(date => {
                try {
                    const deleted = db.runSync(
                        'DELETE FROM schedule WHERE date LIKE ? AND student_group = ?',
                        [`${date}%`, userGroup]
                    );
                    console.log(`Deleted old schedule for ${date}, group: ${userGroup}`);
                } catch (error) {
                    console.log('Error deleting old schedule:', error);
                }
            });

            // Добавляем новые данные
            scheduleItems.forEach(item => {
                try {
                    db.runSync(
                        `INSERT OR REPLACE INTO schedule (subject, time, teacher, classroom, date, type, student_group) 
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
                } catch (error) {
                    console.log('Error saving schedule item:', error);
                }
            });

            console.log(`✅ Imported ${importedCount} items from VK for group ${userGroup}`);
            return importedCount;
        } catch (error) {
            console.log('Error saving schedule to DB:', error);
            throw error;
        }
    }

    async checkForScheduleUpdates(userGroup: string): Promise<ScheduleUpdateResult> {
        try {
            console.log('🔍 Checking for schedule updates from VK...');
            console.log(`User group: ${userGroup}, Last checked post: ${this.lastCheckedPostId}`);

            if (!userGroup) {
                throw new Error('User group not selected');
            }

            const posts = await this.getGroupPosts(50);
            let newScheduleCount = 0;
            let lastProcessedPostId = this.lastCheckedPostId;

            // Сортируем посты по ID (новые первыми)
            const sortedPosts = posts.sort((a, b) => b.id - a.id);

            console.log(`Processing ${sortedPosts.length} posts...`);

            for (const post of sortedPosts) {
                // Пропускаем уже обработанные посты
                if (post.id <= this.lastCheckedPostId) {
                    console.log(`Skipping post ${post.id} (already processed)`);
                    continue;
                }

                console.log(`🔍 Checking new post ${post.id}...`);

                if (this.isSchedulePost(post)) {
                    console.log(`🎯 Found schedule post: ${post.id}`);

                    // Ищем Excel файлы в attachments
                    const excelAttachments = post.attachments?.filter(att =>
                        att.type === 'doc' &&
                        att.doc?.ext === 'xlsx' &&
                        this.isScheduleFileName(att.doc.title)
                    ) || [];

                    console.log(`Found ${excelAttachments.length} Excel attachments`);

                    for (const attachment of excelAttachments) {
                        if (attachment.doc) {
                            try {
                                console.log(`📥 Processing attachment: ${attachment.doc.title}`);
                                const arrayBuffer = await this.downloadScheduleFile(attachment.doc);
                                const count = await this.processScheduleFile(arrayBuffer, userGroup);
                                newScheduleCount += count;

                                console.log(`✅ Processed: ${attachment.doc.title}, imported ${count} items`);
                            } catch (error) {
                                console.error(`❌ Error processing attachment:`, error);
                            }
                        }
                    }
                }

                // Обновляем ID последнего обработанного поста
                if (post.id > lastProcessedPostId) {
                    lastProcessedPostId = post.id;
                }
            }

            // Сохраняем новый последний ID
            if (lastProcessedPostId > this.lastCheckedPostId) {
                await this.saveLastCheckedPostId(lastProcessedPostId);
                console.log(`📝 Updated last checked post ID to: ${lastProcessedPostId}`);
            }

            console.log(`✅ Update check completed. New items: ${newScheduleCount}`);

            return {
                success: true,
                newScheduleCount,
                lastUpdate: new Date()
            };

        } catch (error) {
            console.error('❌ Error checking for schedule updates:', error);
            return {
                success: false,
                newScheduleCount: 0,
                lastUpdate: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async forceCheckUpdates(userGroup: string): Promise<ScheduleUpdateResult> {
        console.log('🔄 Force checking updates...');
        // Сбрасываем lastCheckedPostId для принудительной проверки
        this.lastCheckedPostId = 0;
        await this.saveLastCheckedPostId(0);
        return await this.checkForScheduleUpdates(userGroup);
    }

    async getLastUpdateInfo(): Promise<{ lastUpdate: Date; lastPostId: number }> {
        return {
            lastUpdate: new Date(),
            lastPostId: this.lastCheckedPostId
        };
    }
}

export const vkApiService = new VKApiService();