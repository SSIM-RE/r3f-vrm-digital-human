# VRM Digital Human

基于 React Three Fiber 的 VRM 数字人系统，支持 TTS 语音合成和 AI 动作生成。

## 项目介绍

这是一个 VRM 虚拟数字人前端应用，具有以下核心功能：

1. **VRM 模型加载与渲染** - 支持加载 VRM 1.0/0.x 格式的虚拟形象
2. **TTS 语音合成** - 集成 GPT-SoVITS 实现中文语音合成
3. **AI 动作生成** - 集成 DiP (Motion Diffusion Model) 生成自然动作
4. **表情系统** - 支持开心、悲伤、惊讶等多种表情
5. **实时对话交互** - 接入 OpenClaw Agent 实现智能对话

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.0.0 | UI 框架 |
| Three.js | 0.173.0 | 3D 渲染 |
| React Three Fiber | 9.0.4 | React + Three.js 绑定 |
| @pixiv/three-vrm | 3.4.0 | VRM 模型加载与控制 |
| Zustand | 5.0.11 | 状态管理 |

## 项目结构

```
r3f-vrm-digital-human/
├── src/
│   ├── components/           # React 组件
│   │   ├── Experience.jsx    # 3D 场景主入口
│   │   ├── VRMAvatar.jsx     # VRM 模型组件（核心）
│   │   ├── UI.jsx            # UI 界面（对话、录音、控制面板）
│   │   └── CameraWidget.jsx  # 相机控制组件
│   │
│   ├── hooks/                 # 自定义 Hooks
│   │   ├── useTTS.js         # TTS 语音合成
│   │   ├── useDipMotion.js  # DiP 动作生成
│   │   ├── useAudioRecorder.js # 麦克风录音（带 VAD）
│   │   └── useVideoRecognition.js # 视频识别（可选）
│   │
│   ├── stores/                # Zustand 状态管理
│   │   └── useVRMControl.js  # VRM 控制状态（表情、动作、口型）
│   │
│   ├── utils/                 # 工具函数
│   │   ├── dipAnimator.js    # DiP 骨骼动画转换
│   │   ├── hmlToVrm.js       # HumanML3D 到 VRM 骨骼映射
│   │   ├── mixamoVRMRigMap.js # Mixamo 动画映射
│   │   └── remapMixamoAnimationToVrm.js # Mixamo 动画转换
│   │
│   ├── App.jsx                # 应用入口
│   ├── main.jsx              # React 入口
│   └── index.css             # 全局样式
│
├── server/                    # 后端服务
│   ├── app.py                # Flask 主应用（Whisper 转写）
│   └── dip_server.py         # DiP Server 包装
│
├── public/                    # 静态资源
│   └── models/
│       ├── *.vrm             # VRM 模型文件
│       └── animations/        # Mixamo 预设动画 (.fbx)
│
├── docs/                      # 设计文档
└── package.json
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 服务依赖

启动项目前需要运行以下外部服务：

| 服务 | 端点 | 说明 |
|------|------|------|
| TTS (GPT-SoVITS) | http://127.0.0.1:9880 | 语音合成服务 |
| DiP (WSL2) | http://localhost:5002 | AI 动作生成服务 |
| OpenClaw Gateway | http://localhost:18789 | AI 对话服务 |

### 启动外部服务

```bash
# 1. TTS 服务
cd D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
python webui.py

# 2. DiP 服务 (WSL2)
wsl -d Ubuntu
source ~/miniconda/etc/profile.d/conda.sh
conda activate mdm
cd ~/motion-diffusion-model
python dip/server.py
```

## 核心功能说明

### 1. VRM 表情系统

- VRM 使用 `morphTargetInfluences` 控制表情
- VRM 每帧自动清零并累加表情权重
- 直接调用 `expressionManager.setValue()` 即可

```javascript
// 设置开心表情
vrm.expressionManager.setValue('happy', 0.8)
```

### 2. TTS 语音合成

- 使用 Web Audio API 分析频谱
- 将音频分为低/中/高频段
- 根据音量驱动口型同步

```javascript
// 调用 TTS
ttsSpeak(text, onPlayCallback)
```

### 3. DiP 动作生成

- DiP 生成的动作数据格式：(帧数, 22关节, 3坐标)
- 需要将 HumanML3D 骨骼映射到 VRM 骨骼
- 跳过前 40 帧避免不自然动作

```javascript
// 生成动作
const motion = await generateMotion('wave hand')
// 逐帧应用到 VRM
applyDipFrame(frameData, vrm)
```

### 4. 骨骼映射

HumanML3D 22 关节顺序：
```
0:Hips, 1:RightUpperLeg, 2:RightLowerLeg, 3:RightFoot,
4:LeftUpperLeg, 5:LeftLowerLeg, 6:LeftFoot,
7:Spine, 8:Chest, 9:Neck, 10:Head,
11:RightUpperArm, 12:RightLowerArm, 13:RightHand,
14:LeftUpperArm, 15:LeftLowerArm, 16:LeftHand,
17:LeftEye, 18:RightEye, 19:Jaw, 20:LeftToes, 21:RightToes
```

VRM 骨骼名称：
```
hips, spine, chest, neck, head,
rightUpperArm, rightLowerArm, rightHand,
leftUpperArm, leftLowerArm, leftHand,
rightUpperLeg, rightLowerLeg, rightFoot,
leftUpperLeg, leftLowerLeg, leftFoot
```

## 配置说明

### Vite 代理配置

项目配置了以下代理（vite.config.js）：

```javascript
{
  '/tts': 'http://127.0.0.1:9880',
  '/api': 'http://localhost:5002',
  '/v1': 'http://localhost:18789',
  '/set_gpt_weights': 'http://127.0.0.1:9880'
}
```

### VRM 模型

默认使用 `public/models/Mico_V2.vrm`

## 常见问题

1. **VRM 模型不显示** - 检查模型路径是否正确
2. **TTS 无声音** - 确认 GPT-SoVITS 服务已启动
3. **DiP 动作不生效** - 确认 WSL2 DiP 服务已启动
4. **表情不生效** - 检查 VRM 版本（1.0 vs 0.x）对应的表情名称

## License

MIT