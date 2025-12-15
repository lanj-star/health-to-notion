import express from 'express';
import webhookHandler from './api/notion-webhook.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 解析JSON请求体
app.use(express.json());

// 设置API路由，与原始设计保持一致
app.post('/api/notion-webhook', webhookHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/notion-webhook`);
});