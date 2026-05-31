<div align="center">

# 🎬 APIReplay-CLI

**Lightweight Terminal HTTP API Traffic Recording & Intelligent Replay Engine**

**轻量级终端HTTP API流量录制与智能回放引擎**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/zero-dependencies-success.svg)]()

[English](#english) | [简体中文](#simplified-chinese) | [繁體中文](#traditional-chinese)

</div>

---

<a name="english"></a>
## 🌟 English

### 🎉 Introduction

APIReplay-CLI is a **zero-dependency**, lightweight terminal tool for recording, replaying, and analyzing HTTP API traffic. It helps developers capture real production traffic and replay it against different environments for testing, debugging, and regression detection.

**Key Differentiators:**
- 🚀 **Zero Dependencies** - Pure Node.js implementation, no external dependencies
- 🎯 **Lightweight** - Minimal resource footprint, perfect for CI/CD pipelines
- 🖥️ **TUI Dashboard** - Interactive terminal interface for easy operation
- 🔍 **Smart Diff** - Intelligent comparison with dynamic field filtering
- 📊 **Multiple Formats** - Export to HAR, cURL, Postman, OpenAPI

### ✨ Core Features

| Feature | Description |
|---------|-------------|
| 🎥 **Traffic Recording** | Transparent HTTP proxy to capture real API traffic |
| ▶️ **Traffic Replay** | Replay recorded requests against any target environment |
| 🎭 **Mock Server** | Start a mock server from recorded traffic |
| 🔍 **Diff Comparison** | Compare responses between two environments |
| 📤 **Export** | Export to HAR, cURL, Postman collection, OpenAPI spec |
| 🖥️ **TUI Dashboard** | Interactive terminal UI for visual operation |

### 🚀 Quick Start

```bash
# Install
npm install -g apireplay-cli

# Record traffic
apireplay record --target http://localhost:8080 --port 3000 --out traffic.json

# Replay traffic
apireplay replay --file traffic.json --target http://staging.example.com

# Start mock server
apireplay mock --file traffic.json --port 8080

# Compare environments
apireplay diff --file traffic.json --primary http://api1.com --secondary http://api2.com

# Launch TUI
apireplay tui
```

### 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<a name="simplified-chinese"></a>
## 🇨🇳 简体中文

### 🎉 项目介绍

APIReplay-CLI 是一个**零依赖**的轻量级终端工具，用于录制、回放和分析 HTTP API 流量。它帮助开发者捕获真实的生产流量，并在不同环境中回放，用于测试、调试和回归检测。

**核心差异化亮点：**
- 🚀 **零依赖** - 纯 Node.js 实现，无任何外部依赖
- 🎯 **轻量级** - 极小的资源占用，完美适配 CI/CD 流水线
- 🖥️ **TUI 仪表板** - 交互式终端界面，操作便捷
- 🔍 **智能差异对比** - 支持动态字段过滤的智能比较
- 📊 **多格式导出** - 支持 HAR、cURL、Postman、OpenAPI 格式

### ✨ 核心特性

| 特性 | 描述 |
|------|------|
| 🎥 **流量录制** | 透明 HTTP 代理，捕获真实 API 流量 |
| ▶️ **流量回放** | 将录制的请求回放到任意目标环境 |
| 🎭 **Mock 服务器** | 基于录制流量启动 Mock 服务器 |
| 🔍 **差异对比** | 对比两个环境的响应差异 |
| 📤 **格式导出** | 导出为 HAR、cURL、Postman 集合、OpenAPI 规范 |
| 🖥️ **TUI 仪表板** | 交互式终端 UI，可视化操作 |

### 🚀 快速开始

```bash
# 安装
npm install -g apireplay-cli

# 录制流量
apireplay record --target http://localhost:8080 --port 3000 --out traffic.json

# 回放流量
apireplay replay --file traffic.json --target http://staging.example.com

# 启动 Mock 服务器
apireplay mock --file traffic.json --port 8080

# 对比环境
apireplay diff --file traffic.json --primary http://api1.com --secondary http://api2.com

# 启动 TUI
apireplay tui
```

### 📄 开源协议

MIT 协议 - 详见 [LICENSE](LICENSE)

---

<a name="traditional-chinese"></a>
## 🇹
