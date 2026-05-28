export const RCA_PROMPT = `你是一个IT运维根因分析专家。请根据以下信息分析故障根因，并以JSON格式输出分析结果。

## 告警信息
- 告警ID: {alert_id}
- 告警标题: {alert_title}
- 告警级别: {severity}
- 告警内容: {alert_message}
- 触发时间: {triggered_at}

## 服务器信息
- 服务器名称: {server_name}
- 服务器IP: {server_ip}
- 服务器状态: {server_status}

## 拓扑信息
{topology_info}

## 变更记录
{change_records}

## 关联告警
{related_alerts}

## 知识库匹配
{knowledge_matches}

请分析上述信息，找出故障的根本原因。输出必须是有效的JSON格式，结构如下：

\`\`\`json
{
  "root_cause": "根因描述，详细说明导致故障的根本原因",
  "root_cause_type": "根因类型，如 configuration|deployment|hardware|network|application|external|unknown",
  "confidence": 0.0-1.0之间的置信度数值,
  "affected_chain": ["受影响的服务器或服务ID列表，按影响传播顺序排列"],
  "timeline": [
    {
      "time": "事件发生时间",
      "event": "事件描述"
    }
  ],
  "evidence": ["支持根因判断的证据列表"],
  "recommendations": ["修复建议和预防措施列表"]
}
\`\`\``;
