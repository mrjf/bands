/**
 * Fetch skills from GitHub or local filesystem
 */

import type { LoadedSkill, SkillScript, SkillFrontmatter } from "./types";
import { parseSkillMd } from "./parser";

/**
 * Fetch a skill from a GitHub URL or local path.
 *
 * Supports:
 * - GitHub URLs: github.com/owner/repo/tree/branch/path/to/skill
 * - GitHub raw URLs: raw.githubusercontent.com/...
 * - Local paths: /path/to/skill or ./relative/skill
 */
export async function fetchSkill(source: string): Promise<LoadedSkill> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return fetchRemoteSkill(source);
  } else {
    return fetchLocalSkill(source);
  }
}

/**
 * Fetch a skill from GitHub
 */
async function fetchRemoteSkill(url: string): Promise<LoadedSkill> {
  // Convert github.com URL to raw URL base
  let rawBase: string;

  if (url.includes("raw.githubusercontent.com")) {
    // Already a raw URL, extract the base path
    rawBase = url.replace(/\/?$/, "");
  } else if (url.includes("github.com")) {
    // Convert github.com/owner/repo/tree/branch/path to raw URL
    // github.com/owner/repo/tree/main/skills/my-skill
    // -> raw.githubusercontent.com/owner/repo/main/skills/my-skill
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/);
    if (match) {
      const [, owner, repo, branch, path] = match;
      rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    } else {
      // Try github.com/owner/repo/path format (assumes main branch)
      const match2 = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(.+)/);
      if (match2) {
        const [, owner, repo, path] = match2;
        rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
      } else {
        throw new Error(`Cannot parse GitHub URL: ${url}`);
      }
    }
  } else {
    throw new Error(`Unsupported URL format: ${url}`);
  }

  // Fetch SKILL.md
  const skillMdUrl = `${rawBase}/SKILL.md`;
  const skillMdResp = await fetch(skillMdUrl);
  if (!skillMdResp.ok) {
    throw new Error(`Failed to fetch SKILL.md from ${skillMdUrl}: ${skillMdResp.status}`);
  }
  const skillMdContent = await skillMdResp.text();

  // Parse the skill
  const { frontmatter, instructions } = parseSkillMd(skillMdContent);

  // Fetch scripts (try common script files)
  const scripts = new Map<string, SkillScript>();
  const scriptFiles = ["main.py", "main.sh", "main.js", "main.ts", "run.py", "run.sh", "run.js"];

  for (const filename of scriptFiles) {
    try {
      const scriptUrl = `${rawBase}/scripts/${filename}`;
      const resp = await fetch(scriptUrl);
      if (resp.ok) {
        const content = await resp.text();
        scripts.set(filename, {
          filename,
          language: detectLanguage(filename),
          content,
        });
      }
    } catch {
      // Script doesn't exist, that's fine
    }
  }

  // Fetch references (try README and common docs)
  const references = new Map<string, string>();
  const refFiles = ["README.md", "examples.md", "api.md"];

  for (const filename of refFiles) {
    try {
      const refUrl = `${rawBase}/references/${filename}`;
      const resp = await fetch(refUrl);
      if (resp.ok) {
        references.set(filename, await resp.text());
      }
    } catch {
      // Reference doesn't exist
    }
  }

  // Fetch templates (try common template files)
  const templateFiles = ["viewer.html", "generator_template.js", "template.html", "template.js", "index.html"];

  for (const filename of templateFiles) {
    try {
      const templateUrl = `${rawBase}/templates/${filename}`;
      const resp = await fetch(templateUrl);
      if (resp.ok) {
        // Store templates in references with a templates/ prefix
        references.set(`templates/${filename}`, await resp.text());
      }
    } catch {
      // Template doesn't exist
    }
  }

  return {
    frontmatter,
    instructions,
    scripts,
    references,
    assets: new Map(), // Assets require binary fetch, skip for now
    source: url,
  };
}

/**
 * Fetch a skill from local filesystem (Bun only)
 */
async function fetchLocalSkill(path: string): Promise<LoadedSkill> {
  const fs = await import("fs");
  const pathLib = await import("path");

  const skillDir = pathLib.resolve(path);

  // Read SKILL.md
  const skillMdPath = pathLib.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found at ${skillMdPath}`);
  }
  const skillMdContent = fs.readFileSync(skillMdPath, "utf-8");
  const { frontmatter, instructions } = parseSkillMd(skillMdContent);

  // Read scripts
  const scripts = new Map<string, SkillScript>();
  const scriptsDir = pathLib.join(skillDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    for (const filename of fs.readdirSync(scriptsDir)) {
      const content = fs.readFileSync(pathLib.join(scriptsDir, filename), "utf-8");
      scripts.set(filename, {
        filename,
        language: detectLanguage(filename),
        content,
      });
    }
  }

  // Read references
  const references = new Map<string, string>();
  const refsDir = pathLib.join(skillDir, "references");
  if (fs.existsSync(refsDir)) {
    for (const filename of fs.readdirSync(refsDir)) {
      const content = fs.readFileSync(pathLib.join(refsDir, filename), "utf-8");
      references.set(filename, content);
    }
  }

  // Read assets
  const assets = new Map<string, Uint8Array>();
  const assetsDir = pathLib.join(skillDir, "assets");
  if (fs.existsSync(assetsDir)) {
    for (const filename of fs.readdirSync(assetsDir)) {
      const content = fs.readFileSync(pathLib.join(assetsDir, filename));
      assets.set(filename, new Uint8Array(content));
    }
  }

  return {
    frontmatter,
    instructions,
    scripts,
    references,
    assets,
    source: path,
  };
}

function detectLanguage(filename: string): SkillScript["language"] {
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".sh") || filename.endsWith(".bash")) return "bash";
  if (filename.endsWith(".js") || filename.endsWith(".mjs")) return "javascript";
  if (filename.endsWith(".ts") || filename.endsWith(".mts")) return "typescript";
  return "unknown";
}
