// 导入共享中间件
import { notion, securityMiddleware, findRecordByDate } from "./middleware.js";

// 健康数据库ID
const databaseId = process.env.NOTION_HEALTH_DATABASE_ID;

// 习惯追踪数据库ID
const habitDatabaseId = process.env.NOTION_HABBIT_TRACE_DATABASE_ID;

// 计算睡眠评分
function calculateSleepScore(sleepData) {
  if (!sleepData || !sleepData.total_hours) {
    return { score: null, rating: "无数据", breakdown: {} };
  }

  // 关键：确定实际睡眠时长
  const totalMinutesInBed = sleepData.total_hours * 60;
  const awakeMinutes = sleepData.awake_time_min || 0;

  // 实际睡眠时长（分钟）
  const actualSleepMinutes = totalMinutesInBed - awakeMinutes;
  const actualSleepHours = actualSleepMinutes / 60;

  // 转换所有时间为分钟以便计算
  const deepSleepMinutes = sleepData.deep_sleep_min || 0;
  const remSleepMinutes = sleepData.rem_sleep_min || 0;

  // 评分标准
  const scoreBreakdown = {
    duration: 0, // 睡眠时长（30分）- 使用实际睡眠时长
    deepSleep: 0, // 深度睡眠比例（25分）
    remSleep: 0, // REM睡眠比例（25分）
    awakeTime: 0, // 清醒时间比例（10分）
    efficiency: 0, // 睡眠效率（10分）
  };

  // 1. 睡眠时长评分（30分）- 使用实际睡眠时长
  if (actualSleepHours >= 7 && actualSleepHours <= 9) {
    scoreBreakdown.duration = 30; // 最佳睡眠时长
  } else if (
    (actualSleepHours >= 6 && actualSleepHours < 7) ||
    (actualSleepHours > 9 && actualSleepHours <= 10)
  ) {
    scoreBreakdown.duration = 20; // 良好
  } else if (
    (actualSleepHours >= 5 && actualSleepHours < 6) ||
    (actualSleepHours > 10 && actualSleepHours <= 11)
  ) {
    scoreBreakdown.duration = 10; // 一般
  } else {
    scoreBreakdown.duration = 0; // 不佳
  }

  // 2. 深度睡眠比例评分（25分）- 基于实际睡眠时长
  const deepSleepRatio =
    actualSleepMinutes > 0 ? (deepSleepMinutes / actualSleepMinutes) * 100 : 0;
  if (deepSleepRatio >= 15 && deepSleepRatio <= 25) {
    scoreBreakdown.deepSleep = 25; // 最佳比例15-25%
  } else if (
    (deepSleepRatio >= 10 && deepSleepRatio < 15) ||
    (deepSleepRatio > 25 && deepSleepRatio <= 30)
  ) {
    scoreBreakdown.deepSleep = 15; // 良好
  } else if (
    (deepSleepRatio >= 5 && deepSleepRatio < 10) ||
    (deepSleepRatio > 30 && deepSleepRatio <= 35)
  ) {
    scoreBreakdown.deepSleep = 5; // 一般
  } else {
    scoreBreakdown.deepSleep = 0; // 不佳
  }

  // 3. REM睡眠比例评分（25分）- 基于实际睡眠时长
  const remSleepRatio =
    actualSleepMinutes > 0 ? (remSleepMinutes / actualSleepMinutes) * 100 : 0;
  if (remSleepRatio >= 20 && remSleepRatio <= 25) {
    scoreBreakdown.remSleep = 25; // 最佳比例20-25%
  } else if (
    (remSleepRatio >= 15 && remSleepRatio < 20) ||
    (remSleepRatio > 25 && remSleepRatio <= 30)
  ) {
    scoreBreakdown.remSleep = 15; // 良好
  } else if (
    (remSleepRatio >= 10 && remSleepRatio < 15) ||
    (remSleepRatio > 30 && remSleepRatio <= 35)
  ) {
    scoreBreakdown.remSleep = 5; // 一般
  } else {
    scoreBreakdown.remSleep = 0; // 不佳
  }

  // 4. 清醒时间比例评分（10分）- 基于卧床总时间
  const awakeTimeRatio =
    totalMinutesInBed > 0 ? (awakeMinutes / totalMinutesInBed) * 100 : 0;
  if (awakeTimeRatio < 5) {
    scoreBreakdown.awakeTime = 10; // 清醒时间<5%
  } else if (awakeTimeRatio >= 5 && awakeTimeRatio <= 10) {
    scoreBreakdown.awakeTime = 5; // 清醒时间5-10%
  } else {
    scoreBreakdown.awakeTime = 0; // 清醒时间>10%
  }

  // 5. 睡眠效率评分（10分）
  const sleepEfficiency =
    totalMinutesInBed > 0 ? (actualSleepMinutes / totalMinutesInBed) * 100 : 0;
  if (sleepEfficiency > 90) {
    scoreBreakdown.efficiency = 10; // 睡眠效率>90%
  } else if (sleepEfficiency >= 85 && sleepEfficiency <= 90) {
    scoreBreakdown.efficiency = 5; // 睡眠效率85-90%
  } else {
    scoreBreakdown.efficiency = 0; // 睡眠效率<85%
  }

  // 计算总分
  const totalScore = Object.values(scoreBreakdown).reduce(
    (sum, value) => sum + value,
    0
  );

  // 评分等级
  let rating = "未知";
  if (totalScore >= 90) {
    rating = "优秀";
  } else if (totalScore >= 80) {
    rating = "良好";
  } else if (totalScore >= 60) {
    rating = "一般";
  } else if (totalScore >= 0) {
    rating = "不佳";
  }

  return {
    score: totalScore,
    rating: rating,
    breakdown: scoreBreakdown,
    ratios: {
      deepSleep: deepSleepRatio.toFixed(1),
      remSleep: remSleepRatio.toFixed(1),
      awakeTime: awakeTimeRatio.toFixed(1),
      efficiency: sleepEfficiency.toFixed(1),
    },
    actualSleepHours: actualSleepHours.toFixed(1), // 新增：显示实际睡眠时长
  };
}

// 计算运动是否达标
function calculateExerciseStatus(dailySummary) {
  if (!dailySummary) {
    return { isAchieved: null, status: "无数据", breakdown: {} };
  }

  // 运动目标设置
  const targets = {
    steps: 10000, // 步数目标
    exerciseMinutes: 30, // 锻炼分钟数目标
    activeEnergy: 300, // 活动能量目标（kcal）
  };

  // 计算各指标是否达标（达到目标的80%以上为达标）
  const stepsAchieved = dailySummary.steps
    ? parseInt(dailySummary.steps) >= targets.steps * 0.8
    : false;
  const exerciseMinutesAchieved = dailySummary.exercise_minutes
    ? parseInt(dailySummary.exercise_minutes) >= targets.exerciseMinutes * 0.8
    : false;
  const activeEnergyAchieved = dailySummary.active_energy_kcal
    ? parseFloat(dailySummary.active_energy_kcal) >= targets.activeEnergy * 0.8
    : false;

  // 统计达标数量
  const achievedCount = [
    stepsAchieved,
    exerciseMinutesAchieved,
    activeEnergyAchieved,
  ].filter(Boolean).length;

  // 整体是否达标（至少两项达标为整体达标）
  const isAchieved = achievedCount >= 2;

  // 状态描述
  const status = isAchieved ? "达标" : "未达标";

  return {
    isAchieved: isAchieved,
    status: status,
    breakdown: {
      steps: {
        actual: dailySummary.steps ? parseInt(dailySummary.steps) : 0,
        target: targets.steps,
        achieved: stepsAchieved,
      },
      exerciseMinutes: {
        actual: dailySummary.exercise_minutes
          ? parseInt(dailySummary.exercise_minutes)
          : 0,
        target: targets.exerciseMinutes,
        achieved: exerciseMinutesAchieved,
      },
      activeEnergy: {
        actual: dailySummary.active_energy_kcal
          ? parseFloat(dailySummary.active_energy_kcal)
          : 0,
        target: targets.activeEnergy,
        achieved: activeEnergyAchieved,
      },
    },
  };
}

// 更新习惯追踪数据库中的记录（同步睡眠评分和运动是否达标）
async function updateHabitRecord(
  dateStr,
  sleepScore,
  exerciseStatus,
  clientIP
) {
  try {
    // 检查是否已存在记录
    const existingRecord = await findRecordByDate(
      habitDatabaseId,
      dateStr,
      clientIP,
      "habit"
    );

    // 准备属性
    const properties = {
      // 睡眠相关属性
      睡眠评分: {
        type: "number",
        number: sleepScore.score,
      },
      睡眠质量评级: {
        type: "rich_text",
        rich_text: [{ text: { content: sleepScore.rating } }],
      },
      // 运动相关属性
      运动是否达标: {
        type: "rich_text",
        rich_text: [{ text: { content: exerciseStatus.status } }],
      },
    };

    if (existingRecord) {
      // 更新现有记录
      await notion.pages.update({
        page_id: existingRecord.id,
        properties: properties,
      });
      console.log(`[${clientIP}] Updated habit record for date: ${dateStr}`);
    } else {
      // 创建新记录
      await notion.pages.create({
        parent: { database_id: habitDatabaseId },
        properties: {
          // 添加默认标题字段，格式为YYYY-mm-dd打卡
          名称: {
            type: "title",
            title: [{ text: { content: `${dateStr}打卡` } }],
          },
          Date: {
            type: "date",
            date: { start: dateStr },
          },
          ...properties,
        },
      });
      console.log(
        `[${clientIP}] Created new habit record for date: ${dateStr}`
      );
    }
  } catch (error) {
    console.error(`[${clientIP}] Error updating habit record:`, error);
    throw error;
  }
}

// 实际的处理函数
async function handleHealthRequest(request, response, clientIP) {
  try {
    // 解析请求数据
    const {
      metadata,
      body,
      fitness_detail,
      sleep_analyais,
      vitals,
      daily_summary,
    } = request.body;

    // 验证必要的复杂格式结构
    if (!metadata || !metadata.date) {
      console.log(`[${clientIP}] Invalid data format: missing metadata.date`);
      return response
        .status(400)
        .json({ error: "Invalid data format: missing metadata.date" });
    }

    // 处理日期，生成标题格式：2025-12-18记录
    const dateStr = metadata.date.split("T")[0]; // 提取YYYY-MM-DD部分
    const pageTitle = `${dateStr}记录`; // 生成标题

    // 计算睡眠评分
    const sleepScore = calculateSleepScore(sleep_analyais);

    // 计算运动是否达标
    const exerciseStatus = calculateExerciseStatus(daily_summary);

    // 调用Notion API创建记录（使用英文属性名）
    const notionResponse = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        // 添加默认标题字段（Notion默认使用"Name"作为标题字段名）
        名称: {
          type: "title",
          title: [{ text: { content: pageTitle } }],
        },

        // 基础信息
        Date: {
          type: "date",
          date: { start: metadata.date },
        },
        Device: {
          type: "rich_text",
          rich_text: [{ text: { content: metadata.device_name || "" } }],
        },

        // 身体数据
        "身高(cm)": {
          type: "number",
          number: body?.height ? parseFloat(body.height) : null,
        },
        "体重(kg)": {
          type: "number",
          number: body?.weight ? parseFloat(body.weight) : null,
        },

        // 健身数据
        "步数(步)": {
          type: "number",
          number: daily_summary?.steps ? parseInt(daily_summary.steps) : null,
        },
        "步行跑步距离(km)": {
          type: "number",
          number: daily_summary?.distance_walking_running
            ? parseFloat(daily_summary.distance_walking_running)
            : null,
        },
        "活动能量(kcal)": {
          type: "number",
          number: daily_summary?.active_energy_kcal
            ? parseFloat(daily_summary.active_energy_kcal)
            : null,
        },
        "锻炼分钟数(分钟)": {
          type: "number",
          number: daily_summary?.exercise_minutes
            ? parseInt(daily_summary.exercise_minutes)
            : null,
        },
        站立分钟数: {
          type: "number",
          number: daily_summary?.stand_hours
            ? parseInt(daily_summary.stand_hours)
            : null,
        },

        // 睡眠数据
        "睡眠时长(小时)": {
          type: "number",
          number: sleep_analyais?.total_hours
            ? parseFloat(sleep_analyais.total_hours)
            : null,
        },
        "深度睡眠(分钟)": {
          type: "number",
          number: sleep_analyais?.deep_sleep_min
            ? parseInt(sleep_analyais.deep_sleep_min)
            : null,
        },
        "REM睡眠(分钟)": {
          type: "number",
          number: sleep_analyais?.rem_sleep_min
            ? parseInt(sleep_analyais.rem_sleep_min)
            : null,
        },
        "核心睡眠(分钟)": {
          type: "number",
          number: sleep_analyais?.core_sleep_min
            ? parseInt(sleep_analyais.core_sleep_min)
            : null,
        },
        "清醒时间(分钟)": {
          type: "number",
          number: sleep_analyais?.awake_time_min
            ? parseInt(sleep_analyais.awake_time_min)
            : null,
        },

        // 睡眠评分（新增）
        "实际睡眠时长(小时)": {
          type: "number",
          number: sleepScore.actualSleepHours
            ? parseFloat(sleepScore.actualSleepHours)
            : null,
        },
        "睡眠评分(100分制)": {
          type: "number",
          number: sleepScore.score,
        },
        睡眠质量评级: {
          type: "rich_text",
          rich_text: [{ text: { content: sleepScore.rating } }],
        },
        "深度睡眠占比(%)": {
          type: "number",
          number: sleepScore.ratios?.deepSleep
            ? parseFloat(sleepScore.ratios.deepSleep)
            : null,
        },
        "REM睡眠占比(%)": {
          type: "number",
          number: sleepScore.ratios?.remSleep
            ? parseFloat(sleepScore.ratios.remSleep)
            : null,
        },
        "清醒时间占比(%)": {
          type: "number",
          number: sleepScore.ratios?.awakeTime
            ? parseFloat(sleepScore.ratios.awakeTime)
            : null,
        },
        "睡眠效率(%)": {
          type: "number",
          number: sleepScore.ratios?.efficiency
            ? parseFloat(sleepScore.ratios.efficiency)
            : null,
        },

        // 生命体征数据
        "静息心率(bpm)": {
          type: "number",
          number: vitals?.resting_heart_rate
            ? parseFloat(vitals.resting_heart_rate)
            : null,
        },
        "最大心率(bpm)": {
          type: "number",
          number: vitals?.max_hr_today ? parseInt(vitals.max_hr_today) : null,
        },
        "心率变异性(ms)": {
          type: "number",
          number: vitals?.hrv_ms ? parseFloat(vitals.hrv_ms) : null,
        },
        "呼吸频率(次/分钟)": {
          type: "number",
          number: vitals?.respiratory_rate
            ? parseFloat(vitals.respiratory_rate)
            : null,
        },
        "血氧饱和度(%)": {
          type: "number",
          number: vitals?.blood_oxygen_avg
            ? parseFloat(vitals.blood_oxygen_avg)
            : null,
        },

        // 健身详情数据
        "平均步行速度(km/h)": {
          type: "number",
          number: fitness_detail?.avg_walking_speed
            ? parseFloat(fitness_detail.avg_walking_speed)
            : null,
        },
        "平均跑步速度(km/h)": {
          type: "number",
          number: fitness_detail?.avg_running_speed
            ? parseFloat(fitness_detail.avg_running_speed)
            : null,
        },
        "步行稳定性(%)": {
          type: "number",
          number: fitness_detail?.walking_steadiness
            ? parseFloat(fitness_detail.walking_steadiness)
            : null,
        },
        "骑行距离(km)": {
          type: "number",
          number: fitness_detail?.cycling_distance
            ? parseFloat(fitness_detail.cycling_distance)
            : null,
        },
      },
    });

    // 更新习惯追踪数据库 - 同步睡眠评分和运动是否达标
    await updateHabitRecord(dateStr, sleepScore, exerciseStatus, clientIP);

    // 返回成功响应
    console.log(
      `[${clientIP}] Success: Created Notion page with ID ${notionResponse.id}, title: ${pageTitle}`
    );
    return response.status(200).json({
      success: true,
      id: notionResponse.id,
      title: pageTitle,
      sleepScore: sleepScore,
      exerciseStatus: exerciseStatus,
    });
  } catch (error) {
    // 错误处理
    console.error(`[${clientIP}] Error:`, error);
    return response
      .status(500)
      .json({ error: "Failed to write to Notion", detail: error.message });
  }
}

// 使用安全中间件包装处理函数
export default securityMiddleware(handleHealthRequest);
