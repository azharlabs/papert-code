/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NpmPluginSpec {
  /** The package name used for import resolution (no version). */
  packageName: string;
  /** The original user-provided spec (may include version). */
  raw: string;
  /** Optional version/range (used only for installation). */
  version?: string;
}

/**
 * Parses npm-style plugin specs.
 *
 * Examples:
 * - "papert-plugin-foo" => { packageName: "papert-plugin-foo" }
 * - "papert-plugin-foo@1.2.3" => { packageName: "papert-plugin-foo", version: "1.2.3" }
 * - "@scope/papert-plugin@1.2.3" => { packageName: "@scope/papert-plugin", version: "1.2.3" }
 */
export function parseNpmPluginSpec(raw: string): NpmPluginSpec {
  const trimmed = raw.trim();

  // Scoped packages: @scope/name or @scope/name@version
  if (trimmed.startsWith('@')) {
    const secondAt = trimmed.indexOf('@', 1);
    if (secondAt === -1) {
      return { raw: trimmed, packageName: trimmed };
    }

    return {
      raw: trimmed,
      packageName: trimmed.slice(0, secondAt),
      version: trimmed.slice(secondAt + 1) || undefined,
    };
  }

  // Unscoped: name or name@version
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) {
    return { raw: trimmed, packageName: trimmed };
  }

  return {
    raw: trimmed,
    packageName: trimmed.slice(0, at),
    version: trimmed.slice(at + 1) || undefined,
  };
}

export function getNpmInstallTarget(spec: NpmPluginSpec): string {
  return spec.version ? `${spec.packageName}@${spec.version}` : spec.packageName;
}
