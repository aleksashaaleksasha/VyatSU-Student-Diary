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

        console.log('Proxy request to:', url.substring(0, 100) + '...');

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
                    console.error('JSON parsing error:', parseError);
                    res.status(500).json({ error: 'JSON parse error' });
                }
            });

        }).on('error', (error) => {
            console.error('Proxy error:', error);
            res.status(500).json({
                error: 'Proxy error',
                message: error.message
            });
        });

    } catch (error) {
        console.error('Proxy error:', error);
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
            console.log(`Redirect ${response.statusCode} -> ${response.headers.location}`);
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

        console.log('Proxy file download with redirects:', url);

        followRedirects(url, 5, (error, fileRes) => {
            if (error) {
                console.error('File download error:', error);
                res.status(500).json({
                    error: 'File download error',
                    message: error.message
                });
                return;
            }

            res.setHeader('Content-Type', fileRes.headers['content-type'] || 'application/octet-stream');
            res.setHeader('Content-Length', fileRes.headers['content-length'] || '');
            res.setHeader('Content-Disposition', fileRes.headers['content-disposition'] || 'attachment');

            console.log(`File loaded, size: ${fileRes.headers['content-length']} bytes`);

            fileRes.pipe(res);

            fileRes.on('error', (pipeError) => {
                console.error('Data transfer error:', pipeError);
                res.status(500).json({
                    error: 'Stream error',
                    message: pipeError.message
                });
            });
        });

    } catch (error) {
        console.error('File download error:', error);
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

        console.log('Simple file download:', url);

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

        console.log(`File loaded, size: ${buffer.length} bytes`);

        res.send(buffer);

    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({
            error: 'File download error',
            message: error.message
        });
    }
});

app.post('/api/validate/schedule', async (req, res) => {
    try {
        const { group, date, subject, time, teacher } = req.body;
        const errors = [];

        console.log(' Validating schedule data:', { group, date, subject, time, teacher });

        if (!group) {
            errors.push('Group is required');
        } else if (!/^[А-Я]{2,}к?-\d{3}-\d{2}-\d{2}$/.test(group)) {
            errors.push('Invalid group format. Example: ИСПк-104-52-00');
        }

        if (!date) {
            errors.push('Date is required');
        } else if (isNaN(new Date(date).getTime())) {
            errors.push('Invalid date format');
        } else {
            const scheduleDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (scheduleDate < today) {
                errors.push('Date cannot be in the past');
            }
        }

        if (!subject) {
            errors.push('Subject is required');
        } else if (subject.length < 2) {
            errors.push('Subject name is too short (min 2 characters)');
        } else if (subject.length > 100) {
            errors.push('Subject name is too long (max 100 characters)');
        }

        if (time && !time.includes('-')) {
            errors.push('Invalid time format. Example: 9:00-10:30');
        }

        if (teacher && teacher.length > 50) {
            errors.push('Teacher name is too long (max 50 characters)');
        }

        if (errors.length > 0) {
            console.log('   Validation errors:', errors);
            return res.status(400).json({
                success: false,
                errors: errors
            });
        }

        console.log('   Data validation passed');
        res.json({
            success: true,
            message: 'Data validation passed successfully'
        });

    } catch (error) {
        console.error('   Server validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during validation'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Proxy server is running' });
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log('Redirect support enabled');
});