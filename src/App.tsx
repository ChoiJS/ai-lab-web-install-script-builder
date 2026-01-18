import { useMemo, useState } from "react";
import "./App.css";

type Platform = "mac" | "ubuntu";

type Item = {
  id: string;
  label: string;
  desc?: string;
  commands: Record<Platform, string[]>;
  default?: boolean;
};

const ITEMS: Item[] = [
  {
    id: "brew",
    label: "Homebrew (macOS)",
    desc: "brew 없으면 설치",
    commands: {
      mac: [
        "# Homebrew",
        "if ! command -v brew >/dev/null 2>&1; then",
        '  echo "[+] Installing Homebrew..."',
        '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        "fi",
      ],
      ubuntu: [],
    },
    default: true,
  },
  {
    id: "git",
    label: "Git",
    commands: {
      mac: ["brew install git"],
      ubuntu: ["sudo apt-get update -y", "sudo apt-get install -y git"],
    },
    default: true,
  },
  {
    id: "nvm_node",
    label: "Node (NVM + LTS)",
    desc: "Homebrew 대신 NVM 방식",
    commands: {
      mac: [
        "# NVM + Node LTS",
        'export NVM_DIR="$HOME/.nvm"',
        'if [ ! -d "$NVM_DIR" ]; then',
        '  echo "[+] Installing nvm..."',
        "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash",
        "fi",
        '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
        "nvm install --lts",
        "nvm use --lts",
        "node -v",
        "npm -v",
      ],
      ubuntu: [
        "# NVM + Node LTS",
        'export NVM_DIR="$HOME/.nvm"',
        'if [ ! -d "$NVM_DIR" ]; then',
        '  echo "[+] Installing nvm..."',
        "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash",
        "fi",
        '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
        "nvm install --lts",
        "nvm use --lts",
        "node -v",
        "npm -v",
      ],
    },
    default: true,
  },
  {
    id: "ssh_github",
    label: "GitHub SSH Key",
    desc: "ed25519 키 생성 + agent 등록",
    commands: {
      mac: [
        "# GitHub SSH key (ed25519)",
        "mkdir -p ~/.ssh",
        'ssh-keygen -t ed25519 -C "YOUR_EMAIL" -f ~/.ssh/id_ed25519',
        'eval "$(ssh-agent -s)"',
        "ssh-add ~/.ssh/id_ed25519",
        'echo "[+] Copy this and paste into GitHub → Settings → SSH Keys"',
        "cat ~/.ssh/id_ed25519.pub",
        "ssh -T git@github.com",
      ],
      ubuntu: [
        "# GitHub SSH key (ed25519)",
        "mkdir -p ~/.ssh",
        'ssh-keygen -t ed25519 -C "YOUR_EMAIL" -f ~/.ssh/id_ed25519',
        'eval "$(ssh-agent -s)"',
        "ssh-add ~/.ssh/id_ed25519",
        'echo "[+] Copy this and paste into GitHub → Settings → SSH Keys"',
        "cat ~/.ssh/id_ed25519.pub",
        "ssh -T git@github.com",
      ],
    },
  },
];

function buildScript(platform: Platform, selected: Set<string>): string {
  const lines: string[] = [];

  lines.push("#!/usr/bin/env bash");
  lines.push("set -euo pipefail");
  lines.push("");
  lines.push(`echo "[+] Platform: ${platform}"`);
  lines.push("");

  if (platform === "ubuntu") {
    // apt 기반은 기본 업데이트 깔아주는게 안전
    lines.push("# Base");
    lines.push("sudo apt-get update -y");
    lines.push("");
  }

  for (const item of ITEMS) {
    if (!selected.has(item.id)) continue;
    const cmds = item.commands[platform];
    if (!cmds || cmds.length === 0) continue;

    lines.push(`# --- ${item.label} ---`);
    lines.push(...cmds);
    lines.push("");
  }

  return lines.join("\n");
}

export default function App() {
  const [platform, setPlatform] = useState<Platform>("mac");
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const it of ITEMS) if (it.default) s.add(it.id);
    return s;
  });

  const script = useMemo(
    () => buildScript(platform, selected),
    [platform, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(script);
    alert("Copied!");
  };

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>AI Lab · Install Script Builder</h1>
          <p className="sub">
            체크박스로 설치 스크립트를 조립하고 그대로 복사해서 실행.
          </p>
        </div>

        <div className="controls">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            <option value="mac">macOS</option>
            <option value="ubuntu">Ubuntu</option>
          </select>
          <button className="btn" onClick={copy}>
            Copy Script
          </button>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Options</h2>
          <div className="list">
            {ITEMS.map((it) => {
              const disabled = it.commands[platform].length === 0;
              return (
                <label
                  key={it.id}
                  className={`row ${disabled ? "disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={() => toggle(it.id)}
                    disabled={disabled}
                  />
                  <div className="meta">
                    <div className="label">{it.label}</div>
                    {it.desc ? <div className="desc">{it.desc}</div> : null}
                    {disabled ? (
                      <div className="desc dim">(이 플랫폼에서는 없음)</div>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="note">
            <div className="noteTitle">주의</div>
            <div className="noteBody">
              GitHub SSH Key의 <code>YOUR_EMAIL</code> 은 본인 이메일로 바꿔야
              함.
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Generated Script</h2>
          <textarea readOnly value={script} spellCheck={false} />
          <div className="hint">
            실행은 터미널에서: <code>bash script.sh</code> (또는 복붙 실행)
          </div>
        </section>
      </div>
    </div>
  );
}
