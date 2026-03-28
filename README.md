# VRM 数字人系统

> 读取此文件了解项目上下文

---

## 项目状态

| 属性 | 值 |
|------|-----|
| 进度 | 92% (5.5/6) |
| 状态 | 🟢 进行中 |
| 当前里程碑 | M6 - 性能优化与部署 |
| 最后更新 | 2026-03-28 |

---

## 项目目标

开发一个集成 TTS 语音合成和 AI 动作生成的 VRM 数字人前端系统，支持实时对话。

---

## 里程碑

| 状态 | 里程碑 | 完成时间 |
|------|--------|----------|
| ✅ | M1: 基础架构搭建 | 2026-02-24 |
| ✅ | M2: VRM 模型加载与渲染 | 2026-02-24 |
| ✅ | M3: 基础动画系统 | 2026-02-24 |
| ✅ | M4: TTS 语音合成集成 | 2026-03-03 |
| ✅ | M5: 动画系统优化 | 2026-03-28 |
| ⏳ | M6: 性能优化与部署 | 待开始 |

---

## 当前任务

### M5 - 动画系统优化（已完成）

**已完成：**
- [x] MDM/DiP 技术调研
- [x] 确定 DiP 方案
- [x] 动作生成架构设计
- [x] WSL2 DiP 环境部署
- [x] DiP Server 实现 (dip/server.py)
- [x] 前端调用 DiP API (src/hooks/useDipMotion.js)
- [x] 骨骼转换逻辑 (src/utils/dipAnimator.js)
- [x] Vite 代理配置 (/api → 5002)
- [x] DiP 动作生成与播放
- [x] DiP 服务端优化
  - 跳过前 40 帧（2秒）避免不自然动作
  - 单次动作最低 10 秒
- [x] AI 提示词更新 (SOUL.md)

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.0.0 | UI 框架 |
| Three.js | 0.173.0 | 3D 渲染 |
| React Three Fiber | 9.0.4 | React + Three.js |
| @pixiv/three-vrm | 3.4.0 | VRM 模型加载 |
| Zustand | 5.0.11 | 状态管理 |
| Vite | 6.2.0 | 构建工具 |

---

## 依赖服务

| 服务 | 端点 | 路径 |
|------|------|------|
| TTS (GPT-SoVITS) | http://127.0.0.1:9880 | D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604 |
| Mico Agent (OpenClaw) | /v1/responses | Gateway (端口 18789) |
| DiP (WSL2) | http://localhost:5002 | /home/ssim/motion-diffusion-model/dip/server.py |

---

## 快速启动

```bash
# 1. 前端
cd D:\projects\r3f-vrm-final-main
npm run dev

# 2. TTS 服务 (需手动启动)
cd D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
python webui.py

# 3. DiP (WSL2)
wsl
source /home/ssim/miniconda/etc/profile.d/conda.sh conda activate mdm
cd /home/ssim/motion-diffusion-model
python dip/server.py
# 端点: http://localhost:5002/api/generate
```

---

## 项目结构

```
D:\projects\r3f-vrm-final-main\
├── src\                # 前端源码
│   ├── components\     # React 组件
│   ├── hooks\          # 自定义 Hooks
│   ├── stores\         # Zustand 状态
│   └── utils\          # 工具函数
├── server\             # 后端服务
│   ├── app.py          # Flask 主应用
│   ├── dip_api.py      # DiP 动作生成 API
│   └── ws_server.py    # WebSocket 服务
├── docs\               # 设计文档
│   └── design\         # 详细设计
├── archive\            # 归档文件
├── progress.md         # 进度追踪
├── issues.md           # 问题记录
└── project-info.md     # 技术信息
```

---

## 关键知识

### VRM 表情叠加机制
- VRM 每帧自动清零 `morphTargetInfluences`
- 使用 `+=` 累加多个表情
- 直接 `setValue` 即可，无需手动计算

### TTS 表情切换
- 使用 `isSpeaking` 判断播放状态（不是口型值）
- TTS 播放: AI 表情 + TTS 口型叠加
- TTS 停止: 平滑切换到 neutral

### DiP 动作生成
- 模型: `save/dip/model.pt`
- 参数: `--autoregressive --guidance_param 7.5`
- 输出格式: (22关节, 3坐标, N帧) → 跳过前40帧后返回
- 动作时长: 最低 10 秒

### DiP 服务端配置 (2026-03-28)
- 跳过前 40 帧（2秒）避免不自然动作
- 单次动作默认 10 秒
- 支持序列动作连续生成

---

## 待决策

- [ ] 音频播放队列机制
- [ ] 口型同步算法
- [ ] 表情预设系统

---

## 最近工作 (2026-03-28)

1. DiP 服务端优化
   - 跳过前 40 帧
   - 单次动作最低 10 秒
2. AI 提示词更新
   - SOUL.md 添加 DiP 技术说明
   - AI 主动了解 DiP 能力
3. 项目文档更新

---

*每次开发前读取此文件恢复上下文*