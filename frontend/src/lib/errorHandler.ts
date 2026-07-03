export function getErrorMessage(err: unknown, fallback = '操作失败'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function handleApiError(err: unknown, context?: string): string {
  const msg = getErrorMessage(err, '请求失败');
  const fullMsg = context ? `${context}: ${msg}` : msg;
  console.error(`[API Error]${context ? ` ${context}` : ''}:`, err);
  return fullMsg;
}
