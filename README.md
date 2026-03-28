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

| 技术 | 版本 |
|------|------|
| React | 19.0.0 |
| Three.js | 0.173.0 |
| React Three Fiber | 9.0.4 |
| @pixiv/three-vrm | 3.4.0 |
| Zustand | 5.0.11 |

---

## 依赖服务

| 服务 | 端点 |
|------|------|
| TTS | http://127.0.0.1:9880 |
| DiP | http://localhost:5002 |
| Mico Agent | /v1/responses (代理到 18789) |

---

## 项目结构

```
r3f-vrm-final-main/
├── src/              # 前端源码
├── server/           # 后端服务
├── public/           # VRM 模型 + 动画
├── docs/             # 设计文档
├── package.json
├── progress.md       # 进度追踪
├── issues.md         # 问题记录
└── project-info.md   # 技术信息
```

---

## 文档

- [进度追踪](progress.md)
- [问题记录](issues.md)
- [技术信息](project-info.md)

---

*每次开发前读取此文件恢复上下文*