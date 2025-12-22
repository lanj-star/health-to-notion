// 导入共享中间件
import { notion, findRecordByDate } from "./middleware.js";

// 习惯追踪数据库ID
const habitTraceDatabaseId = process.env.NOTION_HABBIT_TRACE_DATABASE_ID;

// 生成每日建议的函数
function generateDailyAdvice(sleepScore, dailySummary) {
  const advice = [];

  // 睡眠建议
  if (sleepScore && sleepScore.score !== null) {
    if (sleepScore.score >= 80) {
      advice.push("✅ 睡眠质量很好，请继续保持规律作息！");
    } else if (sleepScore.score >= 60) {
      advice.push("⚠️ 睡眠质量一般，建议改善睡前习惯，避免使用电子设备。");
    } else {
      advice.push("❌ 睡眠质量较差，建议调整作息时间，创造更好的睡眠环境。");
    }
  }

  // 运动建议
  if (dailySummary) {
    const {
      steps = 0,
      exercise_minutes = 0,
      active_energy_kcal = 0,
    } = dailySummary;

    if (steps < 8000) {
      advice.push("⚠️ 步数较少，建议增加日常活动，多走路爬楼梯。");
    } else if (steps >= 10000) {
      advice.push("✅ 步数达标，继续保持活跃的生活方式！");
    }

    if (exercise_minutes < 30) {
      advice.push("⚠️ 运动时间不足，建议每天至少进行30分钟中等强度运动。");
    } else {
      advice.push("✅ 运动时间充足，有助于身体健康！");
    }
  }

  // 综合建议
  if (advice.length === 0) {
    advice.push("✅ 今日各项指标表现良好，请继续保持！");
  }

  return advice.join("\n");
}

// 生成当日总结的函数
function generateDailySummary(sleepScore, dailySummary) {
  const summaries = [];

  // 睡眠总结
  if (sleepScore && sleepScore.score !== null) {
    summaries.push(`睡眠评分: ${sleepScore.score}/100 (${sleepScore.rating})`);
  } else {
    summaries.push("睡眠评分: 无数据");
  }

  // 运动总结
  if (dailySummary) {
    const {
      steps = 0,
      exercise_minutes = 0,
      active_energy_kcal = 0,
    } = dailySummary;

    summaries.push(`步数: ${steps}步`);
    summaries.push(`运动时长: ${exercise_minutes}分钟`);
    summaries.push(`消耗能量: ${active_energy_kcal}kcal`);
  } else {
    summaries.push("运动数据: 无数据");
  }

  return summaries.join(" | ");
}

// 更新习惯追踪记录（内部使用）
async function updateHabitRecord(recordId, properties, dateStr, clientIP) {
  try {
    let notionResponse;

    if (recordId) {
      notionResponse = await notion.pages.update({
        page_id: recordId,
        properties: properties,
      });
      console.log(
        `[${clientIP}] Updated habit trace record for ${dateStr} with ID ${recordId}`
      );
    } else {
      notionResponse = await notion.pages.create({
        parent: { database_id: habitTraceDatabaseId },
        properties: properties,
      });
      console.log(
        `[${clientIP}] Created habit trace record for ${dateStr} with ID ${notionResponse.id}`
      );
    }

    return notionResponse;
  } catch (error) {
    console.error(`[${clientIP}] Error updating habit trace record:`, error);
    throw error;
  }
}
// 更新睡眠记录（对外暴露）
export async function updateSleepRecord(dateStr, sleepScore, clientIP) {
  try {
    // 查找现有记录 - 使用公共函数
    const existingRecord = await findRecordByDate(
      habitTraceDatabaseId,
      dateStr,
      clientIP,
      "habit"
    );

    // 适配传入的参数类型
    let score = null;
    let rating = "无数据";

    // 如果传入的是完整对象，直接使用其中的属性
    if (typeof sleepScore === "object" && sleepScore !== null) {
      score = sleepScore.score;
      rating = sleepScore.rating || "未知";
    }
    // 保持向后兼容，如果传入的是数字
    else if (typeof sleepScore === "number") {
      score = sleepScore;
      // 原有的评分逻辑作为备用
      if (score !== null) {
        if (score >= 80) rating = "优秀";
        else if (score >= 60) rating = "良好";
        else if (score >= 40) rating = "一般";
        else rating = "较差";
      }
    }

    // 生成当前总结和建议
    const summaryText = generateDailySummary(
      { score: score, rating: rating },
      null
    );
    const adviceText = generateDailyAdvice(
      { score: score, rating: rating },
      null
    );

    // 准备属性数据 - 只包含数据库中确定存在的字段
    const properties = {
      // 标题字段（如果是新记录）
      ...(!existingRecord && {
        名称: {
          type: "title",
          title: [{ text: { content: `${dateStr}打卡` } }],
        },
        Date: {
          type: "date",
          date: { start: `${dateStr}` },
        },
      }),

      // 睡眠数据 - 只保留确定存在的字段
      "睡眠评分(100分制)": {
        type: "number",
        number: score || null,
      },
      睡眠质量评级: {
        type: "rich_text",
        rich_text: [{ text: { content: rating } }],
      },

      // 更新综合数据
      当日总结: {
        type: "rich_text",
        rich_text: [{ text: { content: summaryText } }],
      },
      健康建议: {
        type: "rich_text",
        rich_text: [{ text: { content: adviceText } }],
      },
    };

    // 移除尝试添加不存在字段的代码，避免Notion API验证错误

    return updateHabitRecord(existingRecord?.id, properties, dateStr, clientIP);
  } catch (error) {
    console.error(`[${clientIP}] Error updating sleep record:`, error);
    throw error;
  }
}

// 更新体能训练记录（对外暴露）
export async function updateWorkoutSummaryRecord(
  dateStr,
  dailySummary,
  clientIP
) {
  try {
    // 查找现有记录 - 使用公共函数
    const existingRecord = await findRecordByDate(
      habitTraceDatabaseId,
      dateStr,
      clientIP,
      "habit"
    );

    // 生成当前总结和建议（需要获取现有睡眠数据）
    let currentSleepData = null;
    if (existingRecord && existingRecord.properties) {
      currentSleepData = {
        score: existingRecord.properties["睡眠评分(100分制)"]?.number || null,
        rating:
          existingRecord.properties["睡眠质量评级"]?.rich_text[0]?.text
            ?.content || "无数据",
      };
    }

    const summaryText = generateDailySummary(currentSleepData, dailySummary);
    const adviceText = generateDailyAdvice(currentSleepData, dailySummary);

    // 准备健康相关属性
    const properties = {
      // 标题字段（如果是新记录）
      ...(!existingRecord && {
        名称: {
          type: "title",
          title: [{ text: { content: `${dateStr}打卡` } }],
        },
        Date: {
          type: "date",
          date: { start: `${dateStr}` },
        },
      }),

      // 运动数据
      步数: {
        type: "number",
        number: dailySummary?.steps || 0,
      },
      "运动时长(分钟)": {
        type: "number",
        number: dailySummary?.exercise_minutes || 0,
      },
      "消耗能量(kcal)": {
        type: "number",
        number: dailySummary?.active_energy_kcal || 0,
      },

      // 新增达标情况字段（如果存在）
      ...(dailySummary?.steps_goal_met !== undefined && {
        步数目标达成: {
          type: "checkbox",
          checkbox: dailySummary.steps_goal_met,
        },
      }),
      ...(dailySummary?.exercise_minutes_goal_met !== undefined && {
        运动时长目标达成: {
          type: "checkbox",
          checkbox: dailySummary.exercise_minutes_goal_met,
        },
      }),
      ...(dailySummary?.active_energy_goal_met !== undefined && {
        活动能量目标达成: {
          type: "checkbox",
          checkbox: dailySummary.active_energy_goal_met,
        },
      }),
      ...(dailySummary?.workout_count_goal_met !== undefined && {
        训练次数目标达成: {
          type: "checkbox",
          checkbox: dailySummary.workout_count_goal_met,
        },
      }),
      ...(dailySummary?.all_goals_met !== undefined && {
        今日运动是否达标: {
          type: "checkbox",
          checkbox: dailySummary.all_goals_met,
        },
      }),

      // 更新综合数据
      当日总结: {
        type: "rich_text",
        rich_text: [{ text: { content: summaryText } }],
      },
      健康建议: {
        type: "rich_text",
        rich_text: [{ text: { content: adviceText } }],
      },
    };

    return updateHabitRecord(existingRecord?.id, properties, dateStr, clientIP);
  } catch (error) {
    console.error(
      `[${clientIP}] Error updating workout summary record:`,
      error
    );
    throw error;
  }
}
