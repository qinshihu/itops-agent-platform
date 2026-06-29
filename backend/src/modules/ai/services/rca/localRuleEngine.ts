import { logger } from '../../../utils/logger';

interface FailurePattern {
  id: string;
  name: string;
  keywords: string[];
  rootCause: string;
  symptoms: string[];
  recommendations: string[];
  scripts?: string[];
}

interface KnowledgeArticle {
  title: string;
  tags: string[];
  alertTypes: string[];
  summary: string;
}

interface WorkflowScriptTemplate {
  workflowType: string;
  keywords: string[];
  scriptTemplate: string;
  description: string;
}

interface RuleAnalysisResult {
  rootCause: string;
  symptoms: string[];
  timeline: Array<{ time: string; event: string }>;
  evidence: string[];
  recommendations: string[];
  matchedPatternId?: string;
  confidence: number;
}

class LocalRuleEngine {
  private readonly failurePatterns: FailurePattern[] = [
    {
      id: 'CPU_HIGH',
      name: 'CPU 使用率过高',
      keywords: ['cpu', '处理器', '负载', 'load', 'high cpu', 'cpu usage'],
      rootCause: '系统 CPU 使用率持续过高，可能由于进程异常、死循环或资源争用导致',
      symptoms: ['CPU 使用率超过阈值', '系统响应变慢', '进程排队等待'],
      recommendations: [
        '使用 top/htop 命令定位高 CPU 消耗进程',
        '检查是否有死循环或无限递归代码',
        '考虑增加 CPU 资源或优化算法',
        '检查是否有僵尸进程占用资源'
      ],
      scripts: ['top -bn1 | head -20', 'ps aux --sort=-%cpu | head -10']
    },
    {
      id: 'MEMORY_LEAK',
      name: '内存泄漏/使用率过高',
      keywords: ['memory', '内存', 'oom', 'out of memory', '内存泄漏', '内存不足'],
      rootCause: '应用程序存在内存泄漏或内存分配过多，导致可用内存不足',
      symptoms: ['内存使用率持续增长', '系统触发 OOM Killer', '应用响应变慢或崩溃'],
      recommendations: [
        '使用 free -m 和 top 检查内存使用情况',
        '检查应用日志查找内存相关错误',
        '使用内存分析工具定位泄漏点',
        '考虑重启服务临时释放内存',
        '增加物理内存或优化内存使用'
      ],
      scripts: ['free -m', 'ps aux --sort=-%mem | head -10', 'dmesg | grep -i oom']
    },
    {
      id: 'DISK_FULL',
      name: '磁盘空间不足',
      keywords: ['disk', '磁盘', '存储空间', 'no space left', 'disk full', '存储满'],
      rootCause: '磁盘空间使用率过高，可能由于日志文件过大、数据积累或临时文件未清理',
      symptoms: ['磁盘使用率超过阈值', '无法写入新文件', '应用日志报错空间不足'],
      recommendations: [
        '使用 df -h 检查各分区使用情况',
        '使用 du -sh /* 定位大文件/目录',
        '清理过期日志和临时文件',
        '配置日志轮转策略',
        '考虑扩容磁盘空间'
      ],
      scripts: ['df -h', 'du -sh /var/log/* | sort -rh | head -10', 'find / -type f -size +100M 2>/dev/null | head -20']
    },
    {
      id: 'NETWORK_DOWN',
      name: '网络中断/连接异常',
      keywords: ['network', '网络', '连接', 'connection', 'timeout', '断网', '网络中断', 'ping'],
      rootCause: '网络连接异常，可能由于网卡故障、路由问题、防火墙规则或外部服务不可达',
      symptoms: ['网络连接超时', '服务间通信失败', 'ping 测试丢包或不通'],
      recommendations: [
        '使用 ping 测试网络连通性',
        '使用 traceroute 检查路由路径',
        '检查防火墙和 iptables 规则',
        '检查网卡状态和驱动',
        '联系网络管理员排查'
      ],
      scripts: ['ping -c 4 8.8.8.8', 'netstat -tuln', 'ip addr show', 'traceroute 8.8.8.8']
    },
    {
      id: 'SERVICE_DOWN',
      name: '服务宕机/不可用',
      keywords: ['service', '服务', 'down', '宕机', '不可用', 'crash', 'stop', '进程'],
      rootCause: '关键服务进程异常退出或无法启动，可能由于配置错误、依赖缺失或资源不足',
      symptoms: ['服务端口无法访问', '进程不存在', '健康检查失败'],
      recommendations: [
        '检查服务进程状态 systemctl status <service>',
        '查看服务日志 journalctl -u <service>',
        '检查配置文件是否正确',
        '检查依赖服务是否正常运行',
        '尝试重启服务'
      ],
      scripts: ['systemctl status nginx', 'systemctl status sshd', 'journalctl -u nginx --no-pager -n 50']
    },
    {
      id: 'DATABASE_ISSUE',
      name: '数据库异常',
      keywords: ['database', '数据库', 'mysql', 'postgres', 'sql', 'db', '连接池', 'deadlock'],
      rootCause: '数据库服务异常或连接问题，可能由于连接数耗尽、死锁、性能下降或配置错误',
      symptoms: ['数据库连接失败', '查询超时', '连接池耗尽', '锁等待'],
      recommendations: [
        '检查数据库服务状态',
        '查看数据库错误日志',
        '检查活跃连接数和慢查询',
        '检查是否有长时间未提交的事务',
        '优化查询语句或增加连接池大小'
      ],
      scripts: ['mysqladmin status -u root -p', 'SHOW PROCESSLIST;', 'SELECT * FROM information_schema.innodb_trx;']
    },
    {
      id: 'SSL_CERT_EXPIRED',
      name: 'SSL 证书过期',
      keywords: ['ssl', '证书', 'certificate', 'expired', 'https', 'tls'],
      rootCause: 'SSL/TLS 证书已过期或即将过期，导致 HTTPS 连接失败或告警',
      symptoms: ['HTTPS 访问失败', '浏览器证书告警', 'API 调用证书验证失败'],
      recommendations: [
        '检查证书有效期 openssl x509 -dates',
        '续期或重新申请证书',
        '更新服务器证书配置',
        '配置证书到期自动提醒'
      ],
      scripts: ['echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates']
    },
    {
      id: 'AUTH_FAILURE',
      name: '认证/授权失败',
      keywords: ['auth', '认证', '权限', 'permission', 'login', 'password', '密码', 'token', '401', '403'],
      rootCause: '用户认证或授权失败，可能由于密码错误、token 过期、权限配置不当',
      symptoms: ['登录失败', '401 Unauthorized 错误', '403 Forbidden 错误'],
      recommendations: [
        '检查用户凭据是否正确',
        '检查 token 是否过期',
        '查看认证服务日志',
        '检查权限配置和角色分配'
      ],
      scripts: ['journalctl -u sshd | grep -i "failed" | tail -20']
    },
    {
      id: 'HIGH_LATENCY',
      name: '响应延迟过高',
      keywords: ['latency', '延迟', '慢', 'response time', '超时', 'slow', 'performance'],
      rootCause: '系统响应时间过长，可能由于资源瓶颈、慢查询、网络延迟或应用性能问题',
      symptoms: ['接口响应时间超过阈值', '用户体验下降', '请求排队'],
      recommendations: [
        '使用 APM 工具定位慢接口',
        '检查数据库慢查询日志',
        '分析网络延迟',
        '检查缓存命中率',
        '考虑水平扩展或优化代码'
      ],
      scripts: ['curl -o /dev/null -s -w "Time: %{time_total}s\\n" http://localhost', 'mysqladmin processlist -u root -p']
    }
  ];

  private readonly knowledgeBase: KnowledgeArticle[] = [
    {
      title: 'CPU 使用率过高排查指南',
      tags: ['cpu', '性能', '排查'],
      alertTypes: ['CPU_HIGH', 'PERFORMANCE'],
      summary: '本文介绍如何系统性地排查和解决 CPU 使用率过高的问题，包括使用 top、perf 等工具定位问题进程和代码。'
    },
    {
      title: '内存泄漏分析与解决',
      tags: ['memory', 'oom', '排查'],
      alertTypes: ['MEMORY_LEAK', 'MEMORY'],
      summary: '本文介绍内存泄漏的常见场景、分析工具和解决方案，帮助快速定位和修复内存问题。'
    },
    {
      title: '磁盘空间管理最佳实践',
      tags: ['disk', '存储', '运维'],
      alertTypes: ['DISK_FULL', 'STORAGE'],
      summary: '本文介绍磁盘空间监控、清理策略和扩容方案，确保系统存储资源充足。'
    },
    {
      title: '网络故障排查手册',
      tags: ['network', '网络', '排查'],
      alertTypes: ['NETWORK_DOWN', 'NETWORK'],
      summary: '本文提供网络故障的系统性排查流程，包括连通性测试、路由追踪、抓包分析等。'
    },
    {
      title: '服务高可用保障方案',
      tags: ['service', '高可用', '运维'],
      alertTypes: ['SERVICE_DOWN', 'AVAILABILITY'],
      summary: '本文介绍服务高可用架构设计和故障恢复策略，包括负载均衡、健康检查、自动重启等。'
    },
    {
      title: '数据库性能优化指南',
      tags: ['database', '性能', '优化'],
      alertTypes: ['DATABASE_ISSUE', 'DATABASE'],
      summary: '本文介绍数据库性能优化方法，包括索引优化、查询优化、连接池配置等。'
    },
    {
      title: 'SSL 证书管理与续期',
      tags: ['ssl', '证书', '安全'],
      alertTypes: ['SSL_CERT_EXPIRED', 'SECURITY'],
      summary: '本文介绍 SSL 证书的申请、部署、监控和自动续期方案。'
    }
  ];

  private readonly workflowScripts: WorkflowScriptTemplate[] = [
    {
      workflowType: 'restart_service',
      keywords: ['重启', 'restart', '服务'],
      scriptTemplate: 'systemctl restart {{service_name}} && systemctl status {{service_name}}',
      description: '重启指定服务并检查状态'
    },
    {
      workflowType: 'check_disk',
      keywords: ['磁盘', 'disk', '存储'],
      scriptTemplate: 'df -h && du -sh /var/log/* 2>/dev/null | sort -rh | head -10',
      description: '检查磁盘使用情况和日志文件'
    },
    {
      workflowType: 'check_memory',
      keywords: ['内存', 'memory', 'oom'],
      scriptTemplate: 'free -m && ps aux --sort=-%mem | head -10',
      description: '检查内存使用和占用最高的进程'
    },
    {
      workflowType: 'check_network',
      keywords: ['网络', 'network', '连接'],
      scriptTemplate: 'ping -c 4 {{target_host}} && netstat -tuln',
      description: '检查网络连通性和端口状态'
    },
    {
      workflowType: 'collect_logs',
      keywords: ['日志', 'log', '收集'],
      scriptTemplate: 'journalctl -u {{service_name}} --since "{{start_time}}" --until "{{end_time}}" --no-pager',
      description: '收集指定服务的时间段日志'
    },
    {
      workflowType: 'health_check',
      keywords: ['健康检查', 'health', '检查'],
      scriptTemplate: 'curl -sf http://{{server_ip}}:{{port}}/health || echo "Health check failed"',
      description: '执行服务健康检查'
    }
  ];

  analyzeByRules(alertTitle: string, alertContent: string): RuleAnalysisResult {
    const startTime = Date.now();
    const searchContent = `${alertTitle} ${alertContent}`.toLowerCase();

    logger.info(`🔍 [LocalRuleEngine] Starting rule-based analysis for: ${alertTitle}`);

    const matchedPatterns = this.matchPatterns(searchContent);

    if (matchedPatterns.length === 0) {
      logger.info(`📋 [LocalRuleEngine] No matching rules found, returning generic analysis`);
      return this.generateGenericAnalysis(alertTitle, alertContent);
    }

    const bestMatch = matchedPatterns[0];
    const confidence = this.calculateConfidence(bestMatch, searchContent);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const result: RuleAnalysisResult = {
      rootCause: bestMatch.rootCause,
      symptoms: bestMatch.symptoms,
      timeline: [
        { time: now, event: `检测到告警: ${alertTitle}` },
        { time: now, event: `匹配规则: ${bestMatch.name} (置信度: ${(confidence * 100).toFixed(1)}%)` },
        { time: now, event: '基于规则库生成分析结果' }
      ],
      evidence: [
        `告警标题匹配关键词: ${bestMatch.keywords.filter(k => searchContent.includes(k)).join(', ')}`,
        `规则库匹配模式: ${bestMatch.name}`
      ],
      recommendations: bestMatch.recommendations,
      matchedPatternId: bestMatch.id,
      confidence
    };

    const executionTime = Date.now() - startTime;
    logger.info(`✅ [LocalRuleEngine] Rule-based analysis completed in ${executionTime}ms, matched: ${bestMatch.name}, confidence: ${(confidence * 100).toFixed(1)}%`);

    return result;
  }

  executeWorkflowFallback(workflowType: string, alert: { title?: string; content?: string; server_ip?: string; [key: string]: unknown }): string {
    logger.info(`🔧 [LocalRuleEngine] Executing workflow fallback for: ${workflowType}`);

    const matchedScript = this.workflowScripts.find(s =>
      workflowType.toLowerCase().includes(s.workflowType.toLowerCase()) ||
      s.keywords.some(k => workflowType.toLowerCase().includes(k.toLowerCase()))
    );

    if (!matchedScript) {
      logger.warn(`📋 [LocalRuleEngine] No matching workflow script for: ${workflowType}`);
      return `# 工作流降级执行\n\n未找到匹配的脚本模板: ${workflowType}\n\n建议人工介入处理。`;
    }

    let script = matchedScript.scriptTemplate;

    const context: Record<string, string> = {
      server_ip: alert.server_ip as string || 'unknown',
      alert_title: alert.title || '未知告警',
      service_name: this.extractServiceName(alert.title || '', alert.content || ''),
      target_host: alert.server_ip as string || 'localhost',
      port: String(alert.port || 80),
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date().toISOString()
    };

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      while (script.includes(placeholder)) {
        script = script.split(placeholder).join(value);
      }
    }

    const result = `# 工作流降级执行 - ${matchedScript.description}\n\n## 匹配规则\n- 工作流类型: ${workflowType}\n- 脚本模板: ${matchedScript.workflowType}\n\n## 执行命令\n\`\`\`bash\n${script}\n\`\`\`\n\n## 注意事项\n1. 请在执行前确认环境参数正确\n2. 建议在测试环境先验证\n3. 记录执行结果用于后续分析`;

    logger.info(`✅ [LocalRuleEngine] Workflow fallback script generated for: ${workflowType}`);
    return result;
  }

  recommendKnowledge(alertType: string, alertTitle: string): Array<{ title: string; summary: string; relevance: number }> {
    logger.info(`📚 [LocalRuleEngine] Recommending knowledge for alert type: ${alertType}, title: ${alertTitle}`);

    const searchContent = `${alertType} ${alertTitle}`.toLowerCase();
    const recommendations: Array<{ title: string; summary: string; relevance: number }> = [];

    for (const article of this.knowledgeBase) {
      let score = 0;

      if (article.alertTypes.some(t => alertType.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(alertType.toLowerCase()))) {
        score += 0.5;
      }

      for (const tag of article.tags) {
        if (searchContent.includes(tag.toLowerCase())) {
          score += 0.2;
        }
      }

      for (const keyword of article.title.toLowerCase().split(/\s+/)) {
        if (searchContent.includes(keyword) && keyword.length > 1) {
          score += 0.1;
        }
      }

      if (score > 0) {
        recommendations.push({
          title: article.title,
          summary: article.summary,
          relevance: Math.min(score, 1.0)
        });
      }
    }

    recommendations.sort((a, b) => b.relevance - a.relevance);

    logger.info(`📚 [LocalRuleEngine] Found ${recommendations.length} knowledge recommendations`);
    return recommendations.slice(0, 5);
  }

  getRuleStats(): { totalPatterns: number; totalKnowledgeArticles: number; totalWorkflowScripts: number } {
    return {
      totalPatterns: this.failurePatterns.length,
      totalKnowledgeArticles: this.knowledgeBase.length,
      totalWorkflowScripts: this.workflowScripts.length
    };
  }

  private matchPatterns(content: string): FailurePattern[] {
    const scoredPatterns: Array<{ pattern: FailurePattern; score: number }> = [];

    for (const pattern of this.failurePatterns) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of pattern.keywords) {
        if (content.includes(keyword.toLowerCase())) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      if (score > 0) {
        scoredPatterns.push({ pattern, score });
      }
    }

    scoredPatterns.sort((a, b) => b.score - a.score);

    return scoredPatterns.map(s => s.pattern);
  }

  private calculateConfidence(pattern: FailurePattern, content: string): number {
    const matchedCount = pattern.keywords.filter(k => content.includes(k.toLowerCase())).length;
    const totalKeywords = pattern.keywords.length;

    if (matchedCount === 0) return 0;

    const keywordMatchRatio = matchedCount / totalKeywords;

    const lengthFactor = Math.min(content.length / 100, 1);

    return Math.min(0.95, keywordMatchRatio * 0.7 + lengthFactor * 0.3);
  }

  private generateGenericAnalysis(alertTitle: string, alertContent: string): RuleAnalysisResult {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    return {
      rootCause: `未匹配到预设规则库中的故障模式。告警 "${alertTitle}" 需要进一步人工分析。`,
      symptoms: ['系统异常告警触发', '未匹配到已知故障模式'],
      timeline: [
        { time: now, event: `检测到告警: ${alertTitle}` },
        { time: now, event: '规则库匹配失败，返回通用分析' }
      ],
      evidence: [
        '未匹配到预设故障模式关键词',
        '建议收集更多上下文信息后人工分析'
      ],
      recommendations: [
        '检查系统日志和应用日志获取更多信息',
        '检查近期是否有变更发布',
        '联系相关系统负责人协助排查',
        '考虑将此故障模式添加到规则库中'
      ],
      confidence: 0.3
    };
  }

  private extractServiceName(title: string, content: string): string {
    const combined = `${title} ${content}`.toLowerCase();

    const serviceKeywords = [
      'nginx', 'apache', 'mysql', 'redis', 'postgresql', 'mongo',
      'docker', 'kubernetes', 'jenkins', 'gitlab', 'grafana', 'prometheus'
    ];

    for (const service of serviceKeywords) {
      if (combined.includes(service)) {
        return service;
      }
    }

    const match = combined.match(/(\w+)(?:service|进程|应用|服务)/);
    if (match) {
      return match[1];
    }

    return 'unknown';
  }
}

export const localRuleEngine = new LocalRuleEngine();
export { LocalRuleEngine };
