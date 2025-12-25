// 导入共享中间件
import { notion, securityMiddleware, findRecordByDate } from "./middleware.js";

// 数据库ID配置
const sleepDatabaseId = process.env.NOTION_SLEEP_DATABASE_ID;

// 时间格式转换函数：将 "2025-12-23 21:56:37 +0800" 转换为 ISO 8601 格式
function convertToISO8601(dateStr) {
  // 首先将日期部分和时间部分之间的空格替换为 "T"
  let isoStr = dateStr.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/,
    "$1T$2"
  );

  // 然后移除时间部分和时区之间的空格
  isoStr = isoStr.replace(/\s+([+-]\d{4})$/, "$1");

  // 确保时区格式正确（+0800 -> +08:00）
  if (/[+-]\d{4}$/.test(isoStr)) {
    isoStr = isoStr.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  }

  return isoStr;
}

// 睡眠评分计算函数
function calculateSleepScore(sleepData) {
  // 初始化评分
  let score = 80;

  // 计算总睡眠时长（小时）
  const totalSleepHours = sleepData.totalSleepTime;

  // 理想睡眠时长范围（7-9小时）
  if (totalSleepHours < 7) {
    score -= (7 - totalSleepHours) * 5; // 每少1小时扣5分
  } else if (totalSleepHours > 9) {
    score -= (totalSleepHours - 9) * 3; // 每多1小时扣3分
  }

  // 深睡比例（理想15-25%）
  const deepSleepPercentage = (sleepData.deepSleepTime / totalSleepHours) * 100;
  if (deepSleepPercentage < 15) {
    score -= (15 - deepSleepPercentage) * 2; // 每少1%扣2分
  } else if (deepSleepPercentage > 25) {
    score -= (deepSleepPercentage - 25) * 1; // 每多1%扣1分
  }

  // REM睡眠比例（理想20-25%）
  const remSleepPercentage = (sleepData.remSleepTime / totalSleepHours) * 100;
  if (remSleepPercentage < 20) {
    score -= (20 - remSleepPercentage) * 2; // 每少1%扣2分
  } else if (remSleepPercentage > 25) {
    score -= (remSleepPercentage - 25) * 1; // 每多1%扣1分
  }

  // 清醒时间比例（理想<5%）
  const awakePercentage = (sleepData.awakeTime / totalSleepHours) * 100;
  if (awakePercentage > 5) {
    score -= (awakePercentage - 5) * 3; // 每多1%扣3分
  }

  // 确保评分在0-100之间
  score = Math.max(0, Math.min(100, Math.round(score)));

  return score;
}

// 主处理函数
async function handleSleepRequest(req, res) {
  try {
    // 获取客户端IP地址
    const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // 解析请求体
    const requestData = req.body;
    console.log("Request data received:", JSON.stringify(requestData, null, 2));

    // 正确解析嵌套的数据结构
    const dataMetrics = requestData?.data?.metrics || [];
    console.log("Metrics found:", JSON.stringify(dataMetrics, null, 2));

    // 按日期分组睡眠数据
    const sleepSummaryByDate = {};

    // 处理每个metrics项
    dataMetrics.forEach((metric) => {
      console.log("Processing metric:", JSON.stringify(metric, null, 2));

      // 获取睡眠阶段数据数组
      const sleepStages = metric?.data || [];
      console.log("Sleep stages found:", JSON.stringify(sleepStages, null, 2));

      // 处理每个睡眠阶段数据
      sleepStages.forEach((sleepStage) => {
        console.log(
          "Processing sleep stage:",
          JSON.stringify(sleepStage, null, 2)
        );

        // 解析开始时间和日期，增加容错处理
        const startDate = new Date(sleepStage.startDate);
        if (isNaN(startDate.getTime())) {
          console.error("Invalid startDate:", sleepStage.startDate);
          return; // 跳过无效时间
        }

        const dateStr = startDate.toISOString().slice(0, 10);

        // 如果该日期的睡眠数据不存在，则初始化
        if (!sleepSummaryByDate[dateStr]) {
          sleepSummaryByDate[dateStr] = {
            date: dateStr,
            startTime: sleepStage.startDate,
            endTime: sleepStage.endDate,
            awakeTime: 0,
            asleepTime: 0,
            coreSleepTime: 0,
            deepSleepTime: 0,
            remSleepTime: 0,
            source: sleepStage.source,
          };
        }

        // 根据睡眠阶段累加时长
        const duration = parseFloat(sleepStage.qty) || 0;
        switch (sleepStage.value) {
          case "Awake":
            sleepSummaryByDate[dateStr].awakeTime += duration;
            break;
          case "Asleep":
            sleepSummaryByDate[dateStr].asleepTime += duration;
            break;
          case "Core":
            sleepSummaryByDate[dateStr].coreSleepTime += duration;
            break;
          case "Deep":
            sleepSummaryByDate[dateStr].deepSleepTime += duration;
            break;
          case "REM":
            sleepSummaryByDate[dateStr].remSleepTime += duration;
            break;
          default:
            console.log("Unknown sleep stage:", sleepStage.value);
        }

        // 更新结束时间，增加容错处理
        const endDate = new Date(sleepStage.endDate);
        if (!isNaN(endDate.getTime())) {
          const currentEndTime = new Date(sleepSummaryByDate[dateStr].endTime);
          if (endDate > currentEndTime) {
            sleepSummaryByDate[dateStr].endTime = sleepStage.endDate;
          }
        } else {
          console.error("Invalid endDate:", sleepStage.endDate);
        }
      });
    });

    console.log(
      "Sleep summary by date:",
      JSON.stringify(sleepSummaryByDate, null, 2)
    );

    // 计算总睡眠时长并生成评分
    const results = [];
    for (const dateStr in sleepSummaryByDate) {
      const sleepData = sleepSummaryByDate[dateStr];

      // 计算总睡眠时长（深睡 + 浅睡 + REM）
      sleepData.totalSleepTime =
        sleepData.deepSleepTime +
        sleepData.coreSleepTime +
        sleepData.remSleepTime;

      // 计算睡眠评分
      sleepData.sleepScore = calculateSleepScore(sleepData);

      // 检查Notion中是否已存在该日期的睡眠记录
      const existingRecord = await findRecordByDate(
        sleepDatabaseId,
        dateStr,
        clientIP,
        "sleep"
      );

      // 转换时间格式为ISO 8601
      const isoStartTime = convertToISO8601(sleepData.startTime);
      const isoEndTime = convertToISO8601(sleepData.endTime);

      // 准备Notion记录属性
      const sleepProperties = {
        Date: { date: { start: dateStr } },
        开始时间: { date: { start: isoStartTime } },
        结束时间: { date: { start: isoEndTime } },
        "总睡眠时长(小时)": {
          number: Math.round(sleepData.totalSleepTime * 10) / 10,
        },
        "深睡时长(小时)": {
          number: Math.round(sleepData.deepSleepTime * 10) / 10,
        },
        "浅睡时长(小时)": {
          number: Math.round(sleepData.coreSleepTime * 10) / 10,
        },
        "REM时长(小时)": {
          number: Math.round(sleepData.remSleepTime * 10) / 10,
        },
        "清醒时长(小时)": { number: Math.round(sleepData.awakeTime * 10) / 10 },
        睡眠评分: { number: sleepData.sleepScore },
        数据源: { select: { name: sleepData.source || "Unknown" } },
      };
      if (existingRecord) {
        // 更新现有记录
        await notion.pages.update({
          page_id: existingRecord.id,
          properties: sleepProperties,
        });

        results.push({
          status: "updated",
          date: dateStr,
          recordId: existingRecord.id,
          title: `睡眠记录 ${dateStr}`,
        });
      } else {
        // 创建新记录
        const newRecord = await notion.pages.create({
          parent: { database_id: sleepDatabaseId },
          properties: sleepProperties,
        });

        results.push({
          status: "created",
          date: dateStr,
          recordId: newRecord.id,
          title: `睡眠记录 ${dateStr}`,
        });
      }
    }

    // 返回成功响应
    return res.status(200).json({
      success: true,
      message: "睡眠数据已成功处理",
      results,
      sleepSummaryByDate,
    });
  } catch (error) {
    console.error("处理睡眠数据时出错:", error);
    return res.status(500).json({
      success: false,
      message: "处理睡眠数据时发生错误",
      error: error.message,
    });
  }
}

// 使用安全中间件包装API端点
export default securityMiddleware(handleSleepRequest);
