export function assertDefined<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }

  return value;
}

export async function withRetry<T>(task: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry attempts exhausted");
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function chunkText(text: string, size = 1200): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks;
}