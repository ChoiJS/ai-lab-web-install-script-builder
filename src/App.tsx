// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { generateScript } from "./core/generateScript";
import { type ModuleDef, MODULES, type OS } from "./registry/modules";

type Vars = Record<string, string>;

function buildVarsFromInputs(selected: ModuleDef[], vars: Vars): Vars {
  // required input 없으면 그냥 빈 값으로 둠(스크립트는 돌아가게)
  const neededKeys = new Set<string>();
  for (const m of selected) {
    for (const inp of m.inputs ?? []) neededKeys.add(inp.key);
  }
  const out: Vars = { ...vars };
  for (const k of neededKeys) {
    if (out[k] === undefined) out[k] = "";
  }
  return out;
}

const STORAGE_KEY = "ailab_install_builder_state_v1";

function isOS(v: unknown): v is OS {
  return v === "mac" || v === "ubuntu";
}

function loadPersistedState(): {
  os: OS;
  selectedIds: string[];
  vars: Record<string, string>;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no saved state");
    const parsed = JSON.parse(raw);

    return {
      os: isOS(parsed?.os) ? parsed.os : "mac",
      selectedIds: Array.isArray(parsed?.selectedIds) ? parsed.selectedIds : [],
      vars: parsed?.vars && typeof parsed.vars === "object" ? parsed.vars : {},
    };
  } catch {
    return { os: "mac", selectedIds: [], vars: {} };
  }
}

export default function App() {
  const initial = loadPersistedState();

  const [os, setOS] = useState<OS>(initial.os);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds);
  const [vars, setVars] = useState<Vars>(initial.vars);

  useEffect(() => {
    const payload = JSON.stringify({ os, selectedIds, vars });
    localStorage.setItem("ailab_install_builder_state_v1", payload);
  }, [os, selectedIds, vars]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter((m) => {
      const hay = [m.name, m.shortDesc, ...(m.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const selectedModules = useMemo(() => {
    const map = new Map(MODULES.map((m) => [m.id, m]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as ModuleDef[];
  }, [selectedIds]);

  const finalVars = useMemo(
    () => buildVarsFromInputs(selectedModules, vars),
    [selectedModules, vars]
  );

  const result = useMemo(() => {
    return generateScript({
      os,
      selectedIds,
      vars: finalVars,
    });
  }, [os, selectedIds, finalVars]);

  const addModule = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeModule = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setSelectedIds((prev) => {
      const a = [...prev];
      [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
      return a;
    });
  };

  const moveDown = (idx: number) => {
    setSelectedIds((prev) => {
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const a = [...prev];
      [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
      return a;
    });
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(result.script);
    alert("스크립트가 클립보드에 복사됨");
  };

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="title">AI Lab Install Script Builder</div>

        <div className="osSelect">
          <label>OS</label>
          <select value={os} onChange={(e) => setOS(e.target.value as OS)}>
            <option value="mac">macOS</option>
            <option value="ubuntu">Ubuntu</option>
          </select>
        </div>

        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색: git, node, vscode, ssh..."
          />
        </div>
      </header>

      <main className="main">
        <section className="left">
          <div className="panelTitle">Modules</div>
          <div className="list">
            {filtered.map((m) => {
              const already = selectedIds.includes(m.id);
              return (
                <div key={m.id} className="item">
                  <div className="itemMain">
                    <div className="itemName">{m.name}</div>
                    <div className="itemDesc">{m.shortDesc}</div>
                  </div>
                  <button disabled={already} onClick={() => addModule(m.id)}>
                    {already ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mid">
          <div className="panelTitle">Pipeline (Selected)</div>
          {selectedModules.length === 0 ? (
            <div className="empty">왼쪽에서 모듈을 추가하세요.</div>
          ) : (
            <div className="pipeline">
              {selectedModules.map((m, idx) => (
                <div key={m.id} className="pipeItem">
                  <div className="pipeTitle">{m.name}</div>
                  <div className="pipeBtns">
                    <button onClick={() => moveUp(idx)}>↑</button>
                    <button onClick={() => moveDown(idx)}>↓</button>
                    <button onClick={() => removeModule(m.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="panelTitle" style={{ marginTop: 12 }}>
            Inputs
          </div>
          <div className="inputs">
            {selectedModules.flatMap((m) => m.inputs ?? []).length === 0 ? (
              <div className="empty">입력값이 필요한 모듈이 없습니다.</div>
            ) : (
              selectedModules
                .flatMap((m) => m.inputs ?? [])
                .map((inp) => (
                  <div key={inp.key} className="inputRow">
                    <label>{inp.label}</label>
                    <input
                      value={vars[inp.key] ?? ""}
                      placeholder={inp.placeholder ?? ""}
                      onChange={(e) =>
                        setVars((p) => ({ ...p, [inp.key]: e.target.value }))
                      }
                    />
                    {inp.hint ? <div className="hint">{inp.hint}</div> : null}
                  </div>
                ))
            )}
          </div>
        </section>

        <section className="right">
          <div className="panelTitle row">
            <span>Generated Script</span>
            <button onClick={copyScript}>Copy</button>
          </div>
          <textarea className="script" value={result.script} readOnly />
          <div className="smallNote">
            * 스크립트는 선택/순서 변경될 때마다 전체 재생성됩니다. (의존성은
            자동으로 앞에 배치됩니다)
          </div>
        </section>
      </main>
    </div>
  );
}
