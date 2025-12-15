# Health to Notion

将健康数据（步数、心率、睡眠等）同步到Notion数据库的Webhook服务。

## 功能

- 接收健康数据的POST请求
- 验证请求的安全性
- 将数据写入Notion数据库
- 支持记录：日期、步数、心率、睡眠时长
- 提供健康检查端点用于测试服务状态

## 技术栈

- Node.js
- [@notionhq/client](https://www.npmjs.com/package/@notionhq/client) - Notion API客户端
- [dotenv](https://www.npmjs.com/package/dotenv) - 环境变量管理
- [express](https://www.npmjs.com/package/express) - Web服务器框架

## 安装

1. 克隆项目
2. 安装依赖：

   ```bash
   npm install
   ```

## 配置

1. 在`.env.local`中配置以下变量（文件已存在）：
   - `NOTION_TOKEN` - Notion集成密钥
   - `NOTION_DATABASE_ID` - Notion数据库ID（请确保不包含连字符）
   - `SECRET_TOKEN` - 自定义安全令牌，用于验证请求

## Notion数据库设置

确保你的Notion数据库包含以下**英文**属性名称：

- Date (Date类型)
- Steps (Number类型)
- Heart Rate (Number类型)
- Sleep Duration (Number类型)

## 使用

### 本地运行

1. 启动服务器：

   ```bash
   npm start
   ```

2. 服务器将在 `http://localhost:3000` 上运行

3. 健康检查端点（用于验证服务是否正常运行）：

   ```bash
   curl http://localhost:3000/health
   ```

   成功响应：`{"status":"ok","message":"Health to Notion Webhook is running"}`

### 发送健康数据

发送POST请求到Webhook端点：

```bash
curl -X POST http://localhost:3000/api/notion-webhook \
  -H "Content-Type: application/json" \
  -H "x-secret-token: YOUR_SECRET_TOKEN" \
  -d '{"date":"2024-01-01","steps":8500,"heartRate":72,"sleep":7.5}'
```

### iOS快捷指令访问

1. 确保你的iOS设备和运行服务的电脑在同一局域网
2. 获取电脑的本地IP地址（Windows可通过`ipconfig`命令查看）
3. 在快捷指令中使用以下URL格式：
   ```
   http://你的电脑IP:3000/api/notion-webhook
   ```
4. 添加请求头：`x-secret-token` = 你的SECRET_TOKEN
5. 发送JSON格式的健康数据

## 项目结构

health-to-notion/
├── .env.local                # 环境变量配置文件
├── .gitignore                # Git忽略文件列表
├── README.md                 # 项目说明文档
├── api/
│   └── notion-webhook.js     # Notion Webhook处理逻辑
├── server.js                 # 主服务器文件
├── package-lock.json         # 依赖锁定文件
└── package.json              # npm项目配置

## 核心功能流程

1. 客户端发送POST请求到Webhook端点
2. 验证请求方法和安全令牌
3. 解析请求体中的健康数据
4. 使用Notion API将数据写入数据库
5. 返回成功或错误响应

## 安全注意事项

- 永远不要将`NOTION_TOKEN`和`SECRET_TOKEN`等敏感信息提交到版本控制
- 确保`SECRET_TOKEN`足够复杂，防止未授权访问
- 在生产环境部署时，建议使用HTTPS协议
- 定期更换Notion集成密钥以提高安全性

## 常见问题

### Q: 运行时出现"Cannot find database with ID"错误
A: 请检查：
1. Notion数据库ID是否正确（移除连字符）
2. 数据库是否已与Notion集成共享
3. NOTION_TOKEN是否有效

### Q: 出现"xxx is not a property that exists"错误
A: 请确保Notion数据库中的属性名称与代码中使用的英文名称完全一致

### Q: 环境变量不生效
A: 请检查.env.local文件是否在项目根目录，且变量名称拼写正确

## Vercel部署

1. 将项目推送到GitHub仓库
2. 登录Vercel，选择"Add New Project"
3. 连接你的GitHub仓库并选择该项目
4. 在Vercel项目设置中配置环境变量：
   - `NOTION_TOKEN` - Notion集成密钥
   - `NOTION_DATABASE_ID` - Notion数据库ID
   - `SECRET_TOKEN` - 自定义安全令牌
5. 点击"Deploy"完成部署

### Vercel部署注意事项

- Vercel会自动将`api/`目录下的文件识别为无服务器函数
- 不需要在Vercel上配置`server.js`，它只用于本地开发
- 环境变量必须在Vercel控制台中配置，而不是使用`.env.local`文件

## 部署后的使用

部署成功后，你将获得一个类似以下的URL：
https://your-project.vercel.app/api/notion-webhook?token=YOUR_SECRET_TOKEN