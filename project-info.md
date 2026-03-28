# 项目技术信息

> 最后更新: 2026-03-18

---

## 系统架构

```
用户语音输入
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  前端 (React + R3F)                                    │
│  • 录音 → Whisper 转写 (server/app.py, 端口 5000)    │
│  • 调用 Mico Agent → /v1/responses (Vite 代理)        │
└─────────────────────────────────────────────────────────┘
      │
      ▼ (HTTP POST /v1/responses)
┌─────────────────────────────────────────────────────────┐
│  OpenClaw Gateway (端口 18789)                         │
│  → 转发给 Mico VRM Agent                              │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  Mico VRM Agent                                        │
│  • 返回 JSON: { text, emotion, action, expressions }   │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  前端执行                                               │
│  • TTS: /tts → GPT-SoVITS (9880)                      │
│  • 动作: executeAction() → Mixamo 动画                 │
│  • 表情: setTargetExpressions()                         │
│  • DiP (未来): http://localhost:5002/api/generate      │
└─────────────────────────────────────────────────────────┘
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.0.0 | UI 框架 |
| Three.js | 0.173.0 | 3D 渲染 |
| React Three Fiber | 9.0.4 | React + Three.js |
| @pixiv/three-vrm | 3.4.0 | VRM 模型 |
| Zustand | 5.0.11 | 状态管理 |
| Vite | 6.2.0 | 构建工具 |

---

## 项目结构

```
D:\projects\r3f-vrm-final-main\
├── src\                # 前端源码
│   ├── components\     # React 组件
│   ├── hooks\         # 自定义 Hooks
│   ├── stores\        # Zustand 状态
│   └── utils\         # 工具函数
├── server\             # 后端服务
│   ├── app.py         # Flask - Whisper 转写 (端口 5000)
│   └── dip_api.py     # DiP 动作生成 API (旧版本)
├── public\             # 静态资源
├── archive\            # 归档文件
├── README.md           # 项目单一信息来源
├── progress.md         # 进度追踪
├── issues.md           # 问题记录
└── project-info.md     # 技术信息
```

---

## 技术决策

### 状态管理: Zustand
- 原因: API 简洁，性能优秀，无需 Provider 包裹
- 影响: 整个应用状态管理

### 构建工具: Vite
- 原因: 启动快，HMR 优秀

### TTS 服务: GPT-SoVITS
- 路径: D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
- 端点: http://127.0.0.1:9880
- 参考音频: D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604\koli_ref.wav

### 动作生成: DiP (Motion Diffusion Model)
- 路径: /home/ssim/motion-diffusion-model (WSL2)
- 启动: `source /home/ssim/miniconda/etc/profile.d/conda.sh conda activate mdm && cd /home/ssim/motion-diffusion-model && python dip/server.py`
- 端口: 5002
- API 端点: POST http://localhost:5002/api/generate
- 模型: save/dip/model.pt
- 输出: motion (位置) + quaternions (四元数)

### WSL2 DiP Server (正在使用)
- 位置: /home/ssim/motion-diffusion-model/dip/server.py
- 启动: `conda activate mdm && python dip/server.py`
- 端口: 5002
- 内置四元数转换（通过 IK）
- 输出: motion (位置) + quaternions (四元数)

### Mico VRM Agent (OpenClaw)
- 端点: /v1/responses (Vite 代理到 18789)
- 工作目录: C:\Users\Miss\.openclaw\workspace-mico-vrm
- 返回格式: { text, emotion, action, expressions }

---

## 动作生成架构

### 方案: DiP 自回归
- 缓冲区: 6 个动作 (12秒)
- 触发: 缓冲区 < 6 时生成
- 队列: 新指令覆盖待生成队列
- 衔接: DiP 自动处理

### 动作提示词映射
| AI 动作 | DiP 提示词 |
|---------|------------|
| wave | wave hand |
| nod | nod head |
| idle | stand still |

---

## 关键 API

### TTS
```bash
POST http://127.0.0.1:9880/tts
{
  "text": "要合成的文本",
  "text_lang": "zh",
  "ref_audio_path": "D:\\AI\\OpenClaw\\GPT-SoVITS-v2pro-20250604\\koli_ref.wav",
  "prompt_text": "",
  "prompt_lang": "zh"
}
```

### DiP 生成
```bash
python -m sample.generate \
  --model_path ./save/dip_model/model000200000.pt \
  --autoregressive \
  --guidance_param 7.5 \
  --dynamic_text_path motions.txt \
  --num_samples 1
```

---

## 启动命令

```bash
# 前端
cd D:\projects\r3f-vrm-final-main
npm run dev

# TTS 服务
cd D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
python webui.py

# DiP (WSL2)
wsl
cd ~/motion-diffusion-model
python -m sample.generate ...
```

---

## 技术笔记

### VRM 表情叠加机制
- VRM 每帧自动清零 morphTargetInfluences
- 使用 `+=` 累加多个表情
- 直接 setValue 即可，无需手动计算

### TTS 表情切换
- 使用 isSpeaking 判断播放状态（不是口型值）
- TTS 播放: AI 表情 + TTS 口型叠加
- TTS 停止: 平滑切换到 neutral

### MDM/DiP 数据格式
- 输出: (样本数, 22关节, 3坐标, 40帧)
- 关节: HumanML3D 格式 (0:root, 1-4:右腿, 5-8:左腿, 9-13:脊柱, 14-17:右臂, 18-21:左臂)
- 需要转换为 VRM 骨骼

---

## 待决策
- [ ] 音频播放队列机制
- [ ] 口型同步算法
- [ ] 表情预设系统
