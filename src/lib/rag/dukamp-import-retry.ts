export async function retryDuKampImportStep<T>(
  operation: () => Promise<T>,
  onRetry: (attempt: number) => void,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt >= 3 ||
        !/timeout|timed out|aborted|network|failed to fetch|tempor[aá]ri|503|504|429|verificar a permiss[aã]o/i.test(
          message,
        )
      )
        throw error;
      onRetry(attempt + 1);
      await wait(attempt * 2000);
    }
  }
}
