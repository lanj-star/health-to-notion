// 导入必要的库
import { Client } from '@notionhq/client';

// 初始化Notion客户端，密钥从环境变量读取（Vercel提供）
const notion = new Client({ auth: process.env.NOTION_TOKEN });
// 你的Notion数据库ID
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(request, response) {
  // 1. 只处理POST请求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 🔐 安全验证：检查URL中的令牌
  const urlToken = request.query.token;
  if (urlToken !== process.env.SECRET_TOKEN) {
    console.error('Invalid token received:', urlToken);
    return response.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    // 3. 解析请求数据
    const { date, steps, heartRate, sleep } = request.body;

    // 4. 调用Notion API创建记录（使用英文属性名）
    const notionResponse = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Date': {
          type: 'date',
          date: { start: date }
        },
        'Steps': {
          type: 'number',
          number: steps ? parseInt(steps) : null
        },
        'Heart Rate': {
          type: 'number',
          number: heartRate ? parseFloat(heartRate) : null
        },
        'Sleep Duration': {
          type: 'number',
          number: sleep ? parseFloat(sleep) : null
        }
      }
    });

    // 5. 返回成功响应
    console.log('Success:', notionResponse);
    return response.status(200).json({ success: true, id: notionResponse.id });

  } catch (error) {
    // 6. 错误处理
    console.error('Error:', error);
    return response.status(500).json({ error: 'Failed to write to Notion', detail: error.message });
  }
}