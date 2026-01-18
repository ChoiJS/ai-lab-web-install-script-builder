// src/core/generateScript.ts
import { type ModuleDef, MODULES, type OS } from "../registry/modules";

export type GenerateInput = {
  os: OS;
  selectedIds: string[];
  vars: Record<string, string>; // {{key}} 치환값
};

function mapById(): Map<string, ModuleDef> {
  return new Map(MODULES.map((m) => [m.id, m]));
}

/** 선택한 모듈 + requires(필수 의존성) 재귀 포함 */
function resolveWithDeps(
  ids: string[],
  byId: Map<string, ModuleDef>
): string[] {
  const visited = new Set<string>();
  const out: string[] = [];

  const dfs = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);

    const mod = byId.get(id);
    if (!mod) return;

    for (const dep of mod.requires ?? []) dfs(dep);
    out.push(id);
  };

  for (const id of ids) dfs(id);
  return out;
}

/**
 * 단순 topo sort:
 * - 이미 DFS에서 dep 먼저 push 하므로, 기본적으로 올바른 순서가 나옴
 * - 다만 중복/비정상 입력 방어용으로 다시 unique 처리
 */
function uniqueKeepOrder(ids: string[]): string[] {
  const s = new Set<string>();
  const r: string[] = [];
  for (const x of ids) {
    if (s.has(x)) continue;
    s.add(x);
    r.push(x);
  }
  return r;
}

/** bash double-quote 안전 치환 (최소 방어) */
function escapeForDoubleQuotes(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`");
}

function applyVars(script: string, vars: Record<string, string>): string {
  return script.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const raw = vars[key] ?? "";
    return escapeForDoubleQuotes(raw);
  });
}

export function generateScript(input: GenerateInput): {
  script: string;
  includedIds: string[];
} {
  const byId = mapById();

  const withDeps = resolveWithDeps(input.selectedIds, byId);
  const ordered = uniqueKeepOrder(withDeps);

  const blocks: string[] = [];

  blocks.push(`#!/usr/bin/env bash
set -e

echo "===================================="
echo "AI Lab Install Script Builder - RUN"
echo "OS: ${input.os}"
echo "===================================="
`);

  for (const id of ordered) {
    const mod = byId.get(id);
    if (!mod) continue;

    const s = mod.script[input.os];
    if (!s) {
      blocks.push(`echo "[SKIP] ${mod.name} (not supported on ${input.os})"`);
      continue;
    }

    blocks.push(
      `\n# --------------------------------------------\n# ${mod.name} (${mod.id})\n# --------------------------------------------\n`
    );
    blocks.push(applyVars(s, input.vars));
  }

  blocks.push(`\necho "===================================="
echo "[DONE] Script finished."
echo "===================================="
`);

  return {
    script: blocks.join("\n"),
    includedIds: ordered,
  };
}
