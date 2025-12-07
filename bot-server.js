// bot-server.js - Minecraft 自动指令机器人 v2.0
require('dotenv').config();
const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// ==================== 数据目录管理 ====================
const BOT_DATA_DIR = path.join(__dirname, '.minecraft-bot');
const AUTH_CACHE_DIR = path.join(BOT_DATA_DIR, 'auth-cache');

// 确保数据目录存在
if (!fs.existsSync(BOT_DATA_DIR)) {
  fs.mkdirSync(BOT_DATA_DIR, { recursive: true });
  console.log(`[系统] 创建数据目录: ${BOT_DATA_DIR}`);
}

if (!fs.existsSync(AUTH_CACHE_DIR)) {
  fs.mkdirSync(AUTH_CACHE_DIR, { recursive: true });
}

// ==================== 日志系统 ====================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  orange: process.env.TERM && (process.env.TERM.includes('256color') || process.env.TERM.includes('xterm')) ? '\x1b[38;5;214m' : '\x1b[33m',
  purple: process.env.TERM && (process.env.TERM.includes('256color') || process.env.TERM.includes('xterm')) ? '\x1b[38;5;141m' : '\x1b[35m',
};

const logger = {
  sys: (msg) => console.log(`${colors.cyan}[系统]${colors.reset} ${msg}`),
  bot: (msg) => console.log(`${colors.green}[机器人]${colors.reset} ${msg}`),
  chat: (msg) => console.log(`${colors.magenta}[聊天]${colors.reset} ${msg}`),
  cmd: (msg) => console.log(`${colors.orange}[指令]${colors.reset} ${msg}`),
  web: (msg) => console.log(`${colors.blue}[网页]${colors.reset} ${msg}`),
  err: (msg) => console.error(`${colors.red}[错误]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[警告]${colors.reset} ${msg}`),
  ok: (msg) => console.log(`${colors.green}[成功]${colors.reset} ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG === 'true') {
      console.log(`${colors.dim}[调试]${colors.reset} ${msg}`);
    }
  }
};

// 创建日志文件
const LOG_FILE = path.join(BOT_DATA_DIR, 'bot.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// 增强版日志函数，同时输出到控制台和文件
const enhancedLogger = {
  ...logger,
  _logToFile: (level, msg) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${msg}\n`;
    logStream.write(logEntry);
  },
  sys: (msg) => {
    console.log(`${colors.cyan}[系统]${colors.reset} ${msg}`);
    enhancedLogger._logToFile('SYSTEM', msg);
  },
  bot: (msg) => {
    console.log(`${colors.green}[机器人]${colors.reset} ${msg}`);
    enhancedLogger._logToFile('BOT', msg);
  },
  chat: (msg) => {
    console.log(`${colors.magenta}[聊天]${colors.reset} ${msg}`);
    enhancedLogger._logToFile('CHAT', msg);
  },
  err: (msg) => {
    console.error(`${colors.red}[错误]${colors.reset} ${msg}`);
    enhancedLogger._logToFile('ERROR', msg);
  },
  ok: (msg) => {
    console.log(`${colors.green}[成功]${colors.reset} ${msg}`);
    enhancedLogger._logToFile('SUCCESS', msg);
  }
};

// ==================== 配置管理 ====================
const config = {
  host: process.env.MC_SERVER || 'localhost',
  port: parseInt(process.env.MC_PORT) || 25565,
  username: process.env.MC_EMAIL,
  auth: 'microsoft',
  version: process.env.MC_VERSION || '1.20.1',
  profilesFolder: AUTH_CACHE_DIR,
  // 增加keepalive配置，减少超时错误
  keepAliveTimeout: 60000, // 60秒超时，默认是30秒
  keepAlive: true,
  onMsaCode: (data) => {
    enhancedLogger.sys(`微软登录验证码：${data.user_code}`);
    enhancedLogger.sys(`请访问：${data.verification_uri}`);
    
    // 保存登录信息到文件
    const loginInfo = {
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      requested_at: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'login-info.json'),
      JSON.stringify(loginInfo)
    );
    enhancedLogger.ok(`登录信息已保存到: ${path.join(BOT_DATA_DIR, 'login-info.json')}`);
  }
};

const TARGET_PLAYER = process.env.TARGET_PLAYER || 'Steve';
const COMMAND_DELAY = parseInt(process.env.COMMAND_DELAY_MS) || 50;
const WEB_PORT = parseInt(process.env.WEB_SERVER_PORT) || 3000;

// ==================== Web 服务器 ====================
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// 添加API端点
// 获取当前所有玩家轨迹数据（支持分页）
app.get('/api/trajectories', (req, res) => {
  const limit = parseInt(req.query.limit) || 500; // 默认返回最近500个点
  const offset = parseInt(req.query.offset) || 0;
  const username = req.query.username; // 可选：指定玩家
  
  const result = {};
  
  const playersToProcess = username 
    ? [[username, playerTrajectories.get(username) || []]]
    : playerTrajectories.entries();
  
  for (const [playerName, points] of playersToProcess) {
    if (points && points.length > 0) {
      // 计算分页范围
      const start = Math.max(0, points.length - limit - offset);
      const end = Math.max(0, points.length - offset);
      result[playerName] = points.slice(start, end);
    }
  }
  
  res.json({
    data: result,
    metadata: {
      totalPlayers: username ? 1 : playerTrajectories.size,
      timestamp: new Date().toISOString(),
      limit: limit,
      offset: offset,
      hasMore: username 
        ? (playerTrajectories.has(username) && playerTrajectories.get(username).length > offset + limit)
        : false
    }
  });
});

// 获取指定玩家的轨迹数据（支持分页和时间范围）
app.get('/api/trajectories/:username', (req, res) => {
  const username = req.params.username;
  const limit = parseInt(req.query.limit) || 500;
  const offset = parseInt(req.query.offset) || 0;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  
  if (playerTrajectories.has(username)) {
    let points = playerTrajectories.get(username);
    
    // 时间范围过滤
    if (startTime || endTime) {
      points = points.filter(point => {
        const pointTime = new Date(point.time).getTime();
        const start = startTime ? new Date(startTime).getTime() : 0;
        const end = endTime ? new Date(endTime).getTime() : Infinity;
        return pointTime >= start && pointTime <= end;
      });
    }
    
    // 分页计算
    const start = Math.max(0, points.length - limit - offset);
    const end = Math.max(0, points.length - offset);
    const paginatedPoints = points.slice(start, end);
    
    res.json({
      data: paginatedPoints,
      metadata: {
        totalPoints: points.length,
        limit: limit,
        offset: offset,
        hasMore: points.length > offset + limit,
        username: username,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    res.json({
      data: [],
      metadata: {
        totalPoints: 0,
        limit: limit,
        offset: offset,
        hasMore: false,
        username: username,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// 获取热力图数据（支持分页和时间范围）
app.get('/api/heatmap', (req, res) => {
  const limit = parseInt(req.query.limit) || 5000; // 默认返回最近5000个点
  const offset = parseInt(req.query.offset) || 0;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const username = req.query.username;
  
  // 应用过滤条件
  let filteredData = [...heatmapData];
  
  if (startTime || endTime) {
    filteredData = filteredData.filter(point => {
      const pointTime = new Date(point.time).getTime();
      const start = startTime ? new Date(startTime).getTime() : 0;
      const end = endTime ? new Date(endTime).getTime() : Infinity;
      return pointTime >= start && pointTime <= end;
    });
  }
  
  if (username) {
    filteredData = filteredData.filter(point => point.username === username);
  }
  
  // 分页计算
  const start = Math.max(0, filteredData.length - limit - offset);
  const end = Math.max(0, filteredData.length - offset);
  const paginatedData = filteredData.slice(start, end);
  
  res.json({
    data: paginatedData,
    metadata: {
      totalPoints: filteredData.length,
      limit: limit,
      offset: offset,
      hasMore: filteredData.length > offset + limit,
      timestamp: new Date().toISOString()
    }
  });
});

// 获取服务器信息
app.get('/api/server-info', (req, res) => {
  res.json({
    host: config.host,
    port: config.port,
    targetPlayer: TARGET_PLAYER,
    commandDelay: COMMAND_DELAY,
    webPort: WEB_PORT,
    botState: botState,
    playerCount: bot ? Object.keys(bot.players).length : 0,
    dataStats: {
      trajectories: playerTrajectories.size,
      heatmap: heatmapData.length,
      activity: playerActivityLog.length
    }
  });
});

// 获取玩家活动日志（支持分页和时间范围）
app.get('/api/activity-log', (req, res) => {
  const limit = parseInt(req.query.limit) || 500; // 默认返回最近500条记录
  const offset = parseInt(req.query.offset) || 0;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const eventType = req.query.eventType; // joined, left
  
  // 应用过滤条件
  let filteredLog = [...playerActivityLog];
  
  if (startTime || endTime) {
    filteredLog = filteredLog.filter(entry => {
      const entryTime = new Date(entry.time).getTime();
      const start = startTime ? new Date(startTime).getTime() : 0;
      const end = endTime ? new Date(endTime).getTime() : Infinity;
      return entryTime >= start && entryTime <= end;
    });
  }
  
  if (eventType) {
    filteredLog = filteredLog.filter(entry => entry.event === eventType);
  }
  
  // 分页计算
  const start = Math.max(0, filteredLog.length - limit - offset);
  const end = Math.max(0, filteredLog.length - offset);
  const paginatedLog = filteredLog.slice(start, end);
  
  res.json({
    data: paginatedLog,
    metadata: {
      totalEntries: filteredLog.length,
      limit: limit,
      offset: offset,
      hasMore: filteredLog.length > offset + limit,
      timestamp: new Date().toISOString()
    }
  });
});

// 获取登录信息
app.get('/api/last-login', (req, res) => {
  try {
    const lastLoginPath = path.join(BOT_DATA_DIR, 'last-login.json');
    if (fs.existsSync(lastLoginPath)) {
      const lastLogin = JSON.parse(fs.readFileSync(lastLoginPath, 'utf8'));
      res.json(lastLogin);
    } else {
      res.json({ message: 'No login information found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 清空所有记录
app.post('/api/clear-records', (req, res) => {
  try {
    // 清空内存中的数据
    playerTrajectories.clear();
    heatmapData.length = 0;
    playerActivityLog.length = 0;
    
    // 删除所有JSON数据文件
    const dataFiles = fs.readdirSync(BOT_DATA_DIR).filter(file => file.endsWith('.json'));
    dataFiles.forEach(file => {
      const filePath = path.join(BOT_DATA_DIR, file);
      fs.unlinkSync(filePath);
      enhancedLogger.sys(`已删除数据文件: ${file}`);
    });
    
    res.json({ success: true, message: 'All records cleared successfully' });
    enhancedLogger.ok('所有数据库记录已清空');
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
    enhancedLogger.err(`清空记录失败: ${err.message}`);
  }
});

// 获取附近玩家雷达数据（支持距离过滤）
app.get('/api/radar', (req, res) => {
  if (!bot || !bot.players || !bot.player) {
    res.json({
      data: [],
      metadata: {
        timestamp: new Date().toISOString(),
        botPosition: null,
        playerCount: 0
      }
    });
    return;
  }
  
  const maxDistance = parseInt(req.query.maxDistance) || 100;
  const nearbyPlayers = [];
  const botPos = bot.entity.position;
  
  // 获取所有玩家
  for (const username in bot.players) {
    const player = bot.players[username];
    if (player && player.entity && player.entity.position && username !== bot.username) {
      const playerPos = player.entity.position;
      const distance = botPos.distanceTo(playerPos);
      
      if (distance <= maxDistance) {
        nearbyPlayers.push({
          username: username,
          position: {
            x: Math.round(playerPos.x),
            y: Math.round(playerPos.y),
            z: Math.round(playerPos.z)
          },
          distance: Math.round(distance),
          health: player.entity.health || 0,
          isSneaking: player.entity.sneaking || false,
          isSprinting: player.entity.sprinting || false
        });
      }
    }
  }
  
  res.json({
    data: nearbyPlayers,
    metadata: {
      timestamp: new Date().toISOString(),
      botPosition: {
        x: Math.round(botPos.x),
        y: Math.round(botPos.y),
        z: Math.round(botPos.z)
      },
      playerCount: nearbyPlayers.length,
      maxDistance: maxDistance
    }
  });
});

// 获取最新数据快照（轻量级API，适合高频调用）
app.get('/api/latest-data', (req, res) => {
  const result = {
    players: [],
    timestamp: new Date().toISOString()
  };
  
  if (bot && bot.players) {
    for (const username in bot.players) {
      const player = bot.players[username];
      if (player && player.entity && player.entity.position && username !== bot.username) {
        result.players.push({
          username: username,
          position: {
            x: Math.round(player.entity.position.x),
            y: Math.round(player.entity.position.y),
            z: Math.round(player.entity.position.z)
          },
          health: player.entity.health || 0,
          distance: Math.round(bot.entity.position.distanceTo(player.entity.position))
        });
      }
    }
  }
  
  res.json(result);
});

// Socket.io 状态管理
const chatHistory = [];
let botState = '正在初始化...';
let commandInterval = null;
let isCommandLoopActive = false;
let isBotSpawned = false; // 机器人是否已成功进入游戏
let bot = null; // 全局 bot 实例

// 重连机制配置
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5秒后重试
const MAX_RECONNECT_DELAY = 60000; // 最大延迟60秒
let reconnectTimeout = null;

// 玩家轨迹数据存储
const playerTrajectories = new Map();
const heatmapData = [];
const playerActivityLog = [];
const TRAJECTORY_MAX_POINTS = 1000;
const HEATMAP_MAX_POINTS = 10000;
const ACTIVITY_LOG_MAX_ENTRIES = 5000;

// 定期保存数据到文件
setInterval(() => {
  if (playerTrajectories.size > 0) {
    const trajectoriesData = Object.fromEntries(playerTrajectories);
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'player-trajectories.json'),
      JSON.stringify(trajectoriesData)
    );
  }
  if (heatmapData.length > 0) {
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'heatmap-data.json'),
      JSON.stringify(heatmapData)
    );
  }
  if (playerActivityLog.length > 0) {
    // 采用JSON Lines格式，每个玩家记录占一行
    const activityLines = playerActivityLog.map(entry => JSON.stringify(entry)).join('\n');
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'player-activity.json'),
      activityLines
    );
  }
}, 60000); // 每分钟保存一次

// 加载历史数据
function loadHistoricalData() {
  try {
    // 尝试加载玩家活动记录
    const activityPath = path.join(BOT_DATA_DIR, 'player-activity.json');
    if (fs.existsSync(activityPath)) {
      const fileContent = fs.readFileSync(activityPath, 'utf8');
      const activityData = [];
      
      // 按行解析JSON Lines格式
      const lines = fileContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const entry = JSON.parse(trimmedLine);
            activityData.push(entry);
          } catch (parseErr) {
            enhancedLogger.warn(`解析活动记录行失败: ${parseErr.message}`);
            // 尝试解析为传统JSON数组格式（向后兼容）
            try {
              const arrayData = JSON.parse(fileContent);
              if (Array.isArray(arrayData)) {
                activityData.push(...arrayData);
                break;
              }
            } catch (arrayErr) {
              // 忽略，继续处理下一行
            }
          }
        }
      }
      
      if (activityData.length > 0) {
        playerActivityLog.push(...activityData);
        // 限制日志数量
        while (playerActivityLog.length > ACTIVITY_LOG_MAX_ENTRIES) {
          playerActivityLog.shift();
        }
        enhancedLogger.sys(`加载了 ${activityData.length} 条玩家活动记录`);
      }
    }
  } catch (err) {
    enhancedLogger.warn(`加载历史数据失败: ${err.message}`);
  }
}

// 初始化加载历史数据
loadHistoricalData();

io.on('connection', (socket) => {
  enhancedLogger.web(`用户连接到控制台`);
  socket.emit('status', botState);
  socket.emit('chat-history', chatHistory);
  socket.emit('control-state', { isActive: isCommandLoopActive });

  socket.on('command', (cmd) => {
    enhancedLogger.web(`收到命令: ${cmd}`);
    switch (cmd) {
      case 'start':
        startCommandLoop();
        socket.emit('control-state', { isActive: true });
        break;
      case 'pause':
        stopCommandLoop();
        socket.emit('control-state', { isActive: false });
        break;
      case 'stop':
        if (bot) bot.quit('从网页控制台停止');
        break;
      case 'test':
        if (bot) bot.chat('[测试] 来自网页控制台的消息');
        break;
      default:
        if (bot && cmd.startsWith('/')) {
          bot.chat(cmd);
        }
    }
  });
});

server.listen(WEB_PORT, () => {
  enhancedLogger.web(`图形化聊天界面已启动: http://localhost:${WEB_PORT}`);
});

// ==================== Minecraft 机器人核心 ====================
let bot;

function createBot() {
  enhancedLogger.bot(`正在连接至 ${config.host}:${config.port}...`);
  enhancedLogger.bot(`登录信息保存位置: ${BOT_DATA_DIR}`);
  
  // 检查是否有已保存的登录信息
  if (fs.existsSync(path.join(BOT_DATA_DIR, 'login-info.json'))) {
    try {
      const loginInfo = JSON.parse(fs.readFileSync(path.join(BOT_DATA_DIR, 'login-info.json'), 'utf8'));
      const expiresAt = new Date(loginInfo.expires_at);
      if (expiresAt > new Date()) {
        enhancedLogger.ok(`检测到有效登录信息，到期时间: ${expiresAt.toLocaleString()}`);
      } else {
        enhancedLogger.warn(`登录信息已过期，需要重新登录`);
      }
    } catch (err) {
      enhancedLogger.warn(`无法读取登录信息: ${err.message}`);
    }
  }
  
  botState = '正在连接服务器...';
  io.emit('status', botState);

  bot = mineflayer.createBot(config);

  // 优化区块加载设置
  // 设置最大视距
  bot.viewDistance = 16; // 最大视距
  
  // 调整底层客户端的视距设置
  if (bot._client && bot._client.options) {
    bot._client.options.viewDistance = 16;
  }
  
  enhancedLogger.bot('区块加载设置已优化，视距设置为最大值: 16');

  // 捕获并忽略导致崩溃的协议错误
  bot._client.on('error', (err) => {
    if (err.message.includes('unknown chat format code') ||
      err.message.includes('PartialReadError') ||
      err.name === 'PartialReadError') {
      enhancedLogger.warn('忽略了一个非常规数据包，机器人继续运行...');
      return;
    }
    enhancedLogger.err(`连接错误: ${err.message}`);
  });

  // 监听聊天消息
  bot.on('message', (jsonMsg) => {
    try {
      const text = jsonMsg.toString().trim();
      enhancedLogger.chat(text);
      const chatItem = { time: new Date().toLocaleTimeString(), text };
      chatHistory.push(chatItem);
      if (chatHistory.length > 200) chatHistory.shift();
      io.emit('chat', chatItem);
    } catch (msgErr) {
      // 忽略无法解析的消息
    }
  });

  // 监听玩家加入事件
  bot.on('playerJoined', (player) => {
    if (!isBotSpawned) return; // 只在机器人成功进入后才记录
    
    const joinMsg = `${player.username} 加入了游戏`;
    enhancedLogger.bot(joinMsg);
    const now = new Date().toISOString();
    
    // 记录到活动日志
    const activityEntry = {
      username: player.username,
      event: 'joined',
      time: now,
      timestamp: Date.now()
    };
    
    playerActivityLog.push(activityEntry);
    
    // 限制日志数量
    if (playerActivityLog.length > ACTIVITY_LOG_MAX_ENTRIES) {
      playerActivityLog.shift();
    }
    
    const chatItem = { time: new Date().toLocaleTimeString(), text: `[系统] ${joinMsg}` };
    chatHistory.push(chatItem);
    io.emit('chat', chatItem);
    io.emit('player-joined', { username: player.username, time: now });
  });

  // 监听玩家离开事件
  bot.on('playerLeft', (player) => {
    if (!isBotSpawned) return; // 只在机器人成功进入后才记录
    
    const leaveMsg = `${player.username} 离开了游戏`;
    enhancedLogger.bot(leaveMsg);
    const now = new Date().toISOString();
    
    // 记录到活动日志
    const activityEntry = {
      username: player.username,
      event: 'left',
      time: now,
      timestamp: Date.now()
    };
    
    playerActivityLog.push(activityEntry);
    
    // 限制日志数量
    if (playerActivityLog.length > ACTIVITY_LOG_MAX_ENTRIES) {
      playerActivityLog.shift();
    }
    
    const chatItem = { time: new Date().toLocaleTimeString(), text: `[系统] ${leaveMsg}` };
    chatHistory.push(chatItem);
    io.emit('chat', chatItem);
    io.emit('player-left', { username: player.username, time: now });
  });

  bot.on('spawn', () => {
    enhancedLogger.ok('机器人已登录并进入游戏世界！');
    botState = '已登录游戏世界';
    io.emit('status', botState);
    isBotSpawned = true; // 标记机器人已成功进入游戏
    
    // 保存成功登录信息
    const successInfo = {
      last_login: new Date().toISOString(),
      server: `${config.host}:${config.port}`,
      username: bot.username,
      version: config.version
    };
    
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'last-login.json'),
      JSON.stringify(successInfo)
    );
    
    // 自动启动指令循环
    setTimeout(() => {
      startCommandLoop();
    }, 3000);
    
    // 启动玩家位置跟踪
    startPlayerTracking();
  });
  
  // 玩家位置跟踪函数
  function startPlayerTracking() {
    enhancedLogger.bot('开始跟踪玩家位置...');
    
    // 定期发送动作，保持活跃状态
    setInterval(() => {
      if (bot && bot.player) {
        // 发送一个简单的动作，比如转头或跳跃
        bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, false);
        
        // 每30秒发送一次跳跃
        if (Math.random() < 0.1) { // 10%概率，约每10秒一次
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 100);
        }
        
        // 定期检查并重新设置视距
        if (Math.random() < 0.05) { // 5%概率，约每20秒一次
          if (bot.viewDistance < 16) {
            bot.viewDistance = 16;
            enhancedLogger.bot('检测到视距被降低，已重新设置为最大值: 16');
          }
        }
      }
    }, 1000); // 每秒执行一次
    
    setInterval(() => {
      if (bot && bot.players) {
        // 遍历所有玩家
        for (const username in bot.players) {
          const player = bot.players[username];
          // 排除机器人自己，只记录其他玩家
          if (player && player.entity && player.entity.position && username !== bot.username) {
            const pos = player.entity.position;
            const now = new Date().toISOString();
            
            // 记录玩家轨迹
            if (!playerTrajectories.has(username)) {
              playerTrajectories.set(username, []);
            }
            
            // 收集更详细的玩家信息
            const playerInfo = {
              username: username,
              position: {
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                z: Math.round(pos.z)
              },
              health: player.entity.health || 0,
              food: player.entity.food || 0,
              experience: player.entity.experience || 0,
              armor: player.entity.armorPoints || 0,
              isSneaking: player.entity.sneaking || false,
              isSprinting: player.entity.sprinting || false,
              yaw: player.entity.yaw,
              pitch: player.entity.pitch,
              // 收集装备信息
              equipment: {
                mainHand: player.entity.equipment ? (player.entity.equipment[0] ? player.entity.equipment[0].name : 'none') : 'none',
                offHand: player.entity.equipment ? (player.entity.equipment[1] ? player.entity.equipment[1].name : 'none') : 'none',
                helmet: player.entity.equipment ? (player.entity.equipment[2] ? player.entity.equipment[2].name : 'none') : 'none',
                chestplate: player.entity.equipment ? (player.entity.equipment[3] ? player.entity.equipment[3].name : 'none') : 'none',
                leggings: player.entity.equipment ? (player.entity.equipment[4] ? player.entity.equipment[4].name : 'none') : 'none',
                boots: player.entity.equipment ? (player.entity.equipment[5] ? player.entity.equipment[5].name : 'none') : 'none'
              },
              time: now
            };
            
            const trajectory = playerTrajectories.get(username);
            trajectory.push(playerInfo);
            
            // 限制轨迹点数量
            if (trajectory.length > TRAJECTORY_MAX_POINTS) {
              trajectory.shift();
            }
            
            playerTrajectories.set(username, trajectory);
            
            // 添加到热力图数据
            heatmapData.push({
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              z: Math.round(pos.z),
              username: username,
              health: player.entity.health || 0,
              isActive: true,
              time: now
            });
            
            // 限制热力图数据点数量
            if (heatmapData.length > HEATMAP_MAX_POINTS) {
              heatmapData.shift();
            }
            
            // 发送位置更新到前端
            io.emit('player-position', {
              username: username,
              position: playerInfo
            });
          }
        }
        
    // 每10秒发送一次完整轨迹数据
        if (Math.random() < 0.1) { // 10%概率，约每10秒发送一次
          io.emit('player-trajectories', Object.fromEntries(playerTrajectories));
          io.emit('heatmap-data', heatmapData);
        }
      }
    }, 50); // 50毫秒一次，约20次/秒
  }

  bot.on('error', (err) => {
    enhancedLogger.err(`机器人错误: ${err.message}`);
    botState = `错误: ${err.message}`;
    io.emit('status', botState);
  });

  bot.on('end', (reason) => {
    enhancedLogger.warn(`连接断开: ${reason}`);
    botState = `连接已断开`;
    io.emit('status', botState);
    stopCommandLoop(); // 停止指令循环
    
    // 尝试重新连接
    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      enhancedLogger.warn(`正在尝试重新连接... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) - ${delay}毫秒后重试`);
      
      // 记录断开信息
      const disconnectInfo = {
        time: new Date().toISOString(),
        reason: reason,
        reconnect_in: `${Math.round(delay/1000)}秒`
      };
      
      fs.writeFileSync(
        path.join(BOT_DATA_DIR, 'disconnect-log.json'),
        JSON.stringify(disconnectInfo)
      );
      
      // 使用指数退避策略重新连接
      reconnectTimeout = setTimeout(() => {
        enhancedLogger.ok(`开始第${reconnectAttempts}次重连...`);
        // 重新创建机器人实例
        createBot();
      }, delay);
    } else {
      enhancedLogger.error(`达到最大重连尝试次数(${MAX_RECONNECT_ATTEMPTS})，停止重试。`);
      
      // 记录最终断开信息
      const disconnectInfo = {
        time: new Date().toISOString(),
        reason: reason,
        reconnect_in: '已停止重试'
      };
      
      fs.writeFileSync(
        path.join(BOT_DATA_DIR, 'disconnect-log.json'),
        JSON.stringify(disconnectInfo)
      );
    }
  });

  bot.on('kicked', (reason) => {
    enhancedLogger.warn(`机器人被踢出: ${reason}`);
    botState = `被踢出: ${reason.substring(0, 50)}...`;
    io.emit('status', botState);
    
    // 记录踢出信息
    const kickInfo = {
      time: new Date().toISOString(),
      reason: reason
    };
    
    fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'kick-log.json'),
      JSON.stringify(kickInfo)
    );
  });
}

// ==================== 指令循环控制 ====================
function startCommandLoop() {
  if (!bot || !bot.player) {
    enhancedLogger.cmd('机器人未就绪');
    return;
  }
  if (isCommandLoopActive) {
    enhancedLogger.cmd('指令循环已在运行');
    return;
  }

  enhancedLogger.cmd(`启动指令循环，目标: ${TARGET_PLAYER}, 基础间隔: ${COMMAND_DELAY}毫秒`);
  botState = `正在执行 /kiss ${TARGET_PLAYER}`;
  io.emit('status', botState);
  isCommandLoopActive = true;
  io.emit('control-state', { isActive: true });

  let commandCount = 0;
  
  // 使用setTimeout代替setInterval，实现更灵活的延迟控制
  function executeNextCommand() {
    if (!isCommandLoopActive || !bot || !bot.player) {
      stopCommandLoop();
      return;
    }
    
    commandCount++;
    
    // 在发送指令前检查机器人状态
    if (bot && bot.player && bot.connected) {
      try {
        bot.chat(`/kiss ${TARGET_PLAYER}`);
        
        // 每10次指令输出一次状态，避免日志过多
        if (commandCount % 10 === 0) {
          enhancedLogger.cmd(`已执行 ${commandCount} 次指令`);
          
          // 记录指令执行统计
          const stats = {
            last_update: new Date().toISOString(),
            total_commands: commandCount,
            target_player: TARGET_PLAYER,
            command_delay: COMMAND_DELAY
          };
          
          fs.writeFileSync(
            path.join(BOT_DATA_DIR, 'command-stats.json'),
            JSON.stringify(stats)
          );
        }
        
        // 发送动作消息到Web界面
        const actionMsg = `[动作] 第${commandCount}次执行 /kiss ${TARGET_PLAYER}`;
        io.emit('chat', { time: new Date().toLocaleTimeString(), text: actionMsg });
      } catch (err) {
        enhancedLogger.err(`执行指令失败: ${err.message}`);
        stopCommandLoop();
        return;
      }
    } else {
      stopCommandLoop();
      return;
    }
    
    // 添加随机延迟，避免固定间隔发送指令，降低被检测为机器人的风险
    const randomDelay = COMMAND_DELAY + Math.floor(Math.random() * 1000); // 1000ms随机延迟
    commandInterval = setTimeout(executeNextCommand, randomDelay);
  }
  
  // 执行第一条指令
  executeNextCommand();
}

function stopCommandLoop() {
  if (commandInterval) {
    clearTimeout(commandInterval); // 改为使用clearTimeout，因为现在用的是setTimeout
    commandInterval = null;
  }
  isCommandLoopActive = false;
  botState = '指令循环已停止';
  io.emit('status', botState);
  enhancedLogger.cmd('指令循环已停止');
  io.emit('control-state', { isActive: false });
}

// ==================== 程序启动 ====================
// 彩色ASCII艺术
const asciiArt = `${colors.cyan}
╔══════════════════════════════════════╗
║                                      ║
║    ██╗  ██╗██╗ █████╗ ███╗   ██╗     ║
║    ╚██╗██╔╝██║██╔══██╗████╗  ██║     ║
║     ╚███╔╝ ██║███████║██╔██╗ ██║     ║
║     ██╔██╗ ██║██╔══██║██║╚██╗██║     ║
║    ██╔╝ ██╗██║██║  ██║██║ ╚████║     ║
║    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝     ║
║                                      ║
║    Minecraft 自动指令机器人 v2.0      ║
╚══════════════════════════════════════╝${colors.reset}
`;

console.log(asciiArt);

enhancedLogger.sys('======================================');
enhancedLogger.sys('系统配置:');
enhancedLogger.sys(`  Minecraft 服务器: ${config.host}:${config.port}`);
enhancedLogger.sys(`  目标玩家: ${TARGET_PLAYER}`);
enhancedLogger.sys(`  指令间隔: ${COMMAND_DELAY}毫秒`);
enhancedLogger.sys(`  Web界面端口: ${WEB_PORT}`);
enhancedLogger.sys(`  数据目录: ${BOT_DATA_DIR}`);
enhancedLogger.sys('======================================\n');

// 显示数据目录内容
enhancedLogger.sys('数据目录内容:');
try {
  const files = fs.readdirSync(BOT_DATA_DIR);
  if (files.length > 0) {
    files.forEach(file => {
      const filePath = path.join(BOT_DATA_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const sizeKB = (stats.size / 1024).toFixed(2);
        enhancedLogger.sys(`  📄 ${file} (${sizeKB} KB)`);
      } else {
        enhancedLogger.sys(`  📁 ${file}/`);
      }
    });
  } else {
    enhancedLogger.sys('  目录为空');
  }
} catch (err) {
  enhancedLogger.warn(`无法读取数据目录: ${err.message}`);
}

// 启动机器人
createBot();

// ==================== 优雅关闭处理 ====================
process.on('SIGINT', () => {
  enhancedLogger.sys('正在关闭...');
  stopCommandLoop();
  
  // 记录关闭信息
  const shutdownInfo = {
    time: new Date().toISOString(),
    reason: '用户中断',
    uptime: process.uptime()
  };
  
  fs.writeFileSync(
      path.join(BOT_DATA_DIR, 'shutdown-log.json'),
      JSON.stringify(shutdownInfo)
    );
  
  // 关闭日志文件流
  logStream.end();
  
  if (bot) bot.end('控制台关闭');
  setTimeout(() => process.exit(), 1000);
});

// 清理旧日志文件函数
function cleanupOldLogs(maxFiles = 10) {
  try {
    const logFiles = fs.readdirSync(BOT_DATA_DIR)
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(BOT_DATA_DIR, file),
        time: fs.statSync(path.join(BOT_DATA_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    if (logFiles.length > maxFiles) {
      const filesToDelete = logFiles.slice(maxFiles);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        enhancedLogger.debug(`清理旧日志文件: ${file.name}`);
      });
    }
  } catch (err) {
    // 忽略清理错误
  }
}

// 每小时清理一次旧日志
setInterval(cleanupOldLogs, 3600000);