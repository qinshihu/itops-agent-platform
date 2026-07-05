import db from '../database';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export function initializePresetKnowledge() {
  const presetKnowledge = [
    {
      id: randomUUID(),
      title: 'Linux 系统健康检查指南',
      category: '运维指南',
      content: '# Linux 系统健康检查指南\n\n## 1. CPU 检查\n使用 `top` 或 `htop` 检查 CPU 使用率\n\n## 2. 内存检查\n使用 `free -h` 检查内存使用情况\n\n## 3. 磁盘检查\n使用 `df -h` 检查磁盘空间\n\n## 4. 网络检查\n使用 `netstat` 或 `ss` 检查网络连接',
      tags: JSON.stringify(['Linux', '系统检查', '运维']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '常见告警处理手册',
      category: '故障处理',
      content: '# 常见告警处理手册\n\n## CPU 使用率过高\n1. 检查进程占用\n2. 分析日志\n3. 考虑扩容\n\n## 内存告警\n1. 检查内存泄漏\n2. 调整 JVM 参数\n3. 增加内存\n\n## 磁盘空间告警\n1. 清理临时文件\n2. 清理旧日志\n3. 检查大文件',
      tags: JSON.stringify(['告警处理', '故障处理']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'SSH 密钥配置最佳实践',
      category: '安全配置',
      content: '# SSH 密钥配置最佳实践\n\n1. 使用 ed25519 密钥类型\n2. 设置强密码保护私钥\n3. 定期轮换密钥\n4. 使用 ssh-agent 管理密钥',
      tags: JSON.stringify(['SSH', '安全', '配置']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'MySQL 数据库性能优化',
      category: '数据库',
      content: '# MySQL 数据库性能优化\n\n## 1. 索引优化\n确保经常查询的字段有合适的索引\n\n## 2. 查询优化\n避免 SELECT *，只查询需要的字段\n\n## 3. 缓存策略\n合理使用 Redis 缓存热点数据\n\n## 4. 慢查询日志\n定期分析慢查询日志，优化性能瓶颈',
      tags: JSON.stringify(['MySQL', '数据库', '性能优化']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'Docker 容器化部署指南',
      category: '容器化',
      content: '# Docker 容器化部署指南\n\n## 1. 镜像管理\n使用官方基础镜像\n定期更新基础镜像\n\n## 2. 容器网络\n使用 Docker Compose 管理多容器应用\n\n## 3. 数据持久化\n使用 Volume 持久化数据\n\n## 4. 日志管理\n配置合适的日志驱动',
      tags: JSON.stringify(['Docker', '容器化', '部署']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '系统备份和恢复策略',
      category: '数据保护',
      content: '# 系统备份和恢复策略\n\n## 1. 定期备份\n设置每日自动备份\n保留最近 7 天的备份\n\n## 2. 异地备份\n重要数据需要异地备份\n\n## 3. 定期测试恢复\n定期测试备份的恢复功能\n\n## 4. 备份加密\n敏感数据备份需要加密',
      tags: JSON.stringify(['备份', '恢复', '数据保护']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '网络安全加固检查清单',
      category: '安全',
      content: '# 网络安全加固检查清单\n\n## 1. 防火墙配置\n只开放必要的端口\n\n## 2. SSH 安全\n禁用 root 登录\n使用密钥认证\n\n## 3. 系统更新\n定期更新系统安全补丁\n\n## 4. 日志审计\n定期检查系统和应用日志',
      tags: JSON.stringify(['安全', '加固', '检查清单']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '应用部署标准流程',
      category: '部署',
      content: '# 应用部署标准流程\n\n## 1. 部署前准备\n- 备份当前版本\n- 准备回滚方案\n- 通知相关人员\n\n## 2. 部署执行\n- 执行部署脚本\n- 监控应用状态\n- 检查关键功能\n\n## 3. 部署后验证\n- 功能测试\n- 性能检查\n- 日志监控\n\n## 4. 问题处理\n- 问题分类\n- 快速定位\n- 必要时回滚',
      tags: JSON.stringify(['部署', '流程', '标准']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'Nginx 配置优化指南',
      category: 'Web服务器',
      content: '# Nginx 配置优化指南\n\n## 1. 基本优化\n- worker_processes auto\n- worker_connections 65535\n- keepalive_timeout 65\n\n## 2. Gzip 压缩\n启用 gzip 压缩文本资源\n\n## 3. 缓存策略\n配置静态资源缓存\n\n## 4. 日志配置\n设置合适的日志格式和轮替',
      tags: JSON.stringify(['Nginx', 'Web服务器', '优化']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'Redis 性能调优实践',
      category: '缓存',
      content: '# Redis 性能调优实践\n\n## 1. 内存优化\n设置 maxmemory 限制\n选择合适的淘汰策略\n\n## 2. 持久化配置\n合理使用 RDB 和 AOF\n\n## 3. 集群模式\n数据量大时使用集群模式\n\n## 4. 监控指标\n关注内存使用、命中率、延迟',
      tags: JSON.stringify(['Redis', '缓存', '性能调优']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'Kubernetes 快速入门',
      category: '容器编排',
      content: '# Kubernetes 快速入门\n\n## 1. 核心概念\n- Pod: 最小部署单元\n- Service: 服务发现和负载均衡\n- Deployment: 部署管理\n\n## 2. 常用命令\n- kubectl get pods\n- kubectl logs\n- kubectl apply -f\n\n## 3. 部署应用\n编写 Deployment YAML\n配置 Service 暴露服务',
      tags: JSON.stringify(['Kubernetes', 'K8s', '容器编排']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'CI/CD 最佳实践',
      category: 'DevOps',
      content: '# CI/CD 最佳实践\n\n## 1. 代码管理\n使用 Git 进行版本控制\n分支策略：main、develop、feature\n\n## 2. 自动构建\n代码提交后自动触发构建\n运行单元测试和代码质量检查\n\n## 3. 自动化测试\n集成测试、E2E 测试\n\n## 4. 自动部署\n蓝绿部署或金丝雀发布',
      tags: JSON.stringify(['CI/CD', 'DevOps', '自动化']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '监控告警系统建设',
      category: '监控',
      content: '# 监控告警系统建设\n\n## 1. 监控指标\n- 系统指标：CPU、内存、磁盘、网络\n- 应用指标：QPS、延迟、错误率\n- 业务指标：订单量、用户数\n\n## 2. 告警规则\n合理设置阈值\n避免告警风暴\n\n## 3. 可视化\n使用 Grafana 构建监控面板',
      tags: JSON.stringify(['监控', '告警', 'Prometheus', 'Grafana']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '灾难恢复预案',
      category: '应急处理',
      content: '# 灾难恢复预案\n\n## 1. RTO/RPO 定义\nRTO (Recovery Time Objective): 恢复时间目标\nRPO (Recovery Point Objective): 恢复点目标\n\n## 2. 灾难等级划分\n- 一级故障：完全不可用\n- 二级故障：部分功能受影响\n- 三级故障：性能下降\n\n## 3. 应急响应流程\n- 故障发现和上报\n- 故障分析和定位\n- 故障处理和恢复\n- 事后复盘和改进',
      tags: JSON.stringify(['灾难恢复', '应急处理', '预案']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '系统性能基准测试',
      category: '性能测试',
      content: '# 系统性能基准测试\n\n## 1. 基准指标\n- 吞吐量 (Throughput)\n- 响应时间 (Latency)\n- 并发用户数\n- 错误率\n\n## 2. 测试工具\n- Apache Bench (ab)\n- JMeter\n- Locust\n- k6\n\n## 3. 测试场景\n- 单接口基准测试\n- 混合场景测试\n- 稳定性测试\n- 峰值测试',
      tags: JSON.stringify(['性能测试', '基准测试', '压测']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '容量规划指南',
      category: '规划',
      content: '# 容量规划指南\n\n## 1. 数据收集\n历史性能数据\n业务增长预期\n\n## 2. 资源需求分析\n- 计算资源 (CPU、内存)\n- 存储资源 (磁盘空间、IOPS)\n- 网络资源 (带宽、延迟)\n\n## 3. 扩容策略\n- 垂直扩容：升级单节点配置\n- 水平扩容：增加节点数量\n\n## 4. 定期评估\n每季度评估一次容量使用情况',
      tags: JSON.stringify(['容量规划', '扩容', '资源规划']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'API 安全最佳实践',
      category: 'API安全',
      content: '# API 安全最佳实践\n\n## 1. 认证授权\n- 使用 OAuth2.0 / JWT\n- 令牌过期时间合理设置\n\n## 2. 接口安全\n- 参数验证和过滤\n- 防止 SQL 注入\n- 防止 XSS 攻击\n\n## 3. 限流控制\n防止接口被滥用\n\n## 4. 日志记录\n记录关键操作日志',
      tags: JSON.stringify(['API', '安全', '认证']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '自动化运维工具概览',
      category: '工具',
      content: '# 自动化运维工具概览\n\n## 1. 配置管理\n- Ansible\n- SaltStack\n- Chef\n\n## 2. 持续集成\n- Jenkins\n- GitLab CI\n- GitHub Actions\n\n## 3. 监控系统\n- Prometheus + Grafana\n- Zabbix\n- Nagios\n\n## 4. 日志管理\n- ELK Stack (Elasticsearch + Logstash + Kibana)\n- Loki',
      tags: JSON.stringify(['工具', '自动化', 'Ansible', 'Jenkins']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'PostgreSQL 数据库管理',
      category: '数据库',
      content: '# PostgreSQL 数据库管理\n\n## 1. 基础配置\n- shared_buffers 配置\n- work_mem 配置\n- effective_cache_size 配置\n\n## 2. 备份恢复\n- pg_dump 逻辑备份\n- 基于 WAL 的物理备份\n\n## 3. 性能优化\n- EXPLAIN ANALYZE 分析查询计划\n- 索引优化\n- VACUUM 和 ANALYZE',
      tags: JSON.stringify(['PostgreSQL', '数据库', '管理']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: 'Git 工作流规范',
      category: '版本控制',
      content: '# Git 工作流规范\n\n## 1. 分支模型\n- main: 生产环境代码\n- develop: 开发环境代码\n- feature/*: 功能分支\n- hotfix/*: 紧急修复分支\n\n## 2. 提交规范\n- feat: 新功能\n- fix: 修复bug\n- docs: 文档更新\n- refactor: 重构\n\n## 3. 代码审核\n- PR (Pull Request) 流程\n- 至少一人审核\n- CI 通过后合并',
      tags: JSON.stringify(['Git', '版本控制', '工作流']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    },
    {
      id: randomUUID(),
      title: '日志分析实战',
      category: '日志管理',
      content: '# 日志分析实战\n\n## 1. 日志分类\n- 系统日志：/var/log/\n- 应用日志：自定义位置\n- 访问日志：Nginx/Apache\n\n## 2. 常用工具\n- grep: 文本搜索\n- awk: 文本处理\n- sed: 流编辑\n\n## 3. 日志查询\n- 按时间范围过滤\n- 按关键字搜索\n- 统计分析',
      tags: JSON.stringify(['日志', '分析', 'grep', 'awk']),
      solutions: null,
      related_alerts: null,
      usage_count: 0
    }
  ];

  const insertKnowledge = db.prepare(`
    INSERT OR IGNORE INTO knowledge_base (id, title, category, content, tags, solutions, related_alerts, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  presetKnowledge.forEach(item => {
    insertKnowledge.run(item.id, item.title, item.category, item.content, item.tags, item.solutions, item.related_alerts, item.usage_count);
  });

  logger.info(`✅ 成功创建 ${presetKnowledge.length} 条预设知识库条目`);
}
