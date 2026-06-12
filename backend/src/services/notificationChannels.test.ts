import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
import { sendFeishu, sendWeCom, sendDingTalk, sendNotification } from './notificationChannels';

describe('notificationChannels', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sendFeishu works', async () => {
    const axios = await import('axios');
    (axios.default.post as any).mockResolvedValue({ status: 200 });
    const r = await sendFeishu('https://open.feishu.cn/hook/test', { title: 'Alert', content: 'CPU high', severity: 'critical' });
    expect(r).toBe(true);
  });

  it('sendWeCom works', async () => {
    const axios = await import('axios');
    (axios.default.post as any).mockResolvedValue({ status: 200, data: { errcode: 0 } });
    const r = await sendWeCom('https://qyapi.weixin.qq.com/hook/test', { title: 'Alert', content: 'Disk full', severity: 'warning' });
    expect(r).toBe(true);
  });

  it('sendDingTalk works', async () => {
    const axios = await import('axios');
    (axios.default.post as any).mockResolvedValue({ status: 200, data: { errcode: 0 } });
    const r = await sendDingTalk('https://oapi.dingtalk.com/hook/test', { title: 'Alert', content: 'Memory high', severity: 'critical' });
    expect(r).toBe(true);
  });

  it('sendNotification works', async () => {
    const axios = await import('axios');
    (axios.default.post as any).mockResolvedValue({ status: 200 });
    const r = await sendNotification({ type: 'webhook', url: 'https://hook.test' }, { title: 'Test', content: 'Test', severity: 'info' });
    expect(r).toBeDefined();
  });
});
