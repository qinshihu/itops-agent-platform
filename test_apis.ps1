$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin"}'
$token = $response.data.token
$headers = @{ "Authorization" = "Bearer $token" }

Write-Output "========== 1. Agent 管理 =========="
$agents = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Headers $headers
Write-Output "Agent 数量: $($agents.data.Count)"
$agents.data | ForEach-Object { Write-Output "  - $($_.name) [$($_.status)]" }

Write-Output "`n========== 2. 工作流 =========="
$workflows = Invoke-RestMethod -Uri "http://localhost:3001/api/workflows" -Headers $headers
Write-Output "工作流数量: $($workflows.data.Count)"
$workflows.data | ForEach-Object { Write-Output "  - $($_.name) [模板: $($_.is_template)]" }

Write-Output "`n========== 3. 知识库 =========="
$knowledge = Invoke-RestMethod -Uri "http://localhost:3001/api/knowledge" -Headers $headers
Write-Output "知识条目数量: $($knowledge.data.Count)"

Write-Output "`n========== 4. 告警 =========="
$alerts = Invoke-RestMethod -Uri "http://localhost:3001/api/alerts" -Headers $headers
Write-Output "告警数量: $($alerts.data.Count)"

Write-Output "`n========== 5. Copilot =========="
$conv = Invoke-RestMethod -Uri "http://localhost:3001/api/copilot/conversations" -Method POST -ContentType "application/json" -Headers $headers -Body '{}'
Write-Output "Copilot 对话创建成功: $($conv.success)"

Write-Output "`n========== 6. 通知配置 =========="
$notifs = Invoke-RestMethod -Uri "http://localhost:3001/api/notification-configs" -Headers $headers
Write-Output "通知配置数量: $($notifs.data.Count)"

Write-Output "`n========== 7. 定时任务 =========="
$scheduled = Invoke-RestMethod -Uri "http://localhost:3001/api/scheduled-tasks" -Headers $headers
Write-Output "定时任务数量: $($scheduled.data.Count)"

Write-Output "`n========== 8. 报告 =========="
$reports = Invoke-RestMethod -Uri "http://localhost:3001/api/reports" -Headers $headers
Write-Output "报告数量: $($reports.data.Count)"

Write-Output "`n========== 全部测试完成 =========="
