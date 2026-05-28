import { formatDistanceToNow, isValid } from 'date-fns';

export function safeFormatDistance(dateValue: string | Date | null | undefined, fallback = '未知时间'): string {
  if (!dateValue) return fallback;
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (!isValid(date)) return fallback;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return fallback;
  }
}
