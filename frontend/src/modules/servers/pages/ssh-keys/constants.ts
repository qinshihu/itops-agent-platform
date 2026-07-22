/**
 * SSHKeys key type 映射常量（2026-07-21 拆分）
 *
 * 把原 SSHKeys.tsx L188-212 的 KEY_TYPE_TEXT + KEY_TYPE_COLOR map 抽出
 * 含 2 个 getter helper
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

const KEY_TYPE_TEXT: Record<string, string> = {
  openssh: 'OpenSSH',
  rsa: 'RSA',
  ec: 'EC',
  dsa: 'DSA',
  pkcs8: 'PKCS#8',
  unknown: '未知',
};

const KEY_TYPE_COLOR: Record<string, string> = {
  openssh: 'text-emerald-500 bg-emerald-500/10',
  rsa: 'text-blue-500 bg-blue-500/10',
  ec: 'text-purple-500 bg-purple-500/10',
  dsa: 'text-yellow-500 bg-yellow-500/10',
  pkcs8: 'text-cyan-500 bg-cyan-500/10',
  unknown: 'text-text-secondary bg-background',
};

/** 获取 key type 显示文本（password auth 类型直接返「账号密码」）*/
export function getKeyTypeText(type: string, authType: string): string {
  if (authType === 'password') return '账号密码';
  return KEY_TYPE_TEXT[type] || type;
}

/** 获取 key type 显示颜色（password auth 类型直接返 orange 色）*/
export function getKeyTypeColor(type: string, authType: string): string {
  if (authType === 'password') return 'text-orange-500 bg-orange-500/10';
  return KEY_TYPE_COLOR[type] || KEY_TYPE_COLOR.unknown;
}
