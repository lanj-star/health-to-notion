// 导入共享中间件
import { notion, securityMiddleware, findRecordByDate } from "./middleware.js";

// 导入习惯追踪功能
import { updateWorkoutSummaryRecord } from "./habit-tracker.js";

// 数据库ID配置
const workoutDatabaseId = process.env.NOTION_WORKOUT_DATABASE_ID;
const healthDatabaseId = process.env.NOTION_HEALTH_DATABASE_ID;

// 运动目标设置（可根据个人情况调整）
const DAILY_GOALS = {
  steps: 10000, // 每日步数目标
  exerciseMinutes: 30, // 每日运动分钟数目标
  activeEnergy: 500, // 每日活动能量目标（kcal）
  workoutCount: 1, // 每日健身次数目标
};

// 更新健康记录的训练汇总数据
async function updateHealthRecordWithWorkoutSummary(
  healthRecord,
  workoutSummary,
  goalsStatus,
  clientIP
) {
  try {
    if (!healthRecord) return;

    // 更新健康记录
    await notion.pages.update({
      page_id: healthRecord.id,
      properties: {
        // 训练汇总数据
        今日训练次数: {
          type: "number",
          number: workoutSummary.workoutCount,
        },
        "今日训练总时长(分钟)": {
          type: "number",
          number: workoutSummary.totalExerciseMinutes,
        },
        今日训练总步数: {
          type: "number",
          number: workoutSummary.totalSteps,
        },
        "今日训练总能量(kcal)": {
          type: "number",
          number: workoutSummary.totalActiveEnergy,
        },

        // 运动达标情况
        步数目标达成: {
          type: "checkbox",
          checkbox: goalsStatus.isStepsGoalMet,
        },
        运动时长目标达成: {
          type: "checkbox",
          checkbox: goalsStatus.isExerciseMinutesGoalMet,
        },
        活动能量目标达成: {
          type: "checkbox",
          checkbox: goalsStatus.isActiveEnergyGoalMet,
        },
        训练次数目标达成: {
          type: "checkbox",
          checkbox: goalsStatus.isWorkoutCountGoalMet,
        },
        今日运动是否达标: {
          type: "checkbox",
          checkbox: goalsStatus.isAllGoalsMet,
        },

        // 达标状态文字描述
        达标状态: {
          type: "rich_text",
          rich_text: [
            {
              text: {
                content: goalsStatus.isAllGoalsMet
                  ? "✅ 今日运动全部达标！"
                  : "❌ 今日运动未全部达标",
              },
            },
          ],
        },
      },
    });

    console.log(
      `[${clientIP}] Updated health record ${healthRecord.id} with workout summary data`
    );
  } catch (error) {
    console.error(
      `[${clientIP}] Error updating health record with workout summary:`,
      error
    );
  }
}

// 实际的处理函数
async function handleWorkoutRequest(request, response, clientIP) {
  try {
    // 解析请求数据
    const { data } = request.body;

    // 验证必要的数据结构
    if (!data || !Array.isArray(data.workouts)) {
      console.log(
        `[${clientIP}] Invalid data format: missing data.workouts array`
      );
      return response
        .status(400)
        .json({ error: "Invalid data format: missing data.workouts array" });
    }

    // 按日期分组的训练汇总数据
    const workoutSummaryByDate = {};

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
      const dateStr = formattedDate.split("T")[0];
      const timeStr = formattedDate.split("T")[1].split(".")[0];
      const pageTitle = `${dateStr} ${workout.name} ${timeStr}`;

      // 查找同一天的健康记录 - 使用公共函数
      const healthRecord = await findRecordByDate(
        healthDatabaseId,
        dateStr,
        clientIP,
        "health"
      );

      // 准备属性数据
      const properties = {
        // 标题字段
        名称: {
          type: "title",
          title: [{ text: { content: pageTitle } }],
        },

        // 基础信息
        日期: {
          type: "date",
          date: { start: dateStr },
        },
        运动类型: {
          type: "rich_text",
          rich_text: [{ text: { content: workout.name || "" } }],
        },
        位置: {
          type: "rich_text",
          rich_text: [{ text: { content: workout.location || "" } }],
        },
        "持续时间(分钟)": {
          type: "number",
          number: workout.duration ? parseFloat(workout.duration) / 60 : null,
        },

        // 健身数据
        步数: {
          type: "number",
          number:
            workout.stepCount && workout.stepCount.length > 0
              ? parseInt(workout.stepCount[0].qty)
              : null,
        },
        "活动能量(kcal)": {
          type: "number",
          number:
            workout.activeEnergy && workout.activeEnergy.length > 0
              ? parseFloat(workout.activeEnergy[0].qty)
              : null,
        },
        "消耗的活动能量(kJ)": {
          type: "number",
          number: workout.activeEnergyBurned
            ? parseFloat(workout.activeEnergyBurned.qty)
            : null,
        },

        // 环境数据
        "温度(°C)": {
          type: "number",
          number: workout.temperature
            ? parseFloat(workout.temperature.qty)
            : null,
        },
        "湿度(%)": {
          type: "number",
          number: workout.humidity ? parseFloat(workout.humidity.qty) : null,
        },

        // 心率数据
        平均心率: {
          type: "number",
          number:
            workout.heartRateData && workout.heartRateData.length > 0
              ? parseFloat(workout.heartRateData[0].Avg)
              : null,
        },
        最大心率: {
          type: "number",
          number:
            workout.heartRateData && workout.heartRateData.length > 0
              ? parseInt(workout.heartRateData[0].Max)
              : null,
        },
        最小心率: {
          type: "number",
          number:
            workout.heartRateData && workout.heartRateData.length > 0
              ? parseInt(workout.heartRateData[0].Min)
              : null,
        },

        // 强度数据
        "强度(kcal/hr·kg)": {
          type: "number",
          number: workout.intensity ? parseFloat(workout.intensity.qty) : null,
        },

        // 唯一标识
        "Workout ID": {
          type: "rich_text",
          rich_text: [{ text: { content: workout.id || "" } }],
        },
      };

      // 如果找到健康记录，添加关联字段
      if (healthRecord) {
        properties["健康记录"] = {
          type: "relation",
          relation: [{ id: healthRecord.id }],
        };
        console.log(
          `[${clientIP}] Found health record ${healthRecord.id} for date ${dateStr}, linking to workout`
        );
      }

      // 调用Notion API创建记录
      const notionResponse = await notion.pages.create({
        parent: { database_id: workoutDatabaseId },
        properties: properties,
      });

      results.push({
        id: notionResponse.id,
        title: pageTitle,
        workoutId: workout.id,
        healthRecordId: healthRecord?.id || null,
      });

      // 更新该日期的训练汇总数据
      if (!workoutSummaryByDate[dateStr]) {
        workoutSummaryByDate[dateStr] = {
          totalSteps: 0,
          totalExerciseMinutes: 0,
          totalActiveEnergy: 0,
          workoutCount: 0,
        };
      }

      workoutSummaryByDate[dateStr].totalSteps +=
        properties["步数"].number || 0;
      workoutSummaryByDate[dateStr].totalExerciseMinutes +=
        properties["持续时间(分钟)"].number || 0;
      workoutSummaryByDate[dateStr].totalActiveEnergy +=
        properties["活动能量(kcal)"].number || 0;
      workoutSummaryByDate[dateStr].workoutCount += 1;
    }

    // 更新每个日期的健康记录和习惯追踪数据库
    for (const [dateStr, workoutSummary] of Object.entries(
      workoutSummaryByDate
    )) {
      // 只计算一次运动是否达标情况
      const isStepsGoalMet = workoutSummary.totalSteps >= DAILY_GOALS.steps;
      const isExerciseMinutesGoalMet =
        workoutSummary.totalExerciseMinutes >= DAILY_GOALS.exerciseMinutes;
      const isActiveEnergyGoalMet =
        workoutSummary.totalActiveEnergy >= DAILY_GOALS.activeEnergy;
      const isWorkoutCountGoalMet =
        workoutSummary.workoutCount >= DAILY_GOALS.workoutCount;
      const isAllGoalsMet =
        isStepsGoalMet &&
        isExerciseMinutesGoalMet &&
        isActiveEnergyGoalMet &&
        isWorkoutCountGoalMet;

      // 封装目标达成情况
      const goalsStatus = {
        isStepsGoalMet,
        isExerciseMinutesGoalMet,
        isActiveEnergyGoalMet,
        isWorkoutCountGoalMet,
        isAllGoalsMet,
      };

      // 更新健康记录 - 使用公共函数查找记录
      const healthRecord = await findRecordByDate(
        healthDatabaseId,
        dateStr,
        clientIP,
        "health"
      );
      await updateHealthRecordWithWorkoutSummary(
        healthRecord,
        workoutSummary,
        goalsStatus,
        clientIP
      );

      // 同步训练汇总数据到习惯追踪数据库
      try {
        await updateWorkoutSummaryRecord(
          dateStr,
          {
            steps: workoutSummary.totalSteps,
            exercise_minutes: workoutSummary.totalExerciseMinutes,
            active_energy_kcal: workoutSummary.totalActiveEnergy,
            // 传递达标情况
            steps_goal_met: isStepsGoalMet,
            exercise_minutes_goal_met: isExerciseMinutesGoalMet,
            active_energy_goal_met: isActiveEnergyGoalMet,
            workout_count_goal_met: isWorkoutCountGoalMet,
            all_goals_met: isAllGoalsMet,
          },
          clientIP
        );
      } catch (habitError) {
        console.error(
          `[${clientIP}] Warning: Failed to update habit trace database:`,
          habitError.message
        );
      }
    }

    // 返回成功响应
    console.log(
      `[${clientIP}] Success: Created ${results.length} Notion pages from HealthAutoExport data`
    );
    return response.status(200).json({
      success: true,
      count: results.length,
      results: results,
      workoutSummary: workoutSummaryByDate,
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
export default securityMiddleware(handleWorkoutRequest);
