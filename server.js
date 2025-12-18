import express from 'express';
import webhookHandler from './api/notion-webhook.js';
import * as dotenv from 'dotenv';

// 本地开发时加载.env.local文件
// Vercel部署时会自动忽略，使用Vercel控制台配置的环境变量
dotenv.config({ path: '.env.local' });

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
  
  // 验证环境变量是否加载成功（仅用于调试）
  console.log('Environment variables loaded:');
  console.log('NOTION_TOKEN:', process.env.NOTION_TOKEN ? '✓' : '✗');
  console.log('NOTION_DATABASE_ID:', process.env.NOTION_DATABASE_ID ? '✓' : '✗');
  console.log('SECRET_TOKEN:', process.env.SECRET_TOKEN ? '✓' : '✗');
});