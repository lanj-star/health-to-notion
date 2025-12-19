// 导入共享中间件
import { notion, securityMiddleware } from './middleware.js';

// 第一个Notion数据库ID（用于原始的webhook数据）
const databaseId = process.env.NOTION_HEALTH_DATABASE_ID;

// 实际的处理函数
async function handleWebhookRequest(request, response, clientIP) {
  try {
    // 解析请求数据
    const { metadata, body, fitness_detail, sleep_analyais, vitals, daily_summary } = request.body;
    
    // 验证必要的复杂格式结构
    if (!metadata || !metadata.date) {
      console.log(`[${clientIP}] Invalid data format: missing metadata.date`);
      return response.status(400).json({ error: 'Invalid data format: missing metadata.date' });
    }

    // 处理日期，生成标题格式：2025-12-18记录
    const dateStr = metadata.date.split('T')[0]; // 提取YYYY-MM-DD部分
    const pageTitle = `${dateStr}记录`; // 生成标题

    // 调用Notion API创建记录（使用英文属性名）
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

    // 返回成功响应
    console.log(`[${clientIP}] Success: Created Notion page with ID ${notionResponse.id}, title: ${pageTitle}`);
    return response.status(200).json({ success: true, id: notionResponse.id, title: pageTitle });

  } catch (error) {
    // 错误处理
    console.error(`[${clientIP}] Error:`, error);
    return response.status(500).json({ error: 'Failed to write to Notion', detail: error.message });
  }
}

// 使用安全中间件包装处理函数
export default securityMiddleware(handleWebhookRequest);