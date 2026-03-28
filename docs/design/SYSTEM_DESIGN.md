# VRM 数字人系统设计文档

> 详细设计思路和技术实现说明

---

## 一、系统概述

### 1.1 目标

构建一个集成 OpenClaw Agent 的 VRM 虚拟数字人，实现：
- 语音/文本输入 → AI 对话理解
- TTS 语音输出 + 口型同步
- 动作生成 + 表情控制

### 1.2 核心挑战

| 挑战 | 描述 | 解决思路 |
|------|------|----------|
| 多模态同步 | 语音、动作、表情需要协调 | 状态机管理，按时间顺序触发 |
| 实时响应 | 用户输入后快速反馈 | 预设动画优先，AI 生成作为增强 |
| 自然动作 | AI 动作要符合人类习惯 | DiP 动作生成 + 骨骼映射 |
| VRM 兼容性 | 不同版本骨骼/表情不同 | 版本检测 + 条件分支 |

---

## 二、整体架构

### 数据流

```
用户输入 (语音/文本)
       │
       ▼
┌─────────────────────────────┐
│      OpenClaw Agent         │
│   返回: {voiceText,        │
│          emotion,          │
│          actions,          │
│          expressions}      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│              前端处理                   │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ TTS      │ │ 表情控制 │ │ 动作   │ │
│  │ 语音+口型│ │ setValue │ │ 播放   │ │
│  └──────────┘ └──────────┘ └────────┘ │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│         VRMAvatar          │
│    (虚拟形象渲染呈现)       │
└─────────────────────────────┘
```

---

## 三、模块设计

### 3.1 VRMAvatar

**职责**：虚拟形象渲染和控制

**核心功能**：
- VRM 模型加载（支持 VRM 1.0 和 0.x）
- 骨骼动画播放（Mixamo FBX 动画）
- 表情控制（setValue 设置 morphTargetInfluences）
- 眨眼逻辑（随机间隔）
- 注视功能（头部跟随）

**关键设计**：
- 预设动画 + AI 动画的优先级管理
- 动画 fadeIn/fadeOut 平滑过渡
- 播放 DiP 动作时暂停内置动画系统

---

### 3.2 useVRMControl (Store)

**职责**：状态管理

**状态结构**：
```javascript
{
  expressions: { happy: 0, sad: 0, ... },     // 当前值
  targetExpressions: { happy: 1, ... },       // 目标值（渐变用）
  animation: "Waving",                        // 当前动画
  isSpeaking: false,                          // TTS 播放状态
  lipSyncExpressions: { aa: 0, ih: 0, ... }, // 口型数据
  lipSyncScale: 0.5,                          // 口型幅度
  transitionSpeed: 3,                         // 表情渐变速度
  animationFadeTime: 1.5                       // 动画过渡时间
}
```

**核心方法**：
- `setTargetExpressions()` - 设置目标表情
- `updateExpressions()` - 每帧渐变
- `executeAction()` - 执行动作（带定时自动恢复）
- `setLipSyncExpressions()` - 设置口型数据

---

### 3.3 useTTS

**职责**：语音合成和口型同步

**核心功能**：
- 调用 TTS 服务生成语音
- 音频分析（Web Audio API + AnalyserNode）
- 频谱分析提取口型数据

**频谱映射**：
- 低频 (0-1300Hz) → aa (啊)
- 中频 (1300-4300Hz) → ih, ee
- 高频 (4300+) → oh, ou

**关键设计**：用 `isSpeaking` 判断状态，不是口型值

---

### 3.4 useDipMotion

**职责**：AI 动作生成（可选功能）

**什么是 DiP**：Diffusion Planner，动作生成模型，根据文本描述生成动作。

**骨骼映射**：
- HumanML3D 22 关节 → VRM 骨骼
- 翻转 Z 轴坐标
- 手掌骨骼设为单位四元数
- 跳过前 40 帧（不稳定）

---

### 3.5 useAudioRecorder

**职责**：用户语音录制

**核心功能**：
- 麦克风录音（MediaRecorder）
- VAD 检测，自动截断静音

**参数**：
- 音量阈值: 15
- 检测间隔: 50ms
- 静音阈值: 800ms

---

## 四、技术实现

### 4.1 TTS 配置 (GPT-SoVITS)

**端点**: `/tts` (端口 9880)

**请求参数**：
| 参数 | 说明 |
|------|------|
| text | 要合成的文本 |
| text_lang | 文本语言 (zh/en/ja...) |
| ref_audio_path | 参考音频路径 |
| prompt_text | 参考音频文本 |
| speed_factor | 语速，默认 1.0 |

### 4.2 Vite 代理配置

```javascript
server: {
  proxy: {
    '/tts': 'http://127.0.0.1:9880',
    '/api': 'http://localhost:5002',
    '/v1': 'http://localhost:18789'
  }
}
```

### 4.3 VRM 表情控制

```javascript
// VRM 每帧自动清零 + 累加
// 直接 setValue 即可
vrm.expressionManager.setValue('happy', 0.8);
```

### 4.4 动作执行流程

```
1. executeAction("wave")
2. 设置 animation: "Waving"
3. 启动定时器（默认 4000ms）
4. 动画播放
5. 定时器触发 → 切换回 Idle
```

---

## 五、OpenClaw Agent 配置

### 5.1 目录结构

```
C:\Users\Miss\.openclaw\workspace-mico-vrm\
├── SOUL.md              # Agent 人设
├── USER.md              # 用户信息
├── auth-profiles.json   # 认证配置
└── models.json          # 模型配置
```

### 5.2 Agent 返回格式

```json
{
  "voiceText": "你好，很高兴见到你！",
  "emotion": "happy",
  "actions": ["wave"],
  "expressions": {"happy": 1}
}
```

### 5.3 前端调用

```javascript
fetch('/v1/responses', {
  method: 'POST',
  body: JSON.stringify({
    model: "openclaw:mico-vrm",
    input: "你好",
    user: "session-001"
  })
})
```

---

## 六、动作实现方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| **预设动画** | Mixamo 预制 FBX 动画 | 常用动作（挥手、点头等） |
| **DiP 生成** | AI 根据文本生成动作 | 特殊动作、自然效果 |

---

## 七、相关技术

- **VRM**: 虚拟形象 3D 模型格式 - https://vrm-c.github.io/
- **TTS**: GPT-SoVITS - https://github.com/RVC-Boss/GPT-SoVITS
- **DiP**: 动作生成模型 - https://github.com/MotionDiffusionModel/MotionDiffusionModel

---

*文档最后更新: 2026-03-28*