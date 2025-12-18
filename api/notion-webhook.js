// 导入必要的库
import { Client } from '@notionhq/client';

// 初始化Notion客户端，密钥从环境变量读取（Vercel提供）
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 你的Notion数据库ID
const databaseId = process.env.NOTION_DATABASE_ID;

// 获取客户端IP地址的辅助函数（支持代理环境）
function getClientIP(request) {
  // 优先检查代理头（如果使用了Nginx、Cloudflare等代理）
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for格式通常为：client, proxy1, proxy2
    return forwardedFor.split(',')[0].trim();
  }
  
  // 检查X-Real-IP头（另一种常用的代理IP头）
  const realIP = request.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  // 直接从request获取（适用于没有代理的情况）
  return request.socket?.remoteAddress || 'Unknown';
}

export default async function handler(request, response) {
  // 获取客户端IP地址
  const clientIP = getClientIP(request);
  
  // 记录收到请求
  console.log(`[${clientIP}] Received request: ${request.method} ${request.url}`);
  
  // 1. 只处理POST请求
  if (request.method !== 'POST') {
    console.log(`[${clientIP}] Method not allowed: ${request.method}`);
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 🔐 安全验证：检查URL中的令牌
  const urlToken = request.query.token;
  if (urlToken !== process.env.SECRET_TOKEN) {
    console.error(`[${clientIP}] Invalid token received: ${urlToken}`);
    return response.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    // 3. 解析请求数据 - 仅支持example.json中的复杂嵌套格式
    const { metadata, body, fitness_detail, sleep_analyais, vitals, daily_summary } = request.body;
    
    // 验证必要的复杂格式结构
    if (!metadata || !metadata.date) {
      console.log(`[${clientIP}] Invalid data format: missing metadata.date`);
      return response.status(400).json({ error: 'Invalid data format: missing metadata.date' });
    }

    // 处理日期，生成标题格式：2025-12-18记录
    const dateStr = metadata.date.split('T')[0]; // 提取YYYY-MM-DD部分
    const pageTitle = `${dateStr}记录`; // 生成标题

    // 4. 调用Notion API创建记录（使用英文属性名）
    const notionResponse = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        // 添加默认标题字段（Notion默认使用"Name"作为标题字段名）
        '名称': {
          type: 'title',
          title: [{ text: { content: pageTitle } }]
        },
        
        // 基础信息
        'Date': {
          type: 'date',
          date: { start: metadata.date }
        },
        'Device': {
          type: 'rich_text',
          rich_text: [{ text: { content: metadata.device_name || '' } }]
        },
        
        // 身体数据
        'Height': {
          type: 'number',
          number: body?.height ? parseFloat(body.height) : null
        },
        'Weight': {
          type: 'number',
          number: body?.weight ? parseFloat(body.weight) : null
        },
        
        // 健身数据
        'Steps': {
          type: 'number',
          number: daily_summary?.steps ? parseInt(daily_summary.steps) : null
        },
        'Distance Walking Running': {
          type: 'number',
          number: daily_summary?.distance_walking_running ? parseFloat(daily_summary.distance_walking_running) : null
        },
        'Active Energy': {
          type: 'number',
          number: daily_summary?.active_energy_kcal ? parseFloat(daily_summary.active_energy_kcal) : null
        },
        'Exercise Minutes': {
          type: 'number',
          number: daily_summary?.exercise_minutes ? parseInt(daily_summary.exercise_minutes) : null
        },
        'Stand Hours': {
          type: 'number',
          number: daily_summary?.stand_hours ? parseInt(daily_summary.stand_hours) : null
        },
        
        // 睡眠数据
        'Sleep Duration': {
          type: 'number',
          number: sleep_analyais?.total_hours ? parseFloat(sleep_analyais.total_hours) : null
        },
        'Deep Sleep': {
          type: 'number',
          number: sleep_analyais?.deep_sleep_min ? parseInt(sleep_analyais.deep_sleep_min) : null
        },
        'REM Sleep': {
          type: 'number',
          number: sleep_analyais?.rem_sleep_min ? parseInt(sleep_analyais.rem_sleep_min) : null
        },
        'Core Sleep': {
          type: 'number',
          number: sleep_analyais?.core_sleep_min ? parseInt(sleep_analyais.core_sleep_min) : null
        },
        'Awake Time': {
          type: 'number',
          number: sleep_analyais?.awake_time_min ? parseInt(sleep_analyais.awake_time_min) : null
        },
        
        // 生命体征数据
        'Resting Heart Rate': {
          type: 'number',
          number: vitals?.resting_heart_rate ? parseFloat(vitals.resting_heart_rate) : null
        },
        'Max Heart Rate': {
          type: 'number',
          number: vitals?.max_hr_today ? parseInt(vitals.max_hr_today) : null
        },
        'HRV': {
          type: 'number',
          number: vitals?.hrv_ms ? parseFloat(vitals.hrv_ms) : null
        },
        'Respiratory Rate': {
          type: 'number',
          number: vitals?.respiratory_rate ? parseFloat(vitals.respiratory_rate) : null
        },
        'Blood Oxygen': {
          type: 'number',
          number: vitals?.blood_oxygen_avg ? parseFloat(vitals.blood_oxygen_avg) : null
        },
        
        // 健身详情数据
        'Avg Walking Speed': {
          type: 'number',
          number: fitness_detail?.avg_walking_speed ? parseFloat(fitness_detail.avg_walking_speed) : null
        },
        'Avg Running Speed': {
          type: 'number',
          number: fitness_detail?.avg_running_speed ? parseFloat(fitness_detail.avg_running_speed) : null
        },
        'Walking Steadiness': {
          type: 'number',
          number: fitness_detail?.walking_steadiness ? parseFloat(fitness_detail.walking_steadiness) : null
        },
        'Cycling Distance': {
          type: 'number',
          number: fitness_detail?.cycling_distance ? parseFloat(fitness_detail.cycling_distance) : null
        }
      }
    });

    // 5. 返回成功响应
    console.log(`[${clientIP}] Success: Created Notion page with ID ${notionResponse.id}, title: ${pageTitle}`);
    return response.status(200).json({ success: true, id: notionResponse.id, title: pageTitle });

  } catch (error) {
    // 6. 错误处理
    console.error(`[${clientIP}] Error:`, error);
    return response.status(500).json({ error: 'Failed to write to Notion', detail: error.message });
  }
}