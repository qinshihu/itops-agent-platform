[English](README.en.md) | [中文](README.md)

---

**Important License Change Notice (2026-05-27)**

Effective May 27, 2026, all new code submissions are open-sourced under the **Mozilla Public License 2.0 (MPL-2.0)**. Code submitted before 16:00, May 27, 2026 remains under the original MIT license. Closed-source derivative works, packaged sales, and SaaS operations are prohibited. This project is permanently open-source. It belongs to thousands of engineers who embrace the open-source spirit, not a single company.

👤 Author: Tan Ce | IT Online

---

<br/>

<h1 align="center">⚡ ITOps Agent Platform</h1>
<p align="center">
  <strong>AI Multi-Agent Enterprise IT Operations Automation</strong>
  <br/>
  Open-Source · Alternative to PagerDuty + Rundeck + Portainer + vCenter
  <br/>
  <em>Alert → Diagnose → Remediate → Approve → Verify — All in One Platform</em>
</p>

<p align="center">
  <a href="https://github.com/qinshihu/itops-agent-platform/actions/workflows/ci.yml"><img src="https://github.com/qinshihu/itops-agent-platform/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/qinshihu/itops-agent-platform/releases/latest"><img src="https://img.shields.io/github/v/release/qinshihu/itops-agent-platform?sort=semver" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
  <a href="https://github.com/qinshihu/itops-agent-platform"><img src="https://img.shields.io/github/stars/qinshihu/itops-agent-platform?style=social" alt="Stars"></a>
  <a href="https://github.com/qinshihu/itops-agent-platform/issues"><img src="https://img.shields.io/github/issues/qinshihu/itops-agent-platform" alt="Issues"></a>
  <br/>
  <a href="https://gitee.com/IT_Oline/itops-agent-platform"><img src="https://img.shields.io/badge/Gitee-Repo-C71D23?logo=gitee" alt="Gitee"></a>
  <a href="https://gitcode.com/gcw_IM7aAihp/itops-agent-platform"><img src="https://img.shields.io/badge/GitCode-Repo-FF6600?logo=git" alt="GitCode"></a>
  <br/>
  <img src="https://img.shields.io/badge/Agents-12-blueviolet" alt="12 Agents">
  <img src="https://img.shields.io/badge/API_Routes-67-success" alt="67 API Routes">
  <img src="https://img.shields.io/badge/Services-72-blue" alt="72 Services">
  <img src="https://img.shields.io/badge/Frontend_Pages-63-orange" alt="63 Pages">
  <img src="https://img.shields.io/badge/Workflows-10-teal" alt="10 Workflows">
  <br/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs" alt="Node.js">
  <img src="https://img.shields.io/badge/Docker-🐳-2496ED?logo=docker" alt="Docker">
  <br/>
  <a href="https://star-history.com/#qinshihu/itops-agent-platform&Date">
    <img src="https://api.star-history.com/svg?repos=qinshihu/itops-agent-platform&type=Date" alt="Star History Chart" width="480" />
  </a>
</p>

📝 [Project Vision](项目愿景与社区共建.md) &nbsp;|&nbsp; 📖 [Documentation](https://aiopsdoc-0mwug01t6.maozi.io/) &nbsp;|&nbsp; 🎮 [Live Demo](https://agentdemo-0mwug01t6.maozi.io/)

🌐 Website: <https://www.zjzwfw.cloud/ITOpsAgentinfo>

📦 Repositories: [GitHub](https://github.com/qinshihu/itops-agent-platform) &nbsp;|&nbsp; [Gitee](https://gitee.com/IT_Oline/itops-agent-platform) &nbsp;|&nbsp; [GitCode](https://gitcode.com/gcw_IM7aAihp/itops-agent-platform)

---

## 🎯 Who's This For?

| Role | Pain Point | How This Platform Solves It |
|------|-----------|---------------------------|
| **Ops Engineer** | Woken up at 3 AM by alerts, manual SSH troubleshooting | AI auto-diagnoses root cause → approval push → one-tap fix |
| **SRE / DevOps** | Switching between multiple tools, siloed information | Alert + Diagnose + Execute + Approve in one platform |
| **IT Manager / CTO** | Ops fully dependent on people, incident response is luck-based | Automated inspection + self-healing, free humans from repetitive work |
| **SMB IT Teams** | Can't afford PagerDuty / Rundeck licenses | Feature parity, open-source, data stays on-prem |
| **Security & Compliance** | No approval or audit trail for remediation actions | HITL approval + full audit + command safety filtering |

---

## Why This Project Exists

It's 3 AM. Your server CPU just spiked to 99%. The traditional flow:

```
Alert → Wake up → VPN login → SSH in → Run diagnostic commands → Search docs → Fix → Write report → Go back to bed
```

**30-60 minutes, and you could have been sleeping.**

ITOps Agent Platform transforms this into:

```
Alert triggers → AI auto-diagnoses root cause → Generates remediation commands → Pushes to phone for approval → One-tap execute → Auto-verify → Report generated
```

**3 minutes. All you do is tap "Approve" on your phone.**

---

## 🚀 The Ultimate Form of IT Ops: From Automation to Autonomy

ITOps Agent Platform is not just another ops tool — it targets the **ultimate evolution of IT operations**: AI-powered fully autonomous operations.

```
Manual Ops  →  Script Automation  →  Platformization  →  AI-Assisted  →  🤖 Autonomous Ops (This Project)
   2000s          2010s                2020s               2024+              Now & Future
```

| Evolution Stage | Characteristics | Human Role |
|----------------|-----------------|-------------|
| Manual Ops | SSH, typing commands | Executor |
| Script Automation | Shell / Python semi-automation | Script maintainer |
| Platformization | Ansible / Prometheus / Terraform | Platform operator |
| AI-Assisted | Copilot suggestions, alert analysis | Decision maker |
| **AI Autonomous Ops** | **AI Agent full closed-loop: Sense → Diagnose → Decide → Execute → Verify** | **Supervisor** |

### Why Is This the Ultimate Form?

| Dimension | Traditional Approach | ITOps Agent Platform |
|-----------|---------------------|---------------------|
| Incident Response | Manual: discover → locate → fix (30-60 min) | AI: auto sense → diagnose → fix (< 3 min) |
| Ops Scale | 1 person manages 20-50 nodes | **1 person manages 500+ nodes, AI handles 80%+ of workload** |
| Knowledge Retention | In senior engineers' heads, scattered docs | **Knowledge base + RAG, AI continuously learns, never lost** |
| Decision Quality | Depends on individual experience, inconsistent | **Multi-Agent collaborative reasoning, auditable reasoning chains** |
| Marginal Cost | More machines ≈ more headcount | **More machines ≈ more Agents, marginal cost approaches zero** |

> **This is not an ops tool. This is the next-generation operating system for IT operations.** When AI Agents can autonomously complete the full closed-loop of alert intake, root cause diagnosis, remediation decisions, command execution, and result verification, ops shifts from "humans watching systems" to "humans designing strategies, AI executing them."

### Industry Trends: AI Autonomous Ops Is Irreversible

| Trend | Explanation |
|-------|-------------|
| **LLM Capability Crosses Threshold** | GPT-4o / DeepSeek / Doubao / Qwen now have production-grade reasoning, capable of fault diagnosis and command generation in serious scenarios |
| **Ops Labor Costs Rising Irreversibly** | Enterprise IT scales 10x, ops teams can't scale proportionally — the only way out is AI handling 80%+ of daily workload |
| **Open-Source Ecosystem Is Mature Enough** | Docker / K8s / React / TypeScript / Node.js can now support enterprise-grade products — open source no longer means "shoddy" |

> **2026 is Year One of AI Autonomous Operations.** When LLM capability + ops pain points + open-source maturity converge, ITOps Agent Platform stands at this historic moment. Miss this window, miss an era.

### Our Position

**ITOps Agent Platform is currently the only open-source AIOps project that has engineered the full closed-loop of "Alert → Diagnose → Decide → Execute → Verify" into production-ready code.**

Our long-term goal: let 80% of daily ops work be autonomously completed by AI Agents, freeing human ops engineers to focus on architecture design, strategy planning, and creative work. **This is not just a product — this is the starting point of the Ops Engineer Liberation Movement.**

## ⏰ Why Now?

Three trends converging at this exact moment turn AI autonomous ops from "concept" to "inevitability":

| Trend | Detail |
|-------|--------|
| **LLM capability threshold** | GPT-4o / DeepSeek / Doubao models are production-ready for serious ops reasoning |
| **Ops labor costs rising** | IT infrastructure grows 10x faster than ops headcount — AI is the only scalable answer |
| **Open-source maturity** | Docker / K8s / React / TypeScript / Node.js make enterprise-grade open source possible |

> **2026 is the year of AI autonomous operations.** The convergence of LLM capability + ops pain + open-source maturity puts ITOps Agent Platform at this historic inflection point.

---

## 💰 Why This Story Deserves Investment

### A $40 Billion Market Being Rewritten by AI

Global IT operations market size: **$40B (2025)**, projected $70B by 2030. Every paradigm shift creates new champions:

- Cloud shift → AWS ($2T market cap)
- Monitoring shift → Datadog ($40B market cap)
- Dev tools shift → GitLab ($14B IPO)
- **Ops automation shift → ?**

> **The question is not "will it happen," but "who will be the GitLab of this category."** The open-source AIOps leader position is vacant — this is a Winner-takes-most market.

| GitLab, Back in 2014 | ITOps Agent Platform, Today |
|----------------------|---------------------------|
| Open-source alternative to GitHub | Open-source alternative to PagerDuty + Rundeck + Portainer |
| Basic CI/CD only | 12 AI Agents + 68 API routes |
| Nobody believed code hosting was a $10B market | **Nobody believes ops platforms are a $10B market** |

> ITOps Agent Platform stands at the earlier stage of a bigger market.

### Three Irreversible Tailwinds

| Tailwind | Why Irreversible |
|----------|-----------------|
| **AI capability explosion** | LLMs went from "toy" to "production-grade" in 2 years. Next: autonomous decision-making |
| **Ops talent gap** | Senior ops engineers retiring + young talent avoiding 24/7 on-call = AI is the only answer |
| **Open source eating enterprise software** | GitLab, Confluent, Grafana, HashiCorp — 5 open-source IPOs proving open-source beats proprietary |

> **It's not a matter of "if" — it's a matter of "who."** When these three curves converge, AI autonomous ops is a mathematical certainty.

---

<img alt="platform-screenshot" src="docs-assets/0-3.gif" style="max-width: 100%;" />

---

## 5 Minutes to Full AIOps Experience

```bash
# 1. Deploy with one command (Docker required)
curl -sL https://gitee.com/IT_Oline/itops-agent-platform/raw/main/deploy.sh -o deploy.sh && chmod +x deploy.sh && ./deploy.sh

# 2. Open http://localhost:8080, login with admin/admin
# 3. Add a server → auto-discovers containers and resources on the host
# 4. Configure alert webhook → trigger a test alert → watch AI auto-analyze
# 5. Click "Auto Remediate" → approve on phone → Done!
```

**5 minutes from zero to a complete AI-powered IT operations loop.**

---

## What Can This Platform Do?

### Path 1 &nbsp; Smart Alerts → AI Diagnosis → Auto Remediation

```
Prometheus / Zabbix Alert → Webhook Ingest
  → AI Root Cause Analysis (natural language diagnosis report)
    → Auto-generate remediation commands + risk assessment
      → Push to WeCom/DingTalk for approval → one-tap on phone
        → SSH auto-execute remediation → verify result → generate report
```

<details>
<summary><b>Expand to see pain points solved</b></summary>

| Traditional Way | This Platform |
|----------------|---------------|
| Alert storms, woken up at night | AI auto dedup & suppress, aggregate related alerts |
| Manual SSH troubleshooting, guesswork | AI analyzes logs + metrics, gives natural language diagnosis |
| Search docs for fix steps | Auto-generate structured remediation commands (JSON) |
| No approval for fixes, no accountability | Human approval node, mobile one-tap approve |
| Worry about breaking things, no rollback | Auto verify results, alert on failure |

</details>

### Path 2 &nbsp; Visual Workflow → Scheduled Auto Inspection

```
Drag-and-drop workflow (Agent + Approval + Conditional branches)
  → Configure Cron trigger
    → Auto-execute multi-server inspection
      → Generate compliance check report
        → Anomalies auto-create alerts → enter Path 1
```

### Path 3 &nbsp; Unified Container & Virtualization Management

```
Add Docker Host / VMware vCenter / KVM Node with one click
  → Auto-discover all containers and VMs
    → Real-time CPU / Memory / Network monitoring (WebSocket push)
      → Streaming container log viewer
        → Docker Compose visual orchestration
          → Image registry integration (Harbor / ACR / Docker Hub)
```

---

## How Is This Different From Other Open-Source Tools?

| Capability | ITOps Agent | Grafana<br/>OnCall | Portainer | Uptime<br/>Kuma | Rundeck | Coolify |
|------|:---------:|:---------:|:---------:|:-----------:|:-------:|:-------:|
| Alert Ingestion + Noise Reduction | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **AI Multi-Agent Collaboration** | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Alert → Auto-Remediation Loop** | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Human-in-the-Loop (HITL)** | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Docker/VM Visualization | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| K8s Cluster Management | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Drag-and-Drop Workflow | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Web SSH Terminal | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Knowledge Base + RAG | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Scheduled Inspection + Reports | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cost Analysis + Auto-Scaling | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Local AI · Data Never Leaves** | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **China Cloud & LLM Friendly** | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |

> **In a nutshell**: Existing tools each handle one piece — OnCall for alerts, Portainer for containers, Rundeck for execution. ITOps Agent connects them all with an **AI Multi-Agent brain**, delivering true "alert in, fix done."

### vs Commercial Solutions

Being free and open source isn't the only advantage. Head-to-head with paid commercial products:

| Capability | PagerDuty + Rundeck | ServiceNow ITOM | **ITOps Agent (Free & Open Source)** |
|------|:---:|:---:|:---:|
| Annual Cost (100 nodes) | $50,000+ | $100,000+ | **$0** |
| AI Autonomous Diagnosis | ❌ Alert routing only | ⚠️ Extra module required | **✅ Multi-Agent collaborative reasoning** |
| Auto-Remediation Closed Loop | ❌ Manual execution | ⚠️ Custom dev required | **✅ Built-in full pipeline** |
| Human Approval (HITL) | ❌ | ⚠️ Custom dev required | **✅ Native WeCom/DingTalk push** |
| Container/VM/K8s Management | ❌ | ❌ | **✅ Built-in visualization** |
| Data Never Leaves Premises | ❌ SaaS forces cloud | ❌ SaaS forces cloud | **✅ 100% local deployment** |
| Open Source & Controllable | ❌ Vendor lock-in | ❌ Vendor lock-in | **✅ MPL-2.0 open source** |
| Community Driven | ❌ | ❌ | **✅** |

> **One open-source project does what three commercial products (PagerDuty + Rundeck + Portainer) can't do combined.** And it's completely free.

---

## Architecture Overview

```mermaid
graph TB
    Browser["🌐 Browser"] --> Nginx["Nginx Reverse Proxy"]
    Nginx --> React["React Frontend<br/>63 Pages | @xyflow/react Workflow Editor"]
    Nginx --> Express["Express Backend<br/>67 Routes | 72 Services | JWT Auth"]
    React <-->|"WebSocket Real-time"| Express
    Express --> SQLite[("SQLite Database<br/>WAL Mode | AES-256 Encryption")]
    Express --> LLM["🤖 LLM Model Pool<br/>Doubao | DeepSeek | Qwen<br/>OpenAI | ZhiPu | Local Models"]
    Express --> SSH["🖥️ SSH Remote Servers"]
    Express --> Docker["🐳 Docker Engine API"]
    Express --> K8s["☸️ Kubernetes API"]
    Express --> VMware["💻 VMware vSphere / KVM"]
    Express --> Webhook["🚨 Alert Webhook<br/>Prometheus | Zabbix | Grafana"]
    Express --> Notify["📬 Notifications<br/>WeCom | DingTalk | Email"]
```

> 📐 [View Full Architecture Diagram →](./docs/ARCHITECTURE_DIAGRAM.md)

---

| Moat | Description |
|------|-------------|
| **12-Agent Collaborative Scheduling** | Not a single AI API call — a complex distributed system with Agent division of labor + collaboration + arbitration |
| **Full-Link State Machine** | Alert → Diagnose → Decide → Approve → Execute → Verify, a 7-node state flow engineered through production-grade iterations |
| **Command Safety Engine** | 7 categories of dangerous command policies + role-based permission matrix, ensuring AI-generated commands are safe for production |
| **Multi-Model Failover Chain** | Primary model failure triggers automatic fallback to backup models, ensuring AI service high availability |
| **32-Version Database Migration** | 32 schema iterations of stable evolution, engineering maturity far beyond demo-level projects |

### Open-Source Model: Scalability Advantage

| Metric | Traditional Ops SaaS | ITOps Agent Open-Source Model |
|--------|:---:|:---:|
| Customer Acquisition Cost | Sales-driven, $10,000+ per enterprise | **≈ $0 (community-driven + developer word-of-mouth)** |
| Marginal Service Cost | Grows linearly with user count | **≈ $0 (self-hosted)** |
| Network Effects | Weak | **Strong (more Agents → stronger platform → larger community)** |
| Ecosystem Lock-in | Contract expires, can migrate | **Knowledge base + Agent marketplace + workflow templates (deep integration)** |
| Monetization Flexibility | Subscription only | **Enterprise / SaaS / Support / Agent marketplace / Training & certification** |

> The core advantage of the open-source model lies in customer acquisition efficiency and scalability, validated by major open-source projects in the industry. This provides a solid foundation for long-term sustainable development.

## 🗺️ Future Roadmap

| Phase | Core Goals |
|------|-----------|
| **v3.x Engineering** (Current) | Multi-host container/VM/K8s unified management, alert→remediation full closed loop |
| **v4.x Intelligence** | Multi-Agent autonomous negotiation & decision-making, cross-system correlation analysis, AI self-learning strategy optimization |
| **v5.x Autonomy** | Zero human intervention autonomous ops, AI-driven capacity planning & cost optimization |
| **v6.x Ecosystem** | Agent marketplace (community-shared Agents), multi-cluster federation, ops digital twin |

> **A roadmap isn't just a timeline — it's our commitment to the future.** The project will continue iterating, with every step advancing toward the ultimate goal of "Fully AI-Autonomous Operations."

---

## Core Features

### 🤖 AI-Powered Operations

- **12 Preset Agents**: Alert handling, fault diagnosis, log analysis, system inspection, change execution, doc generation, compliance checks, command execution, auto inspection, command generation expert, network inspection expert, database ops
- **AI Remediation Loop**: Alert → AI analysis → remediation command generation → approval → execution → verification
- **Root Cause Analysis**: AI-driven alert analysis, natural language diagnosis reports, complete reasoning chain
- **AI Copilot**: Natural language ops assistant with automatic system state awareness
- **Knowledge Base + RAG**: 21 preset entries, semantic retrieval injected into LLM context

### 🔧 Visual Management

- **Workflow Editor**: Drag-and-drop orchestration, serial/parallel/conditional branches, 10 preset templates
- **Web SSH Terminal**: xterm.js interactive terminal, window auto-resize, session management
- **Container Management**: Docker visualization (start/stop/logs/monitor/Compose)
- **VM Management**: VMware vSphere / KVM support, snapshot management, live migration
- **K8s Management**: Pod / Deployment / Service / Node full lifecycle
- **Big Screen Dashboard**: Full-screen NOC monitoring center

### 🏢 Enterprise Capabilities

- **HITL Approval**: Human approval nodes, WeCom/DingTalk push, mobile approval
- **Alert Noise Reduction**: Smart dedup + suppression + correlation analysis
- **Auto Scaling**: CPU/memory metric-driven, cooldown windows, scaling history
- **Cost Analysis**: Container/VM cost estimation + optimization recommendations
- **Scheduled Tasks**: Cron expressions, auto-execute workflows
- **Report System**: Auto-generated Markdown reports

### 🔒 Security & Compliance

- **AES-256-GCM Encryption**: Bank-level encryption for server passwords and SSH keys
- **JWT Dual-Token Auth**: Access Token (24h) + Refresh Token (7d), auto-refresh
- **SSH Command Filter**: 7 categories of dangerous command policies, role-based blocking
- **Login Protection**: 5 failures lock for 30 minutes, enforced password complexity
- **Audit Trail**: Full operation traceability
- **Non-Root Execution**: Docker containers with least privilege
- **On-Premise AI**: Ollama / LM Studio / vLLM support, 100% data sovereignty

---

## Supported AI Models

Unified AI model pool with primary-backup fallback chains and per-provider circuit breakers.

| Type | Provider/Model | Integration | Best For |
|------|---------------|-------------|----------|
| **China Cloud** | VolcEngine · Doubao | Native API | Recommended for China users |
| **China Cloud** | Alibaba Cloud · Qwen | OpenAI Compatible | Enterprise apps |
| **China Cloud** | DeepSeek | OpenAI Compatible | Code generation, reasoning |
| **China Cloud** | ZhiPu AI (GLM-4) | OpenAI Compatible | Chinese language excellence |
| **China Cloud** | Moonshot · Kimi | OpenAI Compatible | Long text processing |
| **China Cloud** | Baidu · Wenxin | OpenAI Compatible | Enterprise apps |
| **China Cloud** | 01.AI (Yi) / Baichuan | OpenAI Compatible | Open-source models |
| **Global Cloud** | OpenAI (GPT-4o) / Anthropic Claude | Native API | External network access |
| **On-Premise** | Ollama / LM Studio / vLLM | OpenAI Compatible | **100% data sovereignty** |

> ✅ Unified pool &nbsp; ✅ Fallback chains &nbsp; ✅ Circuit breakers &nbsp; ✅ Drag-to-prioritize &nbsp; ✅ Connectivity tests

---

## Quick Start

### Option 1: One-Click Script (Recommended)

```bash
# Linux/Mac
curl -sL https://gitee.com/IT_Online/itops-agent-platform/raw/main/deploy.sh -o deploy.sh && chmod +x deploy.sh && ./deploy.sh

# Windows PowerShell
.\deploy.ps1
```

### Option 2: Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
# Frontend: http://localhost:8080
# Health: http://localhost:3001/health
```

### Option 3: Local Dev (Hot Reload)

```bash
# Docker dev environment
cd local-dev
# Windows: .\start-dev.bat
# Linux/Mac: ./start-dev.sh

# Or traditional
npm run dev
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

**Default Admin**: `admin` / `admin` (forced password change on first login)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| State | Zustand + React Query |
| Workflow Editor | @xyflow/react |
| Backend | Node.js + Express 4 + TypeScript |
| Database | SQLite (better-sqlite3, WAL mode) |
| Real-time | Socket.io 4 |
| Remote | SSH2 |
| Container Ops | Dockerode |
| Deployment | Docker + Docker Compose + Nginx |

---

## Project Structure

```
├── backend/src/
│   ├── app.ts                    # Express entry
│   ├── routes/                   # 67 API route modules
│   ├── services/                 # 72 business services
│   ├── models/                   # Database + migrations (32 versions)
│   ├── middleware/               # 6 middleware (auth / rateLimiter / validation etc.)
│   ├── websocket/                # Socket.io real-time
│   └── utils/                    # Utilities
├── frontend/src/
│   ├── pages/                    # 63 page components
│   ├── components/               # Shared components
│   ├── contexts/                 # React Context (Auth / Theme / Toast)
│   └── lib/                      # Axios wrapper / utilities
├── docker/                       # Production Docker config + Nginx
├── docs/                         # Technical documentation
├── .github/workflows/            # CI/CD (ci.yml + release.yml)
├── docker-compose.yml            # Production orchestration
└── deploy.sh / deploy.ps1        # One-click deploy scripts
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](./docs/DEPLOYMENT.md) | Detailed deployment |
| [API Reference](./docs/API.md) | Complete API docs |
| [Architecture](./docs/ARCHITECTURE.md) | System design |
| [Development Guide](./docs/DEVELOPMENT.md) | Local setup |
| [Workflow Guide](./docs/WORKFLOW_GUIDE.md) | Workflow usage |
| [Auto Remediation](./docs/AUTO_REMEDIATION_DESIGN.md) | Alert auto-remediation |
| [Network Inspection](./docs/NETWORK_DEVICE_INSPECTION.md) | Network features |
| [Test Guide](./docs/TEST_GUIDE.md) | Testing guide |
| [Project Vision](./项目愿景与社区共建.md) | Vision & community |

---

## Author

**Tan Ce** — Independent Developer | AIOps Explorer

- 🌐 Official Website: [ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 Blog: [zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 Email: <huawei_network@foxmail.com>
- 💬 WeChat Official Account: **IT Online**

<p align="left">
  <img src="./frontend/public/wechaterweima.png" width="200" alt="IT Online WeChat Official Account">
</p>

---

## 🙏 Contributors

| Avatar | Name / Username | Role | Contributions |
|:---:|:---:|:---:|:---|
| <img src="./docs-assets/contributors/1.jpg" width="60" height="60" style="border-radius:50%;" /> | **Tan Ce** ([@qinshihu](https://github.com/qinshihu)) | Author | Architecture, core dev, docs |
| <img src="./docs-assets/contributors/微信图片_2026-06-12_143259_183.jpg" width="60" height="60" style="border-radius:50%;" /> | **热心市民高先生** | WeChat Contributor | Testing & feedback |
| <img src="./docs-assets/contributors/微信图片_2026-06-12_143226_852.jpg" width="60" height="60" style="border-radius:50%;" /> | **@林** | WeChat Contributor | Testing & feedback |
| <img src="./docs-assets/contributors/11.jpg" width="60" height="60" style="border-radius:50%;" /> | **尔东辰** | WeChat Contributor | Testing |
| <img src="https://avatars.githubusercontent.com/u/68582645?v=4" width="60" height="60" style="border-radius:50%;" /> | **xiezhiliang89** | GitHub Contributor | Testing |

<a href="https://github.com/qinshihu/itops-agent-platform/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=qinshihu/itops-agent-platform" />
</a>

---

## 🌍 Community Vision: More Than Code, It's a Movement

ITOps Agent Platform is not just an open-source project — it's an **Ops Engineer Liberation Movement**.

We believe:

- **Ops should not be 24/7 on-call manual labor**, but rather strategy design and architectural innovation
- **AI should not replace ops engineers**, but should replace the repetitive work ops engineers don't want to do
- **The power of open-source community** can build better products than commercial software
- **Every ops engineer deserves to be freed from alert storms**, to spend time with family and pursue what they truly love

> If you also believe the future of ops is AI autonomy, join us. **A Star is the greatest recognition. Every issue filed brings this vision one step closer.**

---

## 🔭 Long-Term Vision

> **"We are building the autonomous operating system for IT operations."**
>
> 50 million ops engineers worldwide manage $40 billion in IT infrastructure. Today, they still get woken up at 3 AM to manually fix servers.
>
> We are turning ops from "humans operating tools" into "humans designing strategy, AI executing autonomously." This is not a feature upgrade — it's a paradigm shift.
>
> The open-source AIOps leader position is vacant. We lead all comparable projects across 35 dimensions. A $40B market × AI disruption × open-source distribution × first-mover advantage — this is a once-in-a-decade window.
>
> GitLab went from open-source project to $14B IPO in 7 years. Operations is a bigger market than code hosting — every company needs ops, not every company needs self-hosted Git. We stand at the earlier stage of a bigger market.

> The project is iterating continuously. Every Star is a vote for the future.

---

## 🤝 Contributing

We welcome contributions of all kinds!

- 🐛 [Report Bug](https://github.com/qinshihu/itops-agent-platform/issues/new?template=bug_report.yml)
- 💡 [Request Feature](https://github.com/qinshihu/itops-agent-platform/issues/new?template=feature_request.yml)
- 📝 [Improve Docs](https://github.com/qinshihu/itops-agent-platform/issues/new?template=docs_update.yml)
- 🔒 [Report Security](SECURITY.md)

See [Contributing Guide](CONTRIBUTING.md) for details.

---

## ⭐ Support the Project

If this project helps you, give us a **Star** ⭐ to help more people discover it!

<p align="center">
  <a href="https://github.com/qinshihu/itops-agent-platform">
    <img src="https://img.shields.io/github/stars/qinshihu/itops-agent-platform?style=for-the-badge&color=blueviolet" alt="Star this repo" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/qinshihu/itops-agent-platform/fork">
    <img src="https://img.shields.io/github/forks/qinshihu/itops-agent-platform?style=for-the-badge" alt="Fork this repo" />
  </a>
</p>

> 🌟 **More stars → higher chance on GitHub Trending → more contributors join. Every single star means the world to us!**

---

## 📄 License

[MPL-2.0](./LICENSE) © Tan Ce
