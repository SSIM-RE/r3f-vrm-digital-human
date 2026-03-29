# VRM 数字人系统详细设计文档

> 本文档为详细设计说明，包含系统架构、模块设计、技术实现细节等

---

## 一、系统概述

### 1.1 设计目标

构建一个集成 OpenClaw Agent 的 VRM 虚拟数字人系统，实现：

| 功能 | 说明 |
|------|------|
| 智能对话 | 用户语音/文本输入 → Whisper/直接输入 → OpenClaw Agent → 返回结构化指令 |
| 语音输出 | TTS 语音合成 + 虚拟形象播放 |
| 表情控制 | 根据 Agent 返回的情绪指令改变面部表情 |
| 动作配合 | 根据动作指令播放预设动画或 DiP 生成动作 |
| 口型同步 | 实时分析 TTS 音频，驱动虚拟形象嘴型 |

### 1.2 核心挑战与解决方案

| 挑战 | 描述 | 解决方案 |
|------|------|----------|
| 多模态同步 | 语音、动作、表情需要协调触发 | 状态机管理，按时间顺序触发 |
| 实时响应 | 用户输入后需快速反馈 | 预设动画优先，AI 生成作为增强 |
| 自然动作 | AI 生成的动作要符合人类习惯 | DiP 动作生成 + 骨骼映射 |
| VRM 兼容性 | VRM 0.x 和 1.0 骨骼/表情不同 | 版本检测 + 条件分支处理 |

---

## 二、整体架构

### 2.1 数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户输入                                    │
│                    ┌─────────────────┐    ┌─────────────────┐            │
│                    │   语音输入      │    │   文本输入      │            │
│                    │  (麦克风录音)   │    │   (直接输入)    │            │
│                    └────────┬────────┘    └────────┬────────┘            │
└───────────────────────────┼─────────────────────┼──────────────────────┘
                            │                     │
                            ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        useAudioRecorder                                 │
│  • MediaRecorder 录音                                                   │
│  • VAD 检测静音 > 800ms 自动停止                                         │
│  • 输出 Audio Blob → Whisper 转写                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      OpenClaw Agent                                     │
│  输入: 用户意图                                                          │
│  输出: {                                                               │
│    "voiceText": "你好，很高兴见到你！",  // 用于 TTS 播报的文本          │
│    "text": "...",                              // 用于界面展示的详细文本  │
│    "emotion": "happy",                        // 情绪指令                 │
│    "actions": ["wave", "nod"],                // 动作指令列表            │
│    "expressions": {"happy": 1}                // 表情指令                 │
│  }                                                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
              ┌───────────────────────────────────────────────────────────┐
              │             前端解析处理                                   │
              │   解析 Agent 返回的结构化数据                              │
              │   ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
              │   │    TTS     │  │   表情     │  │      动作        │  │
              │   │ 语音+口型   │  │  setValue  │  │ DiP / 预设动画  │  │
              │   └────────────┘  └────────────┘  └──────────────────┘  │
              └────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           VRMAvatar                                     │
│              (模型加载 + 动画播放 + 表情控制 + 渲染)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                         用户界面层                           │
│        React + Tailwind CSS                                 │
│        控制面板 | 通知中心 | 聊天输入 | 待办事项             │
├─────────────────────────────────────────────────────────────┤
│                         状态管理层                           │
│        Zustand                                              │
│        表情 | 动作 | 口型 | 交互状态                         │
├─────────────────────────────────────────────────────────────┤
│                         3D 渲染层                           │
│        Three.js + R3F                                       │
│        场景 | 灯光 | 后处理 | VRM模型                       │
├─────────────────────────────────────────────────────────────┤
│                    VRM 模型控制层                           │
│        @pixiv/three-vrm                                      │
│        模型渲染 | 表情控制 | 口型同步                        │
├─────────────────────────────────────────────────────────────┤
│                    动作层                                   │
│        DiP (Motion Diffusion) | 预设动画 (Mixamo)           │
│        AI生成动作 或 预设动作切换                           │
├─────────────────────────────────────────────────────────────┤
│                         AI 服务层                           │
│        OpenClaw + Whisper + TTS                             │
│        对话 | 语音识别 | 语音合成                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 详细流程说明

```
Step 1: 用户输入
  │
  ├─ 语音输入
  │   └─> 点击录音按钮 → useAudioRecorder 开始录音
  │       → VAD 检测音量，持续静音 > 800ms 自动停止
  │       → 生成 Audio Blob → 发送到 Whisper 转写
  │
  └─ 文本输入
      └─> 直接在输入框输入文本

Step 2: Agent 处理
  │
  └─> 发送输入到 OpenClaw Agent
      → Agent 理解用户意图
      → 返回结构化数据 {voiceText, emotion, actions, expressions}

Step 3: 前端响应
  │
  ├─ 发起 TTS 请求
  │   └─> 收到音频后播放，同时启动音频分析
  │       → 频谱分析提取口型数据 → 实时驱动 VRM 嘴型
  │
  ├─ 设置表情
  │   └─> useVRMControl.setTargetExpressions({emotion: 1})
  │       → updateExpressions() 每帧执行渐变
  │
  └─ 执行动作
      └─> useVRMControl.executeAction(actionName)
          → 从动作映射表选择对应动画
          → 或调用 DiP 生成 AI 动作
          → 设置定时器，动画结束后自动切换回 Idle
```

---

## 三、模块详细设计

### 3.1 VRMAvatar

**职责**：虚拟形象的渲染和控制，是整个系统的核心组件。

#### 3.1.1 核心功能

| 功能 | 说明 |
|------|------|
| VRM 模型加载 | 使用 @pixiv/three-vrm 加载，支持 VRM 1.0 和 0.x 版本 |
| 骨骼动画播放 | 播放 Mixamo 预制的 FBX 动画，使用 crossfade 平滑过渡 |
| 表情控制 | 通过 expressionManager.setValue() 设置 morphTargetInfluences |
| 随机眨眼 | 随机间隔 3-6 秒的眨眼动画 |
| 头部注视 | 头部跟随鼠标或指定目标点 |

#### 3.1.2 VRM 版本检测

```javascript
// 检测 VRM 版本
const isVRM1 = userData.vrm.meta?.metaVersion === "1";

// 根据版本选择骨骼名称
const spineBone = isVRM1 ? 'spine' : 'Spine';
```

#### 3.1.3 骨骼获取

```javascript
// 获取 VRM 骨骼节点
const bone = vrm.humanoid.getNormalizedBoneNode(boneName);

// 设置骨骼旋转
bone.quaternion.slerp(targetQuaternion, slerpFactor);
```

#### 3.1.4 表情控制机制

VRM 的表情系统是**自动累加**的：
- 每帧开始时，VRM 自动清零所有 morphTargetInfluences
- 然后依次累加每个表情的权重
- 因此直接 setValue 即可，不需要手动计算混合

```javascript
// VRM 每帧自动执行：
// 1. 清零 morphTargetInfluences
expression.clearAppliedWeight();

// 2. 计算每个表情的 multiplier
const multiplier = 1 - sum(expression.overrideMouthAmount);

// 3. 依次累加每个表情
expression.applyWeight({ multiplier });
// → mesh.morphTargetInfluences += weight × multiplier

// 所以直接 setValue 即可
vrm.expressionManager.setValue('happy', 0.8);
vrm.expressionManager.setValue('aa', 0.5); // 自动与 happy 叠加
```

#### 3.1.5 动画播放逻辑

```javascript
// 动画状态管理
const animationStateRef = useRef({
  currentAction: null,  // 当前正在播放的动作
  lastAnimation: null   // 上一次设置的动画
});

// 动画切换逻辑
useEffect(() => {
  // 1. Idle 动画始终在后台运行
  idleAction.reset().play();
  idleAction.fadeIn(animationFadeTime);

  // 2. 如果有新动作，执行 crossfade
  if (targetAnimation && targetAnimation !== 'None') {
    const action = actions[targetAnimation];
    if (action) {
      // 淡出当前动作
      if (currentAction) {
        currentAction.fadeOut(animationFadeTime).play();
      }
      // 淡入新动作
      action.reset().fadeIn(animationFadeTime).play();
      currentAction = action;
    }
  }
}, [targetAnimation]);
```

---

### 3.2 useVRMControl (Zustand Store)

**职责**：虚拟形象的状态管理，充当整个系统的大脑。

#### 3.2.1 状态结构

```javascript
{
  // 表情状态
  expressions: {
    happy: 0, sad: 0, angry: 0, surprised: 0, neutral: 1, relaxed: 0,
    aa: 0, ih: 0, ee: 0, oh: 0, ou: 0,  // 口型
    blinkLeft: 0, blinkRight: 0           // 眨眼
  },

  // 目标表情（用于渐变过渡）
  targetExpressions: { ... },

  // 动作状态
  currentAction: null,         // 当前动作名称
  actionTimer: null,          // 动作定时器（自动切回 Idle）
  animation: null,            // 当前播放的动画名

  // TTS 状态
  isSpeaking: false,           // TTS 播放状态（重要：用这个判断，不是口型值）
  lipSyncExpressions: { aa: 0, ih: 0, ee: 0, oh: 0, ou: 0 },  // TTS 口型数据

  // 控制参数
  lipSyncScale: 0.5,           // TTS 口型幅度
  aiMouthWeight: 0.3,         // AI 表情口型权重
  maxEmotionScale: 1.0,       // 表情幅度上限
  transitionSpeed: 3,         // 表情渐变速度
  animationFadeTime: 1.5      // 动画过渡时间
}
```

#### 3.2.2 核心方法

**表情渐变 (updateExpressions)**

```javascript
updateExpressions: (deltaTime) => {
  const speed = transitionSpeed * deltaTime;
  const newExpressions = { ...expressions };

  // 嘴巴和眼睛不渐变，由其他模块直接控制
  const mouthKeys = ['aa', 'ih', 'ee', 'oh', 'ou'];
  const eyeKeys = ['blinkLeft', 'blinkRight'];

  for (const key in newExpressions) {
    if (mouthKeys.includes(key) || eyeKeys.includes(key)) continue;

    // 表情渐变：current += (target - current) × speed
    if (key in targetExpressions) {
      const current = newExpressions[key];
      const target = targetExpressions[key];
      const diff = target - current;

      if (Math.abs(diff) > 0.01) {
        newExpressions[key] = current + diff * speed;
      } else {
        newExpressions[key] = target;
      }
    }
  }

  set({ expressions: newExpressions });
}
```

**动作执行 (executeAction)**

```javascript
executeAction: (actionName, expressions = null, customDuration = null) => {
  // 1. 清除之前的定时器
  if (actionTimer) clearTimeout(actionTimer);

  // 2. 获取动作持续时间
  const duration = customDuration || ACTION_DURATION[actionName] || 2000;

  // 3. 获取动画名称映射
  const animName = actionAnimationMap[actionName] || actionName;

  // 4. 设置动画
  set({
    animation: actionName === 'none' ? null : animName,
    currentAction: actionName
  });

  // 5. 设置目标表情
  if (expressions) {
    set({ targetExpressions: { ...DEFAULT_EXPRESSIONS, ...expressions } });
  }

  // 6. 设置定时器，动画结束后切换回 Idle
  const timer = setTimeout(() => {
    set({
      animation: "Breathing Idle",
      currentAction: null
    });
  }, duration);

  set({ actionTimer: timer });
  return true;
}
```

#### 3.2.3 动作到动画映射

```javascript
const actionAnimationMap = {
  // 基础待机
  idle: 'Breathing Idle',
  sitting_idle: 'Sitting Idle',
  warrior_idle: 'Warrior Idle',

  // 互动手势
  wave: 'Waving',
  pointing: 'Pointing',
  point: 'Pointing',  // 兼容
  thumbs_up: 'Standing Thumbs Up',
  clap: 'Clapping',
  shrug: 'Shrugging',
  shake: 'Shrugging',  // 兼容

  // 头部动作
  nod: 'Lengthy Head Nod',
  think: 'Thinking',
  thinking: 'Thinking',  // 兼容
  nodding: 'Lengthy Head Nod',  // 兼容
  talking: 'Talking',

  // 移动
  walk: 'Walking',
  running: 'Running',
  walk_turn: 'Walking Turn 180',
  jog_backwards: 'Slow Jog Backwards',

  // 舞蹈
  dance: 'Hip Hop Dancing',
  rumba: 'Rumba Dancing',
  swing: 'Swing Dancing',
  bboy: 'Bboy Hip Hop Move',
  robot: 'Robot Hip Hop Dance',
  silly: 'Silly Dancing',
  thriller: 'Thriller Part 2',

  // 运动/战斗
  jump: 'Jumping',
  punch: 'Punching Bag',
  kick: 'Hurricane Kick',
  shoot: 'Shooting Arrow',
  zombie: 'Zombie Stand Up',

  // 其他
  entry: 'Entry',
  typing: 'Typing',
  none: null
};
```

---

### 3.3 useTTS

**职责**：语音合成和口型同步，是实现虚拟形象"说话"功能的核心模块。

#### 3.3.1 核心功能

| 功能 | 说明 |
|------|------|
| TTS 请求 | 调用本地 TTS 服务生成语音 (端口 9880) |
| 音频播放 | 使用 HTML5 Audio 播放生成的语音 |
| 音频分析 | 使用 Web Audio API 分析频谱 |
| 口型同步 | 提取口型数据并同步到 VRM |

#### 3.3.2 TTS 请求流程

```javascript
const speak = async (text, onPlay) => {
  // 1. 清理之前的播放
  if (audioRef.current) audioRef.current.pause();
  if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

  // 2. 调用 TTS API
  const params = new URLSearchParams({ text, ... });
  const response = await fetch(`/tts?${params}`);
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  // 3. 创建 Audio 并播放
  audioRef.current = new Audio(audioUrl);

  // 4. 播放时启动音频分析
  audioRef.current.onplay = () => {
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    if (onPlay) onPlay();  // 触发回调（执行动作/表情）
  };

  // 5. 播放结束时清理
  audioRef.current.onended = () => {
    setIsSpeaking(false);
    URL.revokeObjectURL(audioUrl);
    window.dispatchEvent(new CustomEvent('ttsEnded'));
  };

  await audioRef.current.play();
};
```

#### 3.3.3 音频分析（频谱分析）

```javascript
const analyzeAudio = () => {
  if (!analyserRef.current || !lipSyncCallbackRef.current) return;

  // 1. 获取频域数据
  const bufferLength = analyserRef.current.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserRef.current.getByteFrequencyData(dataArray);

  // 2. 获取时域数据（计算音量）
  const timeDataArray = new Uint8Array(bufferLength);
  analyserRef.current.getByteTimeDomainData(timeDataArray);

  // 3. 计算 RMS 音量
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = (timeDataArray[i] - 128) / 128;
    sum += v * v;
  }
  const volume = Math.sqrt(sum / bufferLength);

  // 4. 最小音量阈值（避免静音时误触发）
  if (volume < 0.01) {
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    return;
  }

  // 5. 归一化音量
  const normalizedVolume = Math.min(1, volume * 3);

  // 6. 简化版口型映射（用音量驱动 aa）
  const lipSyncScale = useVRMControl.getState().lipSyncScale || 0.5;
  const aa = normalizedVolume > 0.05
    ? Math.min(1, normalizedVolume * lipSyncScale * 2)
    : 0;

  // 7. 发送口型数据
  lipSyncCallbackRef.current({ aa, ih: 0, ee: 0, oh: 0, ou: 0 });

  // 8. 继续分析下一帧
  if (audioRef.current && !audioRef.current.paused) {
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }
};
```

#### 3.3.4 关键设计：用 isSpeaking 判断状态

```javascript
// 错误做法：用口型值判断 TTS 状态
// 原因：TTS 播放中可能有静音段，口型值会低于阈值
if (lipSyncExpressions.aa > 0) {
  // TTS 播放中
} else {
  // TTS 停止  ← 错误！静音不等于停止
}

// 正确做法：用 isSpeaking 判断
if (isSpeaking) {
  // TTS 播放中：AI 表情 + TTS 口型叠加
} else {
  // TTS 停止：切换到 neutral
  setTargetExpressions({ neutral: 1 });
}
```

---

### 3.4 useAudioRecorder

**职责**：用户语音录制，带 VAD (Voice Activity Detection) 自动截断。

#### 3.4.1 核心功能

| 功能 | 说明 |
|------|------|
| 麦克风录音 | 使用 MediaRecorder API 录音 |
| VAD 检测 | 实时分析音量，检测静音 |
| 自动截断 | 静音超过阈值自动停止录音 |
| Blob 输出 | 输出 Audio Blob 供 Whisper 处理 |

#### 3.4.2 VAD 参数

| 参数 | 值 | 说明 |
|------|------|------|
| VAD_THRESHOLD | 15 | 音量阈值，低于此值视为静音 |
| VAD_INTERVAL | 50 | 检测间隔 (ms) |
| SILENCE_THRESHOLD | 800 | 静音阈值 (ms)，超过自动停止 |

---

### 3.5 DiP 动作生成

**职责**：AI 动作生成，使用 DiP (Motion Diffusion Model) 模型根据文本描述生成动作。

#### 3.5.1 什么是 DiP

DiP (Diffusion Planner) 是一个基于 diffusion 模型的 AI 动作生成技术：

- **来源**: https://github.com/guytevet/motion-diffusion-model
- **输入**: 动作描述文本（如 "wave hand"、"dance"、"walking"）
- **输出**: 动作序列数据，格式为 (帧数, 22 关节, 3 坐标) 的位置数据

#### 3.5.2 动作层设计

项目支持两种动作模式：

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **预设动画** | 响应快、稳定 | 动作有限 | 常用动作（挥手、点头等） |
| **DiP 生成** | 自然、灵活 | 需要 GPU | 特殊动作、更多变化 |

#### 3.5.3 AI 回复动作解析

```javascript
// 解析 Mico VRM 的回复（支持两种动作格式）
// 格式1: action (单个动作) - 预设动画版本
// 格式2: actions (动作数组) - DiP 版本
const parseMicoResponse = (responseText) => {
  // 尝试解析 JSON 格式
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      voiceText: parsed.voiceText || parsed.text || '',
      text: parsed.text || '',
      action: parsed.action || null,
      actions: parsed.actions || null,  // DiP 动作序列
      emotion: parsed.emotion || null,
      expressions: parsed.expressions || null
    };
  }
  // ...
};
```

---

## 四、技术实现

### 4.1 服务配置

| 服务 | 端点 | 端口 | 说明 |
|------|------|------|------|
| **OpenClaw** | `/v1/responses` | - | AI 对话大脑 |
| **Whisper** | `/transcribe` | 5000 | 语音识别 |
| **TTS** | `/tts` | 9880 | 语音合成 |

### 4.2 Vite 代理配置

```javascript
// vite.config.js
server: {
  proxy: {
    '/tts': {
      target: 'http://127.0.0.1:9880',
      changeOrigin: true
    },
    '/transcribe': {
      target: 'http://localhost:5000',
      changeOrigin: true
    },
    '/v1': {
      target: 'http://localhost:18789',
      changeOrigin: true
    }
  }
}
```

---

## 五、OpenClaw Agent 配置

### 5.1 目录结构

```
C:\Users\Miss\.openclaw\workspace-mico-vrm\
├── SOUL.md              # Agent 人设配置
├── USER.md              # 用户信息
├── auth-profiles.json   # 认证配置
└── models.json          # 模型配置
```

### 5.2 SOUL.md 配置示例

```markdown
# Mico VRM - 虚拟形象 Agent

## 身份
- 名字: Mico (米可)
- 角色: VRM 虚拟形象 AI 助理

## 回复格式
必须返回 JSON 格式：
{
  "voiceText": "你的回复（用于 TTS）",
  "emotion": "happy|sad|angry|surprised|relaxed|neutral",
  "actions": ["动作1", "动作2"],
  "expressions": {"happy": 0-1, "sad": 0-1}
}
```

### 5.3 Agent 返回格式

```json
{
  "voiceText": "你好，很高兴见到你！",
  "emotion": "happy",
  "actions": ["wave", "nod"],
  "expressions": {
    "happy": 1
  }
}
```

### 5.4 前端调用方式

```javascript
const requestBody = {
  model: "openclaw:mico-vrm",  // 注意：必须加 "openclaw:" 前缀
  input: "你好",
  user: sessionKey  // 保持会话上下文
};

fetch('/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify(requestBody)
});
```

---

## 六、技术栈总结

| 层级 | 技术 | 核心功能 |
|------|------|----------|
| **界面** | React + Tailwind CSS | UI组件 + 样式 |
| **状态** | Zustand | 全局数据管理 |
| **3D渲染** | Three.js + R3F | 场景渲染 |
| **模型** | @pixiv/three-vrm | VRM控制 |
| **动作生成** | DiP | AI生成动作序列 |
| **预设动画** | Mixamo | 快速切换预设动作 |
| **AI对话** | OpenClaw | 智能回复 |
| **语音识别** | Whisper | 录音转文字 |
| **语音合成** | TTS | 文字转语音 + 口型 |

---

## 七、相关技术

### 7.1 VRM

VRM 是虚拟形象专用的 3D 模型格式：
- **官网**: https://vrm-c.github.io/
- **特点**: 自带骨骼、表情、形态目标数据，标准化格式

### 7.2 Whisper

语音识别模型，将录音转换为文字：
- **项目**: https://github.com/openai/whisper

### 7.3 TTS (语音合成)

Text-to-Speech，语音合成技术。本项目使用本地 TTS 服务。

### 7.4 DiP (Motion Diffusion Model)

AI 动作生成技术：
- **项目**: https://github.com/guytevet/motion-diffusion-model
- **原理**: 基于 diffusion 模型的 AI 动作生成

---

## 八、相关项目

- VRM 渲染库: https://github.com/pixiv/three-vrm
- Whisper: https://github.com/openai/whisper
- DiP 动作模型: https://github.com/guytevet/motion-diffusion-model

---

*文档最后更新: 2026-03-29*