# VRM 数字人系统

> 基于 React + R3F + DiP 动作生成的 VRM 数字人

---

## 项目状态

| 属性 | 值 |
|------|-----|
| 进度 | 92% (5.5/6) |
| 状态 | 🟢 进行中 |
| 当前里程碑 | M6 - 性能优化与部署 |

---

## 里程碑

| 状态 | 里程碑 | 完成时间 |
|------|--------|----------|
| ✅ | M1: 基础架构搭建 | 2026-02-24 |
| ✅ | M2: VRM 模型加载与渲染 | 2026-02-24 |
| ✅ | M3: 基础动画系统 | 2026-02-24 |
| ✅ | M4: TTS 语音合成集成 | 2026-03-03 |
| ✅ | M5: 动画系统优化 (DiP) | 2026-03-28 |
| ⏳ | M6: 性能优化与部署 | 待开始 |

---

## 快速启动

```bash
# 1. 前端
cd D:\projects\r3f-vrm-final-main
npm run dev

# 2. TTS (需手动启动)
cd D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
python webui.py

# 3. DiP (WSL2)
wsl -d Ubuntu
source ~/miniconda/etc/profile.d/conda.sh
conda activate mdm
cd ~/motion-diffusion-model
python dip/server.py
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

---

## 依赖服务

| 服务 | 端点 | 说明 |
|------|------|------|
| TTS | http://127.0.0.1:9880 | GPT-SoVITS |
| DiP | http://localhost:5002 | WSL2 动作生成 |
| Mico Agent | /v1/responses → 18789 | OpenClaw Gateway |

---

## 项目结构

```
r3f-vrm-final-main/
├── src/              # 前端源码
│   ├── components/   # React 组件
│   ├── hooks/        # 自定义 Hooks
│   ├── stores/       # Zustand 状态
│   └── utils/        # 工具函数
├── server/           # 后端服务
├── public/           # VRM 模型 + 动画
├── docs/             # 设计文档
└── package.json
```

---

## 技术要点

### VRM 表情叠加
- VRM 每帧自动清零 + 累加 `morphTargetInfluences`
- 直接 `setValue` 即可，无需手动计算

### DiP 骨骼转换
- 翻转 Z 轴
- 手掌骨骼 = 单位四元数
- 交换左右手臂索引
- 跳过前 40 帧（2秒）
- 单次动作最低 10 秒

---

## 已解决问题

### TTS 表情叠加
- 使用 `isSpeaking` 判断播放状态
- VRM 自动累加多个表情

### DiP 动作方向
- 交换左右手臂索引解决方向反向问题
- 手掌骨骼设为单位四元数

---

## 待决策

- [ ] 音频播放队列机制
- [ ] 口型同步算法
- [ ] 表情预设系统

---

## 风险

- TTS/DiP 服务需手动启动
- WSL2 环境依赖

---

*每次开发前读取此文件恢复上下文*