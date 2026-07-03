export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function getErrorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

export function getErrorStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const statusCode = (err as { statusCode: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return 500;
}
