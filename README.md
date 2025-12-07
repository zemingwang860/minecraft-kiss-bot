# Minecraft Kiss Bot v2.0

一个功能强大的Minecraft机器人，用于自动执行指令和监控玩家活动。

## 🚀 功能特性

### 核心功能
- **自动指令执行**：支持高频自动发送指令，如`/kiss`命令
- **实时聊天监控**：实时显示游戏内聊天消息
- **玩家活动追踪**：记录玩家加入/离开事件
- **位置监控**：实时追踪玩家位置和轨迹

### 高级功能
- **雷达可视化**：实时显示附近玩家位置的雷达界面
- **玩家轨迹追踪**：记录玩家移动轨迹数据
- **热力图生成**：基于玩家活动生成热力图
- **数据持久化**：自动保存玩家数据到JSON文件
- **Web控制台**：提供直观的图形化管理界面

### 数据记录
- **玩家活动日志**：记录玩家加入/离开时间
- **位置历史**：记录玩家位置变化
- **健康/状态信息**：记录玩家健康、食物、经验等状态
- **装备信息**：记录玩家装备情况

## 📋 安装说明

### 系统要求
- Node.js 16+ 或更高版本
- npm 或 yarn 包管理器
- 稳定的网络连接

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/minecraft-kiss-bot-v2.0.git
   cd minecraft-kiss-bot-v2.0
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   - 复制 `.env.example` 文件为 `.env`
   - 编辑 `.env` 文件，设置以下参数：
     ```
     MC_SERVER=your-minecraft-server
     MC_PORT=25565
     MC_EMAIL=your-microsoft-email
     TARGET_PLAYER=target-player-name
     COMMAND_DELAY_MS=1100
     WEB_SERVER_PORT=3000
     DEBUG=false
     ```

4. **启动机器人**
   ```bash
   node bot-server.js
   ```

5. **访问Web控制台**
   - 打开浏览器，访问：`http://localhost:3000`

## 🎮 使用说明

### Web控制台

Web控制台提供以下功能：

1. **仪表盘**：显示机器人状态和统计信息
2. **聊天监控**：实时查看游戏聊天
3. **雷达监控**：查看附近玩家位置
4. **轨迹追踪**：查看玩家移动轨迹和热力图
5. **数据管理**：查看和管理数据库记录
6. **机器人控制**：启动/暂停/停止机器人指令

### 指令控制

- **开始指令**：点击"开始自动亲吻指令"按钮
- **暂停指令**：点击"暂停指令循环"按钮
- **紧急停止**：点击"紧急停止机器人"按钮
- **手动指令**：在输入框中输入指令，按回车键发送

## 📁 项目结构

```
minecraft-kiss-bot-v2.0/
├── bot-server.js          # 主机器人程序
├── package.json           # 项目配置和依赖
├── .env                   # 环境变量配置
├── .env.example           # 环境变量示例
├── public/                # Web界面文件
│   └── index.html         # 主HTML页面
├── .minecraft-bot/        # 数据存储目录
│   ├── player-activity.json    # 玩家活动记录
│   ├── player-trajectories.json # 玩家轨迹数据
│   ├── heatmap-data.json        # 热力图数据
│   ├── last-login.json          # 登录信息
│   └── bot.log                  # 日志文件
└── README.md              # 项目说明文档
```

## 🔧 配置参数

### .env 配置项

| 参数名 | 说明 | 默认值 |
|--------|------|--------|
| MC_SERVER | Minecraft服务器地址 | localhost |
| MC_PORT | Minecraft服务器端口 | 25565 |
| MC_EMAIL | 微软登录邮箱 | - |
| TARGET_PLAYER | 目标玩家名称 | Steve |
| COMMAND_DELAY_MS | 指令执行间隔（毫秒） | 1100 |
| WEB_SERVER_PORT | Web服务器端口 | 3000 |
| DEBUG | 是否启用调试模式 | false |

## 📊 数据格式

### 玩家活动记录 (player-activity.json)
```json
{"username":"player1","event":"joined","time":"2025-12-07T05:11:48.052Z","timestamp":1765084308052}
{"username":"player1","event":"left","time":"2025-12-07T05:12:48.052Z","timestamp":1765084368052}
```

### 玩家轨迹数据 (player-trajectories.json)
```json
{
  "player1": [
    {
      "username": "player1",
      "position": {"x": 100, "y": 64, "z": 200},
      "health": 20,
      "food": 20,
      "experience": 10,
      "armor": 20,
      "time": "2025-12-07T05:11:48.052Z"
    }
  ]
}
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您在使用过程中遇到问题，请通过以下方式获取帮助：

- 提交 Issue：在GitHub仓库中提交问题
- 查看日志：检查 `.minecraft-bot/bot.log` 文件获取详细日志
- 调试模式：设置 `DEBUG=true` 启用详细日志输出

## 🙏 致谢

- 感谢 [Mineflayer](https://github.com/PrismarineJS/mineflayer) 库提供Minecraft机器人功能
- 感谢 [Socket.io](https://socket.io/) 提供实时通信支持
- 感谢 [Express](https://expressjs.com/) 提供Web服务器支持

## 📈 更新日志

### v2.0 (2025-12-07)
- 完全重写项目架构
- 添加Web控制台界面
- 实现雷达可视化功能
- 增加玩家轨迹追踪
- 实现热力图生成
- 优化数据存储格式
- 修复多处bug

### v1.0
- 初始版本
- 基础的自动指令功能
- 简单的聊天监控

---

**使用提示**：本工具仅用于授权服务器的管理与测试。请遵守服务器规则，谨慎使用自动指令功能。