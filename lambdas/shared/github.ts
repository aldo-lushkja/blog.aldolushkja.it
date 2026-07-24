import { Octokit } from '@octokit/rest';
import { getPipelineSecrets } from './secrets';

export interface OpenDraftPrOptions {
  filePath: string;
  fileContent: string;
  branchName: string;
  prTitle: string;
  prBody: string;
}

function parseRepo(): { owner: string; repo: string } {
  const full = process.env.GITHUB_REPO;
  if (!full || !full.includes('/')) {
    throw new Error(`GITHUB_REPO environment variable must be "owner/repo", got: ${full}`);
  }
  const [owner, repo] = full.split('/');
  return { owner, repo };
}

/**
 * Creates a branch off the repo's default branch, commits a single new file
 * to it, and opens a pull request. Returns the PR's HTML URL.
 */
export async function openDraftPr({ filePath, fileContent, branchName, prTitle, prBody }: OpenDraftPrOptions): Promise<string> {
  const { GITHUB_TOKEN } = await getPipelineSecrets();
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { owner, repo } = parseRepo();

  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
  const baseSha = refData.object.sha;

  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha });

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `content: draft skeleton for "${prTitle}"`,
    content: Buffer.from(fileContent, 'utf-8').toString('base64'),
    branch: branchName,
  });

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: prTitle,
    body: prBody,
    head: branchName,
    base: defaultBranch,
    draft: true,
  });

  return pr.html_url;
}
