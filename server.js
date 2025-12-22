import express from "express";
import workoutHandler from "./api/workout.js";
import healthHandler from "./api/health.js";
import * as dotenv from "dotenv";

// 本地开发时加载.env.local文件
// Vercel部署时会自动忽略，使用Vercel控制台配置的环境变量
dotenv.config({ path: ".env.local" });

const app = express();
const PORT = process.env.PORT || 3000;

// 解析JSON请求体
app.use(express.json());

// 设置API路由
app.post("/api/workout", workoutHandler);
app.post("/api/health", healthHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/notion-webhook`);
  console.log(
    `Health Auto Export endpoint: http://localhost:${PORT}/api/health-auto-export`
  );

  // 验证环境变量是否加载成功（仅用于调试）
  console.log("Environment variables loaded:");
  console.log("NOTION_TOKEN:", process.env.NOTION_TOKEN ? "✓" : "✗");
  console.log(
    "NOTION_HEALTH_DATABASE_ID:",
    process.env.NOTION_HEALTH_DATABASE_ID ? "✓" : "✗"
  );
  console.log(
    "NOTION_WORKOUT_DATABASE_ID:",
    process.env.NOTION_WORKOUT_DATABASE_ID ? "✓" : "✗"
  );
  console.log(
    "NOTION_HABBIT_TRACE_DATABASE_ID:",
    process.env.NOTION_HABBIT_TRACE_DATABASE_ID ? "✓" : "✗"
  );
  console.log("SECRET_TOKEN:", process.env.SECRET_TOKEN ? "✓" : "✗");
  console.log("IP_WHITELIST:", process.env.IP_WHITELIST ? "✓" : "✗");
});
