/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { simpleGit } from 'simple-git';
import { getErrorMessage } from '../../utils/errors.js';
import type {
  ExtensionInstallMetadata,
  GeminiCLISkill,
} from '@papert-code/papert-code-core';
import { SkillUpdateState } from '../../ui/state/skills.js';
import * as os from 'node:os';
import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SKILL_FILENAME, loadSkill } from '../skill.js';
import * as tar from 'tar';
import extract from 'extract-zip';

function getGitHubToken(): string | undefined {
  return process.env['GITHUB_TOKEN'];
}

export async function cloneFromGit(
  installMetadata: ExtensionInstallMetadata,
  destination: string,
): Promise<void> {
  try {
    const git = simpleGit(destination);
    let sourceUrl = installMetadata.source;
    const token = getGitHubToken();
    if (token) {
      try {
        const parsedUrl = new URL(sourceUrl);
        if (
          parsedUrl.protocol === 'https:' &&
          parsedUrl.hostname === 'github.com'
        ) {
          if (!parsedUrl.username) {
            parsedUrl.username = token;
          }
          sourceUrl = parsedUrl.toString();
        }
      } catch {
        // noop
      }
    }
    await git.clone(sourceUrl, './', ['--depth', '1']);

    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
      throw new Error(
        `Unable to find any remotes for repo ${installMetadata.source}`,
      );
    }

    const refToFetch = installMetadata.ref || 'HEAD';

    await git.fetch(remotes[0].name, refToFetch);

    await git.checkout('FETCH_HEAD');
  } catch (error) {
    throw new Error(
      `Failed to clone Git repository from ${installMetadata.source} ${getErrorMessage(error)}`,
      {
        cause: error,
      },
    );
  }
}

export function parseGitHubRepoForReleases(source: string): {
  owner: string;
  repo: string;
} {
  const parsedUrl = URL.parse(source, 'https://github.com');
  const parts = parsedUrl?.pathname.substring(1).split('/');
  if (parts?.length !== 2 || parsedUrl?.host !== 'github.com') {
    throw new Error(
      `Invalid GitHub repository source: ${source}. Expected "owner/repo" or a github repo uri.`,
    );
  }
  const owner = parts[0];
  const repo = parts[1].replace('.git', '');

  if (owner.startsWith('git@github.com')) {
    throw new Error(
      'GitHub release-based skills are not supported for SSH. You must use an HTTPS URI with a personal access token to download releases from private repositories. You can set your personal access token in the GITHUB_TOKEN environment variable and install the skill via SSH.',
    );
  }

  return { owner, repo };
}

async function fetchReleaseFromGithub(
  owner: string,
  repo: string,
  ref?: string,
): Promise<GithubReleaseData> {
  const endpoint = ref ? `releases/tags/${ref}` : 'releases/latest';
  const url = `https://api.github.com/repos/${owner}/${repo}/${endpoint}`;
  return await fetchJson(url);
}

export async function checkForSkillUpdate(
  skill: GeminiCLISkill,
  setSkillUpdateState: (updateState: SkillUpdateState) => void,
  cwd: string = process.cwd(),
): Promise<void> {
  setSkillUpdateState(SkillUpdateState.CHECKING_FOR_UPDATES);
  const installMetadata = skill.installMetadata;
  if (installMetadata?.type === 'local') {
    const newSkill = loadSkill({
      skillDir: installMetadata.source,
      workspaceDir: cwd,
    });
    if (!newSkill) {
      console.error(
        `Failed to check for update for local skill "${skill.name}". Could not load skill from source path: ${installMetadata.source}`,
      );
      setSkillUpdateState(SkillUpdateState.ERROR);
      return;
    }
    if (newSkill.config.version !== skill.version) {
      setSkillUpdateState(SkillUpdateState.UPDATE_AVAILABLE);
      return;
    }
    setSkillUpdateState(SkillUpdateState.UP_TO_DATE);
    return;
  }
  if (
    !installMetadata ||
    (installMetadata.type !== 'git' &&
      installMetadata.type !== 'github-release')
  ) {
    setSkillUpdateState(SkillUpdateState.NOT_UPDATABLE);
    return;
  }
  try {
    if (installMetadata.type === 'git') {
      if (!fs.existsSync(path.join(skill.path, '.git'))) {
        console.error(
          `Skill "${skill.name}" was installed without git metadata and cannot be auto-updated.`,
        );
        setSkillUpdateState(SkillUpdateState.NOT_UPDATABLE);
        return;
      }
      const git = simpleGit(skill.path);
      const remotes = await git.getRemotes(true);
      if (remotes.length === 0) {
        console.error('No git remotes found.');
        setSkillUpdateState(SkillUpdateState.ERROR);
        return;
      }
      const remoteUrl = remotes[0].refs.fetch;
      if (!remoteUrl) {
        console.error(`No fetch URL found for git remote ${remotes[0].name}.`);
        setSkillUpdateState(SkillUpdateState.ERROR);
        return;
      }

      const refToCheck = installMetadata.ref || 'HEAD';

      const lsRemoteOutput = await git.listRemote([remoteUrl, refToCheck]);

      if (typeof lsRemoteOutput !== 'string' || lsRemoteOutput.trim() === '') {
        console.error(`Git ref ${refToCheck} not found.`);
        setSkillUpdateState(SkillUpdateState.ERROR);
        return;
      }

      const remoteHash = lsRemoteOutput.split('\t')[0];
      const localHash = await git.revparse(['HEAD']);

      if (!remoteHash) {
        console.error(
          `Unable to parse hash from git ls-remote output "${lsRemoteOutput}"`,
        );
        setSkillUpdateState(SkillUpdateState.ERROR);
        return;
      }
      if (remoteHash === localHash) {
        setSkillUpdateState(SkillUpdateState.UP_TO_DATE);
        return;
      }
      setSkillUpdateState(SkillUpdateState.UPDATE_AVAILABLE);
      return;
    }
    const { source, releaseTag } = installMetadata;
    if (!source) {
      console.error('No "source" provided for skill.');
      setSkillUpdateState(SkillUpdateState.ERROR);
      return;
    }
    const { owner, repo } = parseGitHubRepoForReleases(source);

    const releaseData = await fetchReleaseFromGithub(
      owner,
      repo,
      installMetadata.ref,
    );
    if (releaseData.tag_name !== releaseTag) {
      setSkillUpdateState(SkillUpdateState.UPDATE_AVAILABLE);
      return;
    }
    setSkillUpdateState(SkillUpdateState.UP_TO_DATE);
  } catch (error) {
    console.error(
      `Failed to check for updates for skill "${installMetadata.source}": ${getErrorMessage(error)}`,
    );
    setSkillUpdateState(SkillUpdateState.ERROR);
  }
}

export interface GitHubDownloadResult {
  tagName: string;
  type: 'git' | 'github-release';
}

export async function downloadFromGitHubRelease(
  installMetadata: ExtensionInstallMetadata,
  destination: string,
): Promise<GitHubDownloadResult> {
  const { source, ref } = installMetadata;
  const { owner, repo } = parseGitHubRepoForReleases(source);

  try {
    const releaseData = await fetchReleaseFromGithub(owner, repo, ref);
    if (!releaseData) {
      throw new Error(
        `No release data found for ${owner}/${repo} at tag ${ref}`,
      );
    }

    const asset = findReleaseAsset(releaseData.assets);
    let archiveUrl: string | undefined;
    let isTar = false;
    let isZip = false;
    if (asset) {
      archiveUrl = asset.browser_download_url;
    } else {
      if (releaseData.tarball_url) {
        archiveUrl = releaseData.tarball_url;
        isTar = true;
      } else if (releaseData.zipball_url) {
        archiveUrl = releaseData.zipball_url;
        isZip = true;
      }
    }
    if (!archiveUrl) {
      throw new Error(
        `No assets found for release with tag ${releaseData.tag_name}`,
      );
    }
    let downloadedAssetPath = path.join(
      destination,
      path.basename(new URL(archiveUrl).pathname),
    );
    if (isTar && !downloadedAssetPath.endsWith('.tar.gz')) {
      downloadedAssetPath += '.tar.gz';
    } else if (isZip && !downloadedAssetPath.endsWith('.zip')) {
      downloadedAssetPath += '.zip';
    }

    await downloadFile(archiveUrl, downloadedAssetPath);

    await extractFile(downloadedAssetPath, destination);

    const entries = await fs.promises.readdir(destination, {
      withFileTypes: true,
    });
    if (entries.length === 2) {
      const lonelyDir = entries.find((entry) => entry.isDirectory());
      if (
        lonelyDir &&
        fs.existsSync(path.join(destination, lonelyDir.name, SKILL_FILENAME))
      ) {
        const dirPathToExtract = path.join(destination, lonelyDir.name);
        const extractedDirFiles = await fs.promises.readdir(dirPathToExtract);
        for (const file of extractedDirFiles) {
          await fs.promises.rename(
            path.join(dirPathToExtract, file),
            path.join(destination, file),
          );
        }
        await fs.promises.rmdir(dirPathToExtract);
      }
    }

    await fs.promises.unlink(downloadedAssetPath);
    return {
      tagName: releaseData.tag_name,
      type: 'github-release',
    };
  } catch (error) {
    throw new Error(
      `Failed to download release from ${installMetadata.source}: ${getErrorMessage(error)}`,
    );
  }
}

interface GithubReleaseData {
  assets: Asset[];
  tag_name: string;
  tarball_url?: string;
  zipball_url?: string;
}

interface Asset {
  name: string;
  browser_download_url: string;
}

export function findReleaseAsset(assets: Asset[]): Asset | undefined {
  const platform = os.platform();
  const arch = os.arch();

  const platformArchPrefix = `${platform}.${arch}.`;
  const platformPrefix = `${platform}.`;

  const platformArchAsset = assets.find((asset) =>
    asset.name.toLowerCase().startsWith(platformArchPrefix),
  );
  if (platformArchAsset) {
    return platformArchAsset;
  }

  const platformAsset = assets.find((asset) =>
    asset.name.toLowerCase().startsWith(platformPrefix),
  );
  if (platformAsset) {
    return platformAsset;
  }

  const genericAsset = assets.find(
    (asset) =>
      !asset.name.toLowerCase().includes('darwin') &&
      !asset.name.toLowerCase().includes('linux') &&
      !asset.name.toLowerCase().includes('win32'),
  );
  if (assets.length === 1) {
    return genericAsset;
  }

  return undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
  const headers: { 'User-Agent': string; Authorization?: string } = {
    'User-Agent': 'papert-code',
  };
  const token = getGitHubToken();
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode !== 200) {
          return reject(
            new Error(`Request failed with status code ${res.statusCode}`),
          );
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString();
          resolve(JSON.parse(data) as T);
        });
      })
      .on('error', reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const headers: { 'User-agent': string; Authorization?: string } = {
    'User-agent': 'papert-code',
  };
  const token = getGitHubToken();
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          return reject(
            new Error(`Request failed with status code ${res.statusCode}`),
          );
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve as () => void));
      })
      .on('error', reject);
  });
}

export async function extractFile(file: string, dest: string): Promise<void> {
  if (file.endsWith('.tar.gz')) {
    await tar.x({
      file,
      cwd: dest,
    });
  } else if (file.endsWith('.zip')) {
    await extract(file, { dir: dest });
  } else {
    throw new Error(`Unsupported file extension for extraction: ${file}`);
  }
}
