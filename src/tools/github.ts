import { Octokit } from '@octokit/rest';
import { config } from '../config';

function getOctokit() {
  if (!config.github.token) {
    throw new Error('GitHub not configured (GITHUB_TOKEN missing)');
  }
  return new Octokit({ auth: config.github.token });
}

export async function listRepos(args: { limit?: number; type?: string }): Promise<string> {
  const octokit = getOctokit();
  const type = (args.type as 'all' | 'public' | 'private') || 'all';
  const perPage = args.limit ?? 20;

  const res = await octokit.repos.listForAuthenticatedUser({
    type,
    per_page: perPage,
    sort: 'updated',
  });

  if (res.data.length === 0) return 'No repositories found.';

  return res.data
    .map((r) => `${r.full_name} | ${r.private ? 'private' : 'public'} | Stars: ${r.stargazers_count} | Updated: ${r.updated_at?.substring(0, 10)}`)
    .join('\n');
}

export async function createRepo(args: {
  name: string;
  description?: string;
  private?: string;
  autoInit?: string;
}): Promise<string> {
  const octokit = getOctokit();

  const res = await octokit.repos.createForAuthenticatedUser({
    name: args.name,
    description: args.description,
    private: args.private === 'true',
    auto_init: args.autoInit !== 'false',
  });

  return `Repository created: ${res.data.html_url}`;
}

export async function writeFile(args: {
  repo?: string;
  path: string;
  content: string;
  message: string;
  branch?: string;
}): Promise<string> {
  const octokit = getOctokit();
  const owner = config.github.username;
  const repo = args.repo || config.github.defaultRepo;
  const branch = args.branch || 'main';

  if (!repo) throw new Error('No repo specified and GITHUB_DEFAULT_REPO not set');

  const encoded = Buffer.from(args.content).toString('base64');

  // Check if file exists to get its SHA (required for updates)
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: args.path,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && 'sha' in existing.data) {
      sha = existing.data.sha;
    }
  } catch {
    // File doesn't exist, create it
  }

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: args.path,
    message: args.message,
    content: encoded,
    branch,
    sha,
  });

  const action = sha ? 'Updated' : 'Created';
  return `${action} ${args.path} in ${owner}/${repo}@${branch}. Commit: ${res.data.commit.sha?.substring(0, 7)}`;
}

export async function readFile(args: { repo: string; path: string; branch?: string }): Promise<string> {
  const octokit = getOctokit();
  const owner = config.github.username;
  const branch = args.branch || 'main';

  const res = await octokit.repos.getContent({
    owner,
    repo: args.repo,
    path: args.path,
    ref: branch,
  });

  if (Array.isArray(res.data)) {
    return `${args.path} is a directory. Contents:\n${res.data.map((f) => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n')}`;
  }

  if ('content' in res.data && res.data.content) {
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return `File: ${args.path}\n\`\`\`\n${content.substring(0, 3000)}${content.length > 3000 ? '\n... (truncated)' : ''}\n\`\`\``;
  }

  return 'Could not read file content.';
}

export async function createIssue(args: {
  repo: string;
  title: string;
  body: string;
  labels?: string;
}): Promise<string> {
  const octokit = getOctokit();
  const owner = config.github.username;
  const labels = args.labels ? args.labels.split(',').map((l) => l.trim()) : [];

  const res = await octokit.issues.create({
    owner,
    repo: args.repo,
    title: args.title,
    body: args.body,
    labels,
  });

  return `Issue created: ${res.data.html_url}`;
}
