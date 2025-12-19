// 导入共享中间件
import { notion, securityMiddleware } from './middleware.js';

// 第二个Notion数据库ID
const databaseId = process.env.NOTION_WORKOUT_DATABASE_ID;

// 实际的处理函数
async function handleHealthAutoExportRequest(request, response, clientIP) {
  try {
    // 解析请求数据
    const { data } = request.body;
    
    // 验证必要的数据结构
    if (!data || !Array.isArray(data.workouts)) {
      console.log(`[${clientIP}] Invalid data format: missing data.workouts array`);
      return response.status(400).json({ error: 'Invalid data format: missing data.workouts array' });
    }

    // 处理每个健身记录
    const results = [];
    for (const workout of data.workouts) {
      // 验证单个健身记录的必要字段
      if (!workout.id || !workout.start) {
        console.log(`[${clientIP}] Skipping workout: missing id or start time`);
        continue;
      }

      // 格式化日期
      const startDate = new Date(workout.start);
      const formattedDate = startDate.toISOString();
      const dateStr = formattedDate.split('T')[0];
      const timeStr = formattedDate.split('T')[1].split('.')[0];
      const pageTitle = `${dateStr} ${workout.name} ${timeStr}`;

      // 调用Notion API创建记录
      const notionResponse = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          // 标题字段
          '名称': {
            type: 'title',
            title: [{ text: { content: pageTitle } }]
          },
          
          // 基础信息
          '日期': {
            type: 'date',
            date: { start: formattedDate }
          },
          '运动类型': {
            type: 'rich_text',
            rich_text: [{ text: { content: workout.name || '' } }]
          },
          '位置': {
            type: 'rich_text',
            rich_text: [{ text: { content: workout.location || '' } }]
          },
          '持续时间(分钟)': {
            type: 'number',
            number: workout.duration ? parseFloat(workout.duration) / 60 : null
          },
          
          // 健身数据
          '步数': {
            type: 'number',
            number: workout.stepCount && workout.stepCount.length > 0 ? parseInt(workout.stepCount[0].qty) : null
          },
          '活动能量(kcal)': {
            type: 'number',
            number: workout.activeEnergy && workout.activeEnergy.length > 0 ? parseFloat(workout.activeEnergy[0].qty) : null
          },
          '消耗的活动能量(kJ)': {
            type: 'number',
            number: workout.activeEnergyBurned ? parseFloat(workout.activeEnergyBurned.qty) : null
          },
          
          // 环境数据
          '温度(°C)': {
            type: 'number',
            number: workout.temperature ? parseFloat(workout.temperature.qty) : null
          },
          '湿度(%)': {
            type: 'number',
            number: workout.humidity ? parseFloat(workout.humidity.qty) : null
          },
          
          // 心率数据
          '平均心率': {
            type: 'number',
            number: workout.heartRateData && workout.heartRateData.length > 0 ? parseFloat(workout.heartRateData[0].Avg) : null
          },
          '最大心率': {
            type: 'number',
            number: workout.heartRateData && workout.heartRateData.length > 0 ? parseInt(workout.heartRateData[0].Max) : null
          },
          '最小心率': {
            type: 'number',
            number: workout.heartRateData && workout.heartRateData.length > 0 ? parseInt(workout.heartRateData[0].Min) : null
          },
          
          // 强度数据
          '强度(kcal/hr·kg)': {
            type: 'number',
            number: workout.intensity ? parseFloat(workout.intensity.qty) : null
          },
          
          // 唯一标识
          'Workout ID': {
            type: 'rich_text',
            rich_text: [{ text: { content: workout.id || '' } }]
          }
        }
      });

      results.push({
        id: notionResponse.id,
        title: pageTitle,
        workoutId: workout.id
      });
    }

    // 返回成功响应
    console.log(`[${clientIP}] Success: Created ${results.length} Notion pages from HealthAutoExport data`);
    return response.status(200).json({ 
      success: true, 
      count: results.length, 
      results: results 
    });

  } catch (error) {
    // 错误处理
    console.error(`[${clientIP}] Error:`, error);
    return response.status(500).json({ error: 'Failed to write to Notion', detail: error.message });
  }
}

// 使用安全中间件包装处理函数
export default securityMiddleware(handleHealthAutoExportRequest);