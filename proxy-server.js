const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3001;

app.use(cors({
    origin: ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:19000'],
    credentials: true
}));

app.use(express.json());

app.get('/api/vk-proxy', async (req, res) => {
    try {
        const { method, params } = req.query;

        if (!method) {
            return res.status(400).json({ error: 'Method parameter is required' });
        }

        const url = `https://api.vk.com/method/${method}?${params}`;

        console.log('🔄 Прокси запрос к:', url.substring(0, 100) + '...');

        https.get(url, (vkRes) => {
            let data = '';

            vkRes.on('data', (chunk) => {
                data += chunk;
            });

            vkRes.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    res.json(jsonData);
                } catch (parseError) {
                    console.error('❌ Ошибка парсинга JSON:', parseError);
                    res.status(500).json({ error: 'JSON parse error' });
                }
            });

        }).on('error', (error) => {
            console.error('❌ Ошибка прокси:', error);
            res.status(500).json({
                error: 'Proxy error',
                message: error.message
            });
        });

    } catch (error) {
        console.error('❌ Ошибка прокси:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
});

function followRedirects(url, maxRedirects = 5, callback) {
    if (maxRedirects <= 0) {
        return callback(new Error('Too many redirects'));
    }

    const urlObj = new URL(url);
    const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
            'User-Agent': 'VyatSU-Diary-App/1.0',
            'Accept': '*/*'
        }
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;

    protocol.get(options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log(`🔄 Редирект ${response.statusCode} -> ${response.headers.location}`);
            followRedirects(response.headers.location, maxRedirects - 1, callback);
        } else if (response.statusCode === 200) {
            callback(null, response);
        } else {
            callback(new Error(`HTTP error: ${response.statusCode}`));
        }
    }).on('error', (error) => {
        callback(error);
    });
}

app.get('/api/file-proxy', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        console.log('📥 Прокси загрузка файла с редиректами:', url);

        followRedirects(url, 5, (error, fileRes) => {
            if (error) {
                console.error('❌ Ошибка загрузки файла:', error);
                res.status(500).json({
                    error: 'File download error',
                    message: error.message
                });
                return;
            }

            res.setHeader('Content-Type', fileRes.headers['content-type'] || 'application/octet-stream');
            res.setHeader('Content-Length', fileRes.headers['content-length'] || '');
            res.setHeader('Content-Disposition', fileRes.headers['content-disposition'] || 'attachment');

            console.log(`✅ Файл загружен, размер: ${fileRes.headers['content-length']} байт`);

            fileRes.pipe(res);

            fileRes.on('error', (pipeError) => {
                console.error('❌ Ошибка передачи данных:', pipeError);
                res.status(500).json({
                    error: 'Stream error',
                    message: pipeError.message
                });
            });
        });

    } catch (error) {
        console.error('❌ Ошибка загрузки файла:', error);
        res.status(500).json({
            error: 'File download error',
            message: error.message
        });
    }
});

app.get('/api/simple-file-proxy', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        console.log('📥 Простая загрузка файла:', url);

        const response = await fetch(url, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'VyatSU-Diary-App/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', response.headers.get('content-disposition') || 'attachment');

        console.log(`✅ Файл загружен, размер: ${buffer.length} байт`);

        res.send(buffer);

    } catch (error) {
        console.error('❌ Ошибка загрузки файла:', error);
        res.status(500).json({
            error: 'File download error',
            message: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Proxy server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Прокси сервер запущен на http://localhost:${PORT}`);
    console.log('✅ Поддержка редиректов включена');
});