import { VendorType, InspectionType, createVendorAdapter } from './vendorAdapter';
import { qanythingService } from './qanythingService';
import { generateCompletion } from './llmService';
import { logger } from '../utils/logger';

export interface GeneratedCommand {
  command: string;
  purpose: string;
  expectedOutput: string;
  risk: 'low' | 'medium' | 'high';
}

export interface CommandAnalysisResult {
  commands: GeneratedCommand[];
  summary: string;
  recommendations: string[];
}

class NetworkCommandGenerator {
  async generateCommands(
    vendor: VendorType,
    description: string,
    types?: InspectionType[]
  ): Promise<GeneratedCommand[]> {
    try {
      const adapter = createVendorAdapter(vendor);
      const standardCommands = types 
        ? adapter.getCommands(types)
        : adapter.getCommands();

      const ragContext = await this.queryRagForCommands(vendor, description);
      
      const prompt = this.buildCommandGenerationPrompt(
        vendor,
        description,
        standardCommands,
        ragContext
      );

      const response = await generateCompletion(
        prompt,
        '你是网络设备巡检专家，精通华为、华三、思科、锐捷、中兴等厂商设备的巡检命令。请根据用户需求生成合适的巡检命令。',
        0.3
      );

      return this.parseGeneratedCommands(response);
    } catch (error) {
      logger.error('Failed to generate custom commands:', error);
      return this.getFallbackCommands(vendor, description);
    }
  }

  async analyzeResult(
    vendor: VendorType,
    command: string,
    output: string
  ): Promise<string> {
    try {
      const prompt = `作为网络设备巡检专家，请分析以下命令的输出结果：

厂商：${vendor}
命令：${command}

输出内容：
\`\`\`
${output.substring(0, 3000)}
\`\`\`

请分析：
1. 该命令输出说明了什么？
2. 设备状态是否正常？
3. 是否有需要关注的问题？
4. 给出专业的建议。

请用简洁的中文回答，控制在300字以内。`;

      return await generateCompletion(
        prompt,
        '你是网络设备巡检专家，擅长分析设备命令输出并提供专业建议。',
        0.3
      );
    } catch (error) {
      logger.error('Failed to analyze command output:', error);
      return 'AI 分析暂不可用，请查看原始输出。';
    }
  }

  private async queryRagForCommands(
    vendor: VendorType,
    description: string
  ): Promise<string> {
    try {
      const query = `${vendor} ${description} 巡检命令`;
      const result = await qanythingService.queryKnowledge(query, 3);
      
      if (result && result.trim().length > 0) {
        return result;
      }
      
      return '';
    } catch (error) {
      logger.warn('RAG query failed, continuing without context:', error);
      return '';
    }
  }

  private buildCommandGenerationPrompt(
    vendor: VendorType,
    description: string,
    standardCommands: Array<{ command: string; name: string; description: string }>,
    ragContext: string
  ): string {
    const standardCmdList = standardCommands
      .map(cmd => `- ${cmd.command} (${cmd.name}: ${cmd.description})`)
      .join('\n');

    return `作为${vendor}网络设备巡检专家，请根据以下需求生成巡检命令：

用户需求：${description}

厂商标准命令参考：
${standardCmdList}

${ragContext ? `知识库参考文档：\n${ragContext}\n` : ''}

请生成 3-8 个巡检命令，要求：
1. 命令必须是 ${vendor} 设备支持的
2. 覆盖用户描述的检查范围
3. 每个命令说明其用途
4. 按照执行顺序排列

请以 JSON 格式返回，格式如下：
[
  {
    "command": "具体命令",
    "purpose": "命令用途说明",
    "expectedOutput": "预期输出特征",
    "risk": "low|medium|high"
  }
]

只返回 JSON 数组，不要其他内容。`;
  }

  private parseGeneratedCommands(response: string): GeneratedCommand[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const commands = JSON.parse(jsonMatch[0]);
        return commands.filter((cmd: any) => cmd.command && cmd.purpose);
      }
    } catch (error) {
      logger.warn('Failed to parse AI generated commands:', error);
    }
    return [];
  }

  private getFallbackCommands(vendor: VendorType, description: string): GeneratedCommand[] {
    const adapter = createVendorAdapter(vendor);
    const allCommands = adapter.getCommands();
    
    return allCommands.slice(0, 5).map(cmd => ({
      command: cmd.command,
      purpose: cmd.description,
      expectedOutput: cmd.expectedPattern || '命令执行成功',
      risk: 'low' as const
    }));
  }
}

export const networkCommandGenerator = new NetworkCommandGenerator();
