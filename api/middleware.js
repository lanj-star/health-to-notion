// 导入必要的库
import { Client } from "@notionhq/client";

// 初始化Notion客户端，密钥从环境变量读取
export const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 工具函数：日期 +1 天
export function addOneDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// 根据日期查询数据库记录（公共函数）
export async function findRecordByDate(
  databaseId,
  dateStr,
  clientIP,
  recordType = "health"
) {
  try {
    // 1. 获取 data_source_id
    const db = await notion.databases.retrieve({
      database_id: databaseId,
    });

    const dataSourceId = db.data_sources[0].id;
    const nextDate = addOneDay(dateStr);

    // 2. 查询
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          {
            property: "Date",
            date: {
              on_or_after: dateStr,
            },
          },
          {
            property: "Date",
            date: {
              before: nextDate,
            },
          },
        ],
      },
      page_size: 1,
    });

    console.log(
      `[${clientIP}] Queried ${recordType} records for date ${dateStr}, found ${response.results.length} records`
    );

    return response.results.length ? response.results[0] : null;
  } catch (error) {
    console.error(
      `[${clientIP}] Error querying ${recordType} records for date ${dateStr}:`,
      error
    );
    throw error;
  }
}

// 获取客户端IP地址的辅助函数（支持代理环境）
export function getClientIP(request) {
  // 优先检查代理头（如果使用了Nginx、Cloudflare等代理）
  const forwardedFor = request.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for格式通常为：client, proxy1, proxy2
    return forwardedFor.split(",")[0].trim();
  }

  // 检查X-Real-IP头（另一种常用的代理IP头）
  const realIP = request.headers["x-real-ip"];
  if (realIP) {
    return realIP;
  }

  // 直接从request获取（适用于没有代理的情况）
  return request.socket?.remoteAddress || "Unknown";
}

// 辅助函数：将IPv4映射的IPv6地址转换为IPv4地址
function normalizeIP(ip) {
  // 检查是否是IPv4映射的IPv6地址（如::ffff:127.0.0.1）
  const ipv4MappedRegex = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;
  const match = ip.match(ipv4MappedRegex);

  if (match) {
    // 返回对应的IPv4地址
    return match[1];
  }

  // 对于localhost特殊处理
  if (ip === "::1") {
    return "localhost";
  }

  // 其他情况保持不变
  return ip;
}

// 检查客户端IP是否在白名单中的函数
export function isIPWhitelisted(clientIP) {
  // 从环境变量获取白名单配置，支持多个IP地址（逗号分隔）
  const whitelist = process.env.IP_WHITELIST;

  // 如果未配置白名单，默认允许所有IP（便于开发和测试）
  if (!whitelist) {
    console.log(`[${clientIP}] IP whitelist not configured, allowing all IPs`);
    return true;
  }

  // 将白名单字符串转换为IP数组并去除空格
  const allowedIPs = whitelist.split(",").map((ip) => ip.trim());

  // 标准化客户端IP（处理IPv4映射的IPv6地址）
  const normalizedClientIP = normalizeIP(clientIP);

  // 检查标准化后的客户端IP是否在白名单中
  const isAllowed = allowedIPs.includes(normalizedClientIP);

  if (!isAllowed) {
    console.log(
      `[${clientIP}] IP not whitelisted. Normalized: ${normalizedClientIP}, Allowed: ${allowedIPs.join(
        ", "
      )}`
    );
  }

  return isAllowed;
}

// 安全验证中间件
export function securityMiddleware(handler) {
  return async (request, response) => {
    // 获取客户端IP地址
    const clientIP = getClientIP(request);

    // 记录收到请求
    console.log(
      `[${clientIP}] Received request: ${request.method} ${request.url}`
    );

    // 1. 只处理POST请求
    if (request.method !== "POST") {
      console.log(`[${clientIP}] Method not allowed: ${request.method}`);
      return response.status(405).json({ error: "Method not allowed" });
    }

    // 2. 🔐 安全验证：检查客户端IP是否在白名单中
    if (!isIPWhitelisted(clientIP)) {
      console.error(`[${clientIP}] IP not whitelisted`);
      return response
        .status(403)
        .json({ error: "Forbidden: IP address not allowed" });
    }

    // 3. 🔐 安全验证：检查URL中的令牌
    const urlToken = request.query.token;
    if (urlToken !== process.env.SECRET_TOKEN) {
      console.error(`[${clientIP}] Invalid token received: ${urlToken}`);
      return response
        .status(401)
        .json({ error: "Unauthorized: Invalid token" });
    }

    // 调用实际的处理函数
    return handler(request, response, clientIP);
  };
}
