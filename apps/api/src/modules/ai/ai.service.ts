export function buildReviewContext(language: string | undefined, repository: string | undefined, context: string | undefined): string {
  const parts = [
    language ? `Language: ${language}` : null,
    repository ? `Repository: ${repository}` : null,
    context ? `Context: ${context}` : null
  ].filter(Boolean);

  return parts.join("\n");
}