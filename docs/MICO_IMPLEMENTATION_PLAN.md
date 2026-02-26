# Mico 全链路 AI 虚拟形象解决方案

> 版本: 1.0  
> 日期: 2026-02-23  
> 状态: 规划中

---

## 1. 系统架构全景图

整个流程分为三个阶段，通过 WebSocket 保证低延迟：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户输入 (语音)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段一：感知层 (Input)                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐                    │
│  │ 麦克风   │───►│ VAD 检测     │───►│ Whisper  │───► 纯净文本        │
│  │ 录音    │    │ (800ms静音)  │    │ 转写     │                    │
│  └──────────┘    └──────────────┘    └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段二：决策层 (Cognition)                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────┐                    │
│  │ 用户文本 │───►│ OpenClaw     │───►│ 结构化   │                    │
│  │          │    │ (Mico 教练)  │    │ JSON     │                    │
│  └──────────┘    └──────────────┘    └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  声音分支    │ │  动作分支    │ │  表情分支    │
            │  (分支 A)    │ │  (分支 B)    │ │  (分支 C)    │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段三：执行层 (Output)                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │ GPT-SoVITS   │    │ MDM          │    │ VRM          │            │
│  │ 语音合成     │    │ 动作生成     │    │ 表情驱动     │            │
│  └──────────────┘    └──────────────┘    └──────────────┘            │
│         │                   │                                       │
│         ▼                   ▼                                       │
│    ┌──────────────┐    ┌──────────────┐                           │
│    │ 音频流 +     │    │ 骨骼关键帧    │                           │
│    │ 嘴型数据     │    │ → VRM 骨骼   │                           │
│    └──────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心模块详细设计

### 2.1 阶段一：感知层 (Faster-Whisper)

#### 实现方案
- 在后端部署 faster-whisper 的 Docker 容器
- 前端使用 Web Audio API 录音

#### VAD 策略
- 前端使用 VAD (Voice Activity Detection) 监测
- 当用户停止说话超过 800ms，自动截断音频发送至后端

#### 输出格式
```json
{
  "text": "今天天气怎么样？",
  "isFinal": true,
  "language": "zh"
}
```

---

### 2.2 阶段二：决策层 (OpenClaw)

OpenClaw 此时充当"导演"，输出的 JSON 格式必须高度结构化：

#### 输出格式
```json
{
  "text": "哇！这个主意听起来太酷了！",
  "emotion": "excited",
  "mdm_prompt": "jumping up and down with hands raised",
  "tts_params": {
    "speed": 1.2,
    "emotion_reference": "joyful_style_1"
  },
  "vrm_expressions": {
    "happy": 0.8,
    "blinkLeft": 0.3
  },
  "action_duration": 3.0
}
```

#### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 对话回复文本 |
| emotion | string | 情绪标签 (happy/sad/angry/surprised/excited/relaxed) |
| mdm_prompt | string | MDM 动作提示词 (英文) |
| tts_params | object | TTS 参数 |
| vrm_expressions | object | 显式 VRM 表情控制 |
| action_duration | float | 动作预期时长(秒) |

---

### 2.3 阶段三：执行层

#### 分支 A：声音与嘴型 (GPT-SoVITS + Lip-Sync)

**推流**：后端将 GPT-SoVITS 生成的音频切片（Chunks）通过 WebSocket 传回。

**嘴型驱动**：
1. 前端使用 Web Audio API 创建 AnalyserNode
2. 提取音频的 RMS (能量值) 或 FFT (频率数据)
3. 映射到 VRM 的 vowel_a, i, u, e, o 表情权重

**映射算法**：
```javascript
// 频率到元音的映射
// 低频 → o, 中频 → e/a, 高频 → i/u
// 能量值高时，增大 vowel_a 的权重
// 辅音时切换到 vowel_o
```

#### 分支 B：生成式动作 (MDM)

**生成**：MDM 接收 mdm_prompt，生成一段 2-5 秒的骨骼旋转序列（SM**驱动**：利用PL 格式）

已有的 `rotateBone` 函数（兼容 VRM 0/1）

**重要逻辑**：
- 动作生成的耗时通常比语音稍长
- 前端需要先播放一个通用的"准备说话"微动作（如身体前倾）
- 待 MDM 数据到达后再无缝切换

#### 分支 C：VRM 表情控制

直接使用 `vrm.expressionManager.setValue(name, value)` 控制

---

## 3. GPT-SoVITS 实际配置 (已实现)

### 3.1 API 信息

- **服务**: `api_v2.py`
- **端点**: `/tts`
- **端口**: 9880
- **启动命令**:
  ```bash
  cd D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
  python api_v2.py -a 127.0.0.1 -p 9880
  ```

### 3.2 请求参数

**GET** `http://127.0.0.1:9880/tts`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | ✅ | 要合成的文本 |
| text_lang | string | ✅ | 文本语言: `zh`, `en`, `ja`, `ko`, `yue` |
| ref_audio_path | string | ✅ | 参考音频路径 |
| prompt_text | string | ✅ | 参考音频对应的文本 |
| prompt_lang | string | ✅ | 参考音频语言 |
| speed_factor | float | ❌ | 语速，默认 1.0 |
| streaming_mode | bool | ❌ | 流式模式，默认 false |

### 3.3 参考音频准备

1. 找到模型目录下的参考音频:
   ```
   D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604\model\可莉_ZH\v4\可莉_ZH\reference_audios\中文\emotions\
   ```

2. 复制到简单路径（无中文）:
   ```bash
   copy "原路径\【默认】玩得太开心，忘、忘在脑后了….wav" D:\ref_v2.wav
   ```

3. 在代码中使用:
   ```javascript
   const REF_AUDIO = 'D:\\ref_v2.wav';
   ```

### 3.4 前端请求代码

**第一步：设置模型权重（首次请求时）**

```javascript
// 设置 GPT 模型（可选，服务启动后只需设置一次）
await fetch('/set_gpt_weights?weights_path=GPT_weights_v2Pro/可莉_ZH-e10.ckpt');
```

**第二步：TTS 请求**

```javascript
const params = new URLSearchParams({
  text: "你好呀，主人！",
  text_lang: "zh",
  ref_audio_path: "D:\\ref_v2.wav",
  prompt_text: "玩得太开心忘忘在脑后了",
  prompt_lang: "zh",
  speed_factor: 1.0,
});

const response = await fetch(`/tts?${params}`);
const audioBlob = await response.blob();
```

### 3.5 Vite 代理配置

```javascript
// vite.config.js
server: {
  proxy: {
    '/tts': {
      target: 'http://127.0.0.1:9880',
      changeOrigin: true,
    },
  },
}
```

### 3.6 口型同步实现

**频谱分析**:
```javascript
analyser.fftSize = 1024;
analyser.smoothingTimeConstant = 0.8;

// 频段划分
- 低频 (0-1300Hz): aa, oh
- 中频 (1300-4300Hz): ih, ee  
- 高频 (4300+Hz): ou
```

**元音映射**:
| 元音 | 频率特征 |
|------|----------|
| aa | 低频为主 |
| oh | 低频+中频 |
| ih | 中频 |
| ee | 中高频 |
| ou | 高频 |

---

## 4. WebSocket 通信协议

### 3.1 连接建立

```
客户端 (VRM 前端) ──► ws://localhost:5174/ws
                          │
                          ▼
                    [建立连接]
                          │
                          ◄─────── 连接成功
```

### 3.2 消息格式

**客户端 → 服务器**：
```json
{
  "type": "command",
  "id": "uuid",
  "payload": {
    "cmd": "笑一个",
    "params": {}
  }
}
```

**服务器 → 客户端**：
```json
{
  "type": "response",
  "id": "uuid",
  "payload": {
    "success": true,
    "action": "happy",
    "result": {}
  }
}
```

### 3.3 支持的命令

| 命令 | 参数 | 说明 |
|------|------|------|
| 笑/哭/生气/惊讶 | - | 表情 |
| 打招呼/挥手/跳舞 | - | 动作 |
| 看过来/别看 | - | 注视 |
| setExpression | name, value | 自定义表情 |
| playAnimation | name | 播放动画 |
| getStatus | - | 获取当前状态 |

---

## 4. 实现阶段规划

### Phase 1: 基础能力搭建 (第1-2周)

#### Week 1: 感知层
- [x] 前端麦克风录音功能
- [x] VAD 语音活动检测
- [ ] Faster-Whisper 后端部署
- [ ] WebSocket 音频流传输

#### Week 2: 决策层
- [ ] 设计 Mico System Prompt (结构化输出)
- [ ] OpenClaw 输出格式适配
- [ ] 测试对话流程

---

### Phase 2: 语音合成 (第3周)

#### Week 3: TTS 集成
- [ ] GPT-SoVITS 后端部署
- [ ] WebSocket 音频流推送
- [ ] 实时嘴型同步 (RMS/FFT 映射)
- [ ] 音频播放与嘴型同步

---

### Phase 3: 动作生成 (第4周)

#### Week 4: MDM 动作
- [ ] MDM 模型部署
- [ ] 动作提示词 → 骨骼序列
- [ ] VRM 骨骼驱动 (兼容 0/1)
- [ ] 动作与语音同步

---

### Phase 4: 整合优化 (第5周)

#### Week 5: 端到端
- [ ] 全链路联调
- [ ] 延迟优化
- [ ] 错误处理
- [ ] 性能优化

---

## 5. 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React + Three.js | VRM 渲染 |
| VRM 库 | @pixiv/three-vrm | 模型控制 |
| 动作捕捉 | MediaPipe / MDM | 动作生成 |
| 语音识别 | Faster-Whisper | 本地转写 |
| 语音合成 | GPT-SoVITS | 声音生成 |
| 实时通信 | WebSocket | 低延迟传输 |
| 状态管理 | Zustand | 前端状态 |

---

## 6. 技术背景知识

### 6.1 Whisper 语音识别

**Whisper** 是 OpenAI 2022 年发布的语音识别模型：
- 开源免费，支持 100+ 语言
- 离线运行，隐私安全
- 准确率高

**Faster-Whisper** 是优化版本：
- 用 CTranslate2 重写，比原版快 2-4 倍
- 支持 GPU 加速

### 6.2 Flask Web 框架

**Flask** 是 Python 轻量级 Web 框架：
- 简单易学，适合小项目
- 接收 HTTP 请求，返回 JSON 响应
- 适合做微服务 API

### 6.3 Docker 容器（可选）

**Docker** 打包技术：
- 把整个运行环境（代码+依赖+系统）打包
- 一键运行，无需手动配置
- 适合复杂依赖（如机器学习项目）

### 6.4 WebSocket vs HTTP

| 通信方式 | 特点 | 适用场景 |
|----------|------|----------|
| HTTP | 请求-响应，实时性低 | 简单 API |
| WebSocket | 双向实时通信 | 语音流、聊天 |

---

## 7. 注意事项

1. **VRM 版本兼容**：VRM 0.x 和 1.0 骨骼方向不同，需要分别处理
2. **延迟控制**：语音合成和动作生成需要并行处理
3. **嘴型同步**：需要精细调整 RMS/FFT 到元音的映射
4. **错误处理**：网络中断、模型加载失败等情况需要容错

---

## 7. Agent 配置指南 (2026-02-24 新增)

### 7.1 Mico VRM Agent 创建步骤

#### 1. 创建 Agent 目录

在 `~/.openclaw/` 下创建 Agent 工作目录：

```
C:\Users\Miss\.openclaw\workspace-mico-vrm\
├── SOUL.md           # 人设配置（必选）
├── USER.md           # 用户信息（必选）
├── auth-profiles.json # 认证配置（必选）
├── models.json       # 模型配置（必选）
└── memory/           # 记忆目录
```

#### 2. 配置文件说明

**SOUL.md** - Agent 灵魂/人格配置：
```markdown
# Mico VRM - 虚拟形象 Agent

## 身份
- 名字: Mico (米可)
- 角色: VRM 虚拟形象 AI 助理
- 性格: 活泼、元气满满

## 回复格式
必须返回 JSON 格式：
{
  "text": "你的回复内容",
  "emotion": "happy|excited|surprised|relaxed|neutral",
  "action": "none|wave|nod|shake|think|point",
  "expressions": {
    "happy": 0-1,
    "sad": 0-1,
    ...
  }
}
```

**USER.md** - 用户信息：
```markdown
# 用户信息
- 名字: Jim
- 称呼: 主人
```

#### 3. 注册 Agent

编辑 `~/.openclaw/openclaw.json`，在 `agents.list` 中添加：

```json
{
  "agents": {
    "list": [
      {
        "id": "mico-vrm",
        "agentDir": "C:\\Users\\Miss\\.openclaw\\workspace-mico-vrm"
      }
    ]
  }
}
```

#### 4. 重启 Gateway

```bash
openclaw gateway restart
```

### 7.2 前端调用方式

前端通过 OpenResponses API 调用 Agent：

```javascript
// 保持会话上下文
const sessionKey = `session-${Date.now()}`;

const requestBody = {
  model: "openclaw:mico-vrm",  // 注意：必须加 "openclaw:" 前缀
  input: "你好",
  user: sessionKey  // 关键：保持会话上下文
};

fetch('/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify(requestBody)
})
```

**关键参数说明**：
| 参数 | 说明 |
|------|------|
| `model` | Agent ID，前缀 `openclaw:` |
| `input` | 用户输入文本 |
| `user` | 会话标识符，使用固定值可保持上下文 |

> ⚠️ **重要**：不要同时使用 WebSocket 和 HTTP API 两种方式，否则会收到多个 Agent 的回复。建议只使用 HTTP API 方式。

### 7.3 注意事项

1. **model 格式**：必须使用 `openclaw:<agentId>` 格式
2. **目录唯一性**：每个 Agent 必须有独立目录，不能共享
3. **认证配置**：确保 auth-profiles.json 包含有效的 API Key
4. **统一通信方式**：只使用 HTTP API，避免 WebSocket 重复接收消息
5. **会话上下文**：使用固定的 `user` 值可以让 Agent 记住对话历史

---

## 8. 动作与表情同步方案（已实现）

### 8.1 动作同步

```
AI 返回 action: "wave"
        ↓
executeAction("wave")
        ↓
┌───────────────────────────────────────┐
│ 1. 设置 animation: "Waving"           │
│ 2. 设置 currentAction: "wave"         │
│ 3. 启动定时器（默认 4000ms）         │
└───────────────────────────────────────┘
        ↓
VRMAvatar.jsx 检测到变化
        ↓
┌───────────────────────────────────────┐
│ 动画系统：                              │
│ • Idle ("Breathing Idle") 始终在后台运行 │
│ • 新动作 fadeIn(0.5s) 覆盖 Idle      │
│ • 旧动作 fadeOut(0.5s) 淡出          │
└───────────────────────────────────────┘
        ↓
定时器触发（默认 4 秒后）
        ↓
┌───────────────────────────────────────┐
│ 设置 animation: "Breathing Idle"       │
│ → Idle 继续无缝播放，无 T-pose         │
└───────────────────────────────────────┘
```

### 8.2 表情同步

```
AI 返回 expressions: { happy: 0.9, neutral: 0.1 }
        ↓
executeAction("wave", { happy: 0.9, neutral: 0.1 })
        ↓
setTargetExpressions({ happy: 0.9, neutral: 0.1 })
        ↓
VRMAvatar.jsx useFrame 中
        ↓
updateExpressions() 逐渐将 expressions 趋向 targetExpressions
        ↓
VRM 自动将 happy/neutral 等映射到嘴巴 morphTarget
```

### 8.3 嘴型同步（TTS）

```
TTS 播放中
        ↓
useTTS.js analyzeAudio() 频谱分析
        ↓
计算 aa/ih/ee/oh/ou 值
        ↓
setLipSyncExpressions({ aa: 0.5, ... })
        ↓
VRMAvatar.jsx 检测 hasTtsData
        ↓
if (hasTtsData):
  lerpExpression("aa", lipSync.aa)  // 用 TTS 嘴巴
else:
  // 不处理，让 VRM 用 AI 表情的嘴巴映射

TTS 结束
        ↓
lipSyncExpressions 保持原值
        → hasTtsData = false
        → 不处理嘴巴
        → VRM 自动用 AI 表情的嘴巴
```

### 8.4 优先级

| 层级 | 控制权 | 说明 |
|------|--------|------|
| 1 | TTS 嘴型 | 最高优先级，TTS 播放时直接覆盖 |
| 2 | AI 表情 | VRM 自动根据 happy/neutral 映射到嘴巴 |
| 3 | Idle 动作 | 始终在后台运行，作为基础层 |

### 8.5 关键代码位置

| 功能 | 文件 | 函数 |
|------|------|------|
| 动作执行 | useVRMControl.js | `executeAction()` |
| 动画播放 | VRMAvatar.jsx | `useEffect` (animationStateRef) |
| 表情渐变 | useVRMControl.js | `updateExpressions()` |
| TTS 嘴型 | useTTS.js | `analyzeAudio()` |
| 嘴型应用 | VRMAvatar.jsx | `if (hasTtsData) ...` |

---

## 9. 待讨论

- [ ] VAD 具体实现方案
- [ ] MDM 模型选择与部署
- [ ] GPT-SoVITS 声音模型
- [ ] 延迟优化目标 (目标 < 500ms)
- [ ] 多语言支持

---

*文档状态：部分实现，Agent 配置已完成*
