'use strict';

const path = require('path');
const express = require('express');
const { analyze, AnalyzeError, MAX_BASICS } = require('./lib/analyze');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 供前端读取的限制常量
app.get('/api/config', (req, res) => {
  res.json({ maxBasics: MAX_BASICS });
});

app.post('/api/analyze', (req, res) => {
  try {
    const combinations = analyze(req.body);
    res.json({ ok: true, combinations });
  } catch (err) {
    if (err instanceof AnalyzeError) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    console.error(err);
    res.status(500).json({ ok: false, error: '服务器内部错误' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`故障树分析服务已启动: http://localhost:${PORT}`);
});
