const GITHUB_API_BASE = "https://api.github.com";

export async function fetchPRDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<string> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: {
      Accept: "application/vnd.github.v3.diff",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

export async function postPRComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
  token: string
): Promise<void> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "content-type": "application/json"
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    throw new Error(`Failed to post PR comment: ${response.status} ${response.statusText}`);
  }
}
