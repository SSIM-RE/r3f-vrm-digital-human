# VRM 虚拟数字人 × OpenClaw

## 项目介绍

这是一个集成 OpenClaw Agent 的 VRM 虚拟形象设计雏形。

在人与虚拟形象交互时，我们希望虚拟形象不仅仅是"能看"，更希望它能"会听、会说、有表情、有动作"。这个项目探索了一种实现思路：将 OpenClaw Agent 作为"大脑"，结合前端技术控制虚拟形象的语音、表情和动作，实现自然的人机交互。

---

## 功能说明

这个虚拟形象能做什么：

1. **智能对话** 
   - 用户通过语音或文本输入
   - OpenClaw Agent 理解用户意图
   - 返回结构化回复（包含回复内容、情绪、动作指令）

2. **语音输出** 
   - 将 Agent 返回的文本通过 TTS 转为语音
   - 虚拟形象同步播放音频

3. **表情变化**
   - 解析 Agent 返回的情绪指令（如 happy、sad、surprised）
   - 平滑过渡到对应表情

4. **动作配合**
   - 解析 Agent 返回的动作指令（如 wave、nod、dance）
   - 播放对应的动画
   - 支持两种实现方式：
     - **预设动画**：使用 Mixamo 预制动画，快速稳定
     - **DiP 生成**：AI 根据文本描述生成动作，更自然灵活

5. **口型同步**
   - 分析 TTS 音频，提取口型数据
   - 实时驱动虚拟形象的嘴型

---

## 设计结构

### 数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户输入                                    │
│                    (语音输入 / 文本输入)                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┴────────────────────────┐
        │                                                 │
        ▼                                                 ▼
┌───────────────────┐                        ┌───────────────────┐
│  useAudioRecorder │                        │    文本输入       │
│  (麦克风录音+VAD)  │                        │                   │
└────────┬──────────┘                        └────────┬──────────┘
         │                                             │
         │         ┌──────────────────────────────────┘
         │         │
         ▼         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Agent                                  │
│  输入: 用户意图                                                          │
│  输出: {voiceText, emotion, actions[], expressions{}}                 │
│        │                                                              │
│        │ 示例:                                                         │
│        │ {                                                            │
│        │   "voiceText": "你好，很高兴见到你！",                       │
│        │   "emotion": "happy",                                        │
│        │   "actions": ["wave"],                                       │
│        │   "expressions": {"happy": 1}                                │
│        │ }                                                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────────┐
              │            前端解析处理                   │
              │   解析 Agent 返回的结构化数据              │
              └────────────────────┬───────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│       TTS          │  │       表情          │  │       动作          │
│                    │  │                     │  │                     │
│ 1. 发起语音合成    │  │ 1. 解析 emotion    │  │ 1. 解析 actions    │
│ 2. 获取音频URL    │  │ 2. 设置目标表情    │  │ 2. 选择动画        │
│ 3. 创建 Audio     │  │ 3. 渐变过渡        │  │ 3. 播放动画        │
│ 4. 播放音频       │  │                    │  │ 4. 定时切换回Idle  │
│ 5. 启动音频分析   │  │                    │  │                    │
│    提取口型       │  │                    │  │                    │
└────────┬──────────┘  └────────┬──────────┘  └────────┬──────────┘
         │                     │                        │
         └─────────────────────┼────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    VRMAvatar       │
                    │   (虚拟形象渲染)    │
                    │                    │
                    │ • 播放音频          │
                    │ • 应用表情          │
                    │ • 应用骨骼动画      │
                    └─────────────────────┘
```

### 详细流程说明

```
Step 1: 用户输入
  ├── 语音: 点击录音按钮 → useAudioRecorder 开始录音
  │         → VAD 检测到静音 > 800ms → 自动停止
  │         → 生成 Audio Blob
  │         → 发送到后端转写 (可选) 或直接发送文本
  └── 文本: 直接输入文本

Step 2: Agent 处理
  └── 发送输入到 OpenClaw Agent
       → Agent 理解意图
       → 返回结构化数据

Step 3: 前端响应
  ├── 发起 TTS 请求
  │   └── 收到音频后，播放并分析频谱 → 口型同步
  │
  ├── 设置表情
  │   └── useVRMControl.setTargetExpressions()
  │       → updateExpressions() 每帧渐变
  │
  └── 执行动作
      └── useVRMControl.executeAction()
          → 选择预设动画 或 调用 useDipMotion
          → 设置定时器，动画结束后切换回 Idle
```

---

## 模块说明

### VRMAvatar

**职责**：虚拟形象的渲染和控制

**核心功能**：
- VRM 模型加载（支持 VRM 1.0 和 0.x）
- 骨骼动画播放（Mixamo FBX 动画）
- 表情控制（setValue 设置 morphTargetInfluences）
- 眨眼逻辑（随机间隔的眨眼动画）
- 注视功能（头部跟随）

**关键设计**：
- 预设动画 + AI 动画的优先级管理
- 动画 fadeIn/fadeOut 平滑过渡
- 播放 DiP 动作时暂停内置动画系统

---

### useVRMControl (Store)

**职责**：虚拟形象状态管理

**状态结构**：
```javascript
{
  // 表情
  expressions: { happy: 0, sad: 0, angry: 0, ... },     // 当前值
  targetExpressions: { happy: 1, ... },                  // 目标值

  // 动作
  animation: "Waving",                                    // 当前动画
  actionTimer: timeout,                                   // 动作定时器

  // TTS
  isSpeaking: false,                                      // 播放状态
  lipSyncExpressions: { aa: 0, ih: 0, ... },            // 口型数据

  // 参数
  lipSyncScale: 0.5,                                      // 口型幅度
  transitionSpeed: 3,                                     // 表情渐变速度
  animationFadeTime: 1.5                                 // 动画过渡时间
}
```

**核心方法**：
- `setTargetExpressions()` - 设置目标表情（用于渐变）
- `updateExpressions()` - 每帧调用，执行渐变
- `executeAction()` - 执行动作（带定时自动恢复）
- `setLipSyncExpressions()` - 设置口型数据

---

### useTTS

**职责**：语音合成和口型同步

**核心功能**：
- 调用 TTS 服务生成语音
- 音频分析（Web Audio API + AnalyserNode）
- 频谱分析提取口型数据
- 播放状态管理

**关键设计**：
- 频谱分段映射：将音频分为低/中/高频段
- 低频 → aa (啊)
- 中频 → ih, ee
- 高频 → oh, ou
- 用 `isSpeaking` 判断状态（不是口型值）

---

### useDipMotion

**职责**：AI 动作生成（可选功能）

**什么是 DiP**：DiP (Diffusion Planner) 是一个动作生成模型，可以根据文本描述生成对应的动作。例如输入"wave hand"，模型会生成一段挥手动作。

**核心功能**：
- 调用 DiP 服务生成动作
- 骨骼映射（HML 骨骼 → VRM 骨骼）
- 逐帧应用动作到 VRM

**骨骼映射**：
- HumanML3D 22 关节 → VRM 骨骼
- 翻转 Z 轴坐标
- 手掌骨骼设为单位四元数
- 跳过前 40 帧（不稳定）

**两种方式的选择**：
- 常用动作（挥手、点头等）→ 用预设动画
- 特殊动作或需要更自然的效果 → 用 DiP 生成

---

### useAudioRecorder

**职责**：用户语音录制

**核心功能**：
- 麦克风权限管理
- MediaRecorder 录音
- VAD (Voice Activity Detection) 检测
- 自动截断静音片段

**参数**：
- 音量阈值: 15
- 检测间隔: 50ms
- 静音阈值: 800ms（超过自动停止）

---

## 技术栈

- React + React Three Fiber
- @pixiv/three-vrm (VRM 渲染)
- Zustand (状态管理)
- Vite (构建工具)

---

## 相关技术介绍

### VRM

VRM 是虚拟形象专用的 3D 模型格式，广泛应用于虚拟主播、游戏中。

- **特点**：自带骨骼、表情、形态目标数据
- **优势**：标准化的虚拟形象格式，不同引擎之间可以通用
- **官网**：https://vrm-c.github.io/

### TTS (语音合成)

Text-to-Speech，将文字转换为语音的技术。

- **本项目使用**：GPT-SoVITS
- **特点**：支持中文语音合成，效果自然
- **项目地址**：https://github.com/RVC-Boss/GPT-SoVITS

### DiP (Diffusion Planner)

动作生成模型，可以根据文本描述生成对应的动作。

- **原理**：基于 diffusion 模型的 AI 动作生成
- **输入**：动作描述文本（如 "wave hand"、"dance"）
- **输出**：动作序列数据
- **项目地址**：https://github.com/MotionDiffusionModel/MotionDiffusionModel

---

## 相关项目

- **VRM 渲染库**：https://github.com/pixiv/three-vrm
- **GPT-SoVITS**：https://github.com/RVC-Boss/GPT-SoVITS
- **DiP 动作模型**：https://github.com/MotionDiffusionModel/MotionDiffusionModel

---

*如需了解更多技术细节，可参考 [详细设计文档](docs/design/SYSTEM_DESIGN.md)*