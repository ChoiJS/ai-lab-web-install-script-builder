// src/registry/modules.ts
export type OS = "mac" | "ubuntu";

export type Category =
  | "os_reset"
  | "beginner"
  | "dev_env"
  | "languages"
  | "convenience";

export type OverwritePolicy = "skip" | "overwrite";

export type InputDef = {
  key: string; // e.g. "git_name"
  label: string; // UI label
  placeholder?: string;
  required?: boolean;
  sensitive?: boolean; // true => UI에서 마스킹(비번/키 같은 것)
  defaultValue?: string;
  hint?: string; // 작은 설명(1줄)
};

export type ScriptByOS = Partial<Record<OS, string>>;

export type InstallCheckByOS = Partial<Record<OS, string>>;

export type ModuleDef = {
  id: string;
  name: string;
  category: Category[];
  tags: string[]; // 검색용 키워드
  iconSlug?: string; // simpleicons slug (ex: "homebrew")
  shortDesc: string; // hover 1줄
  requires?: string[]; // hard deps
  suggests?: string[]; // soft deps
  inputs?: InputDef[]; // UI 입력값
  defaultPolicy?: OverwritePolicy; // 기본: skip
  installCheck?: InstallCheckByOS; // 이미 설치되었는지 판단 (bash expr)
  script: ScriptByOS; // 실제 설치 스크립트 조각
  notSupportedReason?: Partial<Record<OS, string>>; // 지원 안하면 UI 표시
};

/**
 * 스크립트 안에서 치환되는 변수 규칙:
 *  - {{var}} 형태로 넣고, generator에서 값 치환
 *  - 예: {{git_name}}, {{git_email}}, {{ssh_email}}
 */
export const MODULES: ModuleDef[] = [
  // ------------------------------------------------------------
  // OS RESET / BEGINNER BASE
  // ------------------------------------------------------------
  {
    id: "base.clt",
    name: "Xcode Command Line Tools",
    category: ["os_reset", "beginner"],
    tags: ["xcode", "clang", "make", "git", "build", "mac"],
    iconSlug: "apple",
    shortDesc: "macOS에서 개발 도구(컴파일러/기본 유틸) 설치",
    defaultPolicy: "skip",
    installCheck: {
      mac: `xcode-select -p >/dev/null 2>&1`,
      ubuntu: `true`,
    },
    script: {
      mac: `
echo "[CLT] Checking Xcode Command Line Tools..."
if xcode-select -p >/dev/null 2>&1; then
  echo "[CLT] Already installed. Skipping."
else
  echo "[CLT] Installing... (a popup may appear)"
  xcode-select --install || true
  echo "[CLT] If installer popup opened, finish it then re-run the script."
fi
`,
      ubuntu: `
echo "[CLT] Not applicable on Ubuntu. Skipping."
`,
    },
  },
  {
    id: "base.homebrew",
    name: "Homebrew",
    category: ["os_reset", "beginner", "dev_env"],
    tags: ["brew", "package manager", "mac"],
    iconSlug: "homebrew",
    shortDesc: "macOS 패키지 매니저(Homebrew) 설치",
    defaultPolicy: "skip",
    requires: ["base.clt"],
    installCheck: {
      mac: `command -v brew >/dev/null 2>&1`,
      ubuntu: `true`,
    },
    script: {
      mac: `
echo "[BREW] Checking Homebrew..."
if command -v brew >/dev/null 2>&1; then
  echo "[BREW] Already installed. Skipping."
else
  echo "[BREW] Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Intel Mac 기준: /usr/local/bin/brew
  if [ -x "/usr/local/bin/brew" ]; then
    echo "[BREW] Installed at /usr/local/bin/brew"
  fi
fi
`,
      ubuntu: `
echo "[BREW] Not used on Ubuntu (apt preferred). Skipping."
`,
    },
    notSupportedReason: {
      ubuntu: "Ubuntu는 apt 기반으로 진행합니다.",
    },
  },
  {
    id: "base.apt",
    name: "apt update + essentials",
    category: ["os_reset", "beginner", "dev_env"],
    tags: ["apt", "ubuntu", "curl", "git", "build-essential"],
    iconSlug: "ubuntu",
    shortDesc: "Ubuntu 필수 패키지 업데이트 + 기본 유틸 설치",
    defaultPolicy: "skip",
    installCheck: {
      ubuntu: `command -v curl >/dev/null 2>&1`,
      mac: `true`,
    },
    script: {
      ubuntu: `
echo "[APT] Updating apt & installing essentials..."
sudo apt-get update -y
sudo apt-get install -y curl git build-essential ca-certificates
`,
      mac: `
echo "[APT] Not applicable on macOS. Skipping."
`,
    },
  },

  // ------------------------------------------------------------
  // DEV CORE
  // ------------------------------------------------------------
  {
    id: "dev.git",
    name: "Git",
    category: ["beginner", "dev_env"],
    tags: ["git", "version control"],
    iconSlug: "git",
    shortDesc: "버전관리 도구 Git 설치",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v git >/dev/null 2>&1`,
      ubuntu: `command -v git >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[GIT] Installing git..."
if command -v git >/dev/null 2>&1; then
  echo "[GIT] Already installed. Skipping."
else
  brew install git
fi
`,
      ubuntu: `
echo "[GIT] Installing git..."
if command -v git >/dev/null 2>&1; then
  echo "[GIT] Already installed. Skipping."
else
  sudo apt-get install -y git
fi
`,
    },
  },
  {
    id: "dev.git_config",
    name: "Git: user.name / user.email",
    category: ["beginner", "dev_env"],
    tags: ["git config", "name", "email"],
    iconSlug: "git",
    shortDesc: "Git 커밋 작성자 정보를 자동 설정",
    defaultPolicy: "skip",
    requires: ["dev.git"],
    inputs: [
      {
        key: "git_name",
        label: "Git user.name",
        placeholder: "ChoiJS",
        required: true,
        hint: "커밋에 찍힐 이름",
      },
      {
        key: "git_email",
        label: "Git user.email",
        placeholder: "you@example.com",
        required: true,
        hint: "커밋에 찍힐 이메일",
      },
    ],
    script: {
      mac: `
echo "[GIT-CONFIG] Setting global git identity..."
git config --global user.name "{{git_name}}"
git config --global user.email "{{git_email}}"
git config --global init.defaultBranch main
git config --global fetch.prune true
git config --global core.autocrlf input
`,
      ubuntu: `
echo "[GIT-CONFIG] Setting global git identity..."
git config --global user.name "{{git_name}}"
git config --global user.email "{{git_email}}"
git config --global init.defaultBranch main
git config --global fetch.prune true
git config --global core.autocrlf input
`,
    },
  },

  // ------------------------------------------------------------
  // LANGUAGES
  // ------------------------------------------------------------
  {
    id: "lang.nvm",
    name: "nvm (Node Version Manager)",
    category: ["languages", "beginner", "dev_env"],
    tags: ["nvm", "node", "npm"],
    iconSlug: "nodedotjs",
    shortDesc: "Node 버전관리(nvm) 설치",
    defaultPolicy: "skip",
    requires: ["dev.git"], // nvm은 git clone 기반
    installCheck: {
      mac: `[ -s "$HOME/.nvm/nvm.sh" ]`,
      ubuntu: `[ -s "$HOME/.nvm/nvm.sh" ]`,
    },
    script: {
      mac: `
echo "[NVM] Installing nvm..."
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "[NVM] Already installed. Skipping."
else
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
`,
      ubuntu: `
echo "[NVM] Installing nvm..."
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "[NVM] Already installed. Skipping."
else
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
`,
    },
  },
  {
    id: "lang.node_lts",
    name: "Node.js (LTS via nvm)",
    category: ["languages", "dev_env"],
    tags: ["node", "npm", "lts"],
    iconSlug: "nodedotjs",
    shortDesc: "Node LTS 설치 + 기본 버전 지정",
    defaultPolicy: "skip",
    requires: ["lang.nvm"],
    installCheck: {
      mac: `command -v node >/dev/null 2>&1`,
      ubuntu: `command -v node >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[NODE] Installing Node LTS via nvm..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
nvm alias default lts/*
echo "[NODE] node=$(node -v) npm=$(npm -v)"
`,
      ubuntu: `
echo "[NODE] Installing Node LTS via nvm..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
nvm alias default lts/*
echo "[NODE] node=$(node -v) npm=$(npm -v)"
`,
    },
  },

  // ------------------------------------------------------------
  // IDE / TOOLS
  // ------------------------------------------------------------
  {
    id: "dev.vscode",
    name: "VS Code",
    category: ["dev_env", "beginner"],
    tags: ["vscode", "editor", "ide"],
    iconSlug: "visualstudiocode",
    shortDesc: "가장 대중적인 개발 에디터 설치",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `brew list --cask visual-studio-code >/dev/null 2>&1`,
      ubuntu: `command -v code >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[VSCODE] Installing VS Code..."
if brew list --cask visual-studio-code >/dev/null 2>&1; then
  echo "[VSCODE] Already installed. Skipping."
else
  brew install --cask visual-studio-code
fi
`,
      ubuntu: `
echo "[VSCODE] Installing VS Code..."
if command -v code >/dev/null 2>&1; then
  echo "[VSCODE] Already installed. Skipping."
else
  sudo snap install --classic code || true
  if ! command -v code >/dev/null 2>&1; then
    echo "[VSCODE] Snap failed. Please install VS Code manually or via apt repo."
  fi
fi
`,
    },
  },

  // ------------------------------------------------------------
  // GitHub / SSH
  // ------------------------------------------------------------
  {
    id: "dev.gh_cli",
    name: "GitHub CLI (gh)",
    category: ["dev_env", "convenience"],
    tags: ["github", "gh", "cli"],
    iconSlug: "github",
    shortDesc: "GitHub 명령줄 도구(gh) 설치",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v gh >/dev/null 2>&1`,
      ubuntu: `command -v gh >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[GH] Installing GitHub CLI..."
if command -v gh >/dev/null 2>&1; then
  echo "[GH] Already installed. Skipping."
else
  brew install gh
fi
`,
      ubuntu: `
echo "[GH] Installing GitHub CLI..."
if command -v gh >/dev/null 2>&1; then
  echo "[GH] Already installed. Skipping."
else
  sudo apt-get install -y gh || true
  if ! command -v gh >/dev/null 2>&1; then
    echo "[GH] apt install failed. Please follow GitHub CLI official install."
  fi
fi
`,
    },
  },
  {
    id: "dev.github_ssh",
    name: "GitHub SSH Key (ed25519)",
    category: ["beginner", "dev_env"],
    tags: ["ssh", "github", "keygen"],
    iconSlug: "github",
    shortDesc: "GitHub용 SSH 키 생성 + agent 등록(복붙 최소화)",
    defaultPolicy: "skip",
    inputs: [
      {
        key: "ssh_email",
        label: "SSH key comment (email)",
        placeholder: "you@example.com",
        required: true,
        hint: "ssh-keygen -C 에 들어감",
      },
    ],
    installCheck: {
      mac: `[ -f "$HOME/.ssh/id_ed25519" ]`,
      ubuntu: `[ -f "$HOME/.ssh/id_ed25519" ]`,
    },
    script: {
      mac: `
echo "[SSH] Setting up GitHub SSH key..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$HOME/.ssh/id_ed25519" ]; then
  echo "[SSH] Key already exists. Skipping keygen."
else
  ssh-keygen -t ed25519 -C "{{ssh_email}}" -f "$HOME/.ssh/id_ed25519" -N ""
fi

# Start agent
eval "$(ssh-agent -s)" >/dev/null
ssh-add "$HOME/.ssh/id_ed25519" >/dev/null

# Add github.com to known_hosts (avoid interactive prompt)
ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
chmod 600 "$HOME/.ssh/known_hosts"

echo "[SSH] Public key:"
cat "$HOME/.ssh/id_ed25519.pub"
`,
      ubuntu: `
echo "[SSH] Setting up GitHub SSH key..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$HOME/.ssh/id_ed25519" ]; then
  echo "[SSH] Key already exists. Skipping keygen."
else
  ssh-keygen -t ed25519 -C "{{ssh_email}}" -f "$HOME/.ssh/id_ed25519" -N ""
fi

eval "$(ssh-agent -s)" >/dev/null
ssh-add "$HOME/.ssh/id_ed25519" >/dev/null

ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
chmod 600 "$HOME/.ssh/known_hosts"

echo "[SSH] Public key:"
cat "$HOME/.ssh/id_ed25519.pub"
`,
    },
  },

  // ------------------------------------------------------------
  // Convenience CLI (idempotent)
  // ------------------------------------------------------------
  {
    id: "cli.ripgrep",
    name: "ripgrep (rg)",
    category: ["convenience", "dev_env"],
    tags: ["search", "grep", "rg"],
    iconSlug: "ripgrep",
    shortDesc: "초고속 텍스트 검색 도구",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v rg >/dev/null 2>&1`,
      ubuntu: `command -v rg >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[RG] Installing ripgrep..."
command -v rg >/dev/null 2>&1 || brew install ripgrep
`,
      ubuntu: `
echo "[RG] Installing ripgrep..."
command -v rg >/dev/null 2>&1 || sudo apt-get install -y ripgrep
`,
    },
  },
  {
    id: "cli.jq",
    name: "jq",
    category: ["convenience", "dev_env"],
    tags: ["json", "cli"],
    iconSlug: "jq",
    shortDesc: "JSON 파싱/가공 CLI",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v jq >/dev/null 2>&1`,
      ubuntu: `command -v jq >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[JQ] Installing jq..."
command -v jq >/dev/null 2>&1 || brew install jq
`,
      ubuntu: `
echo "[JQ] Installing jq..."
command -v jq >/dev/null 2>&1 || sudo apt-get install -y jq
`,
    },
  },
  {
    id: "cli.fzf",
    name: "fzf",
    category: ["convenience"],
    tags: ["fuzzy", "search", "terminal"],
    iconSlug: "fzf",
    shortDesc: "터미널 퍼지 파인더(검색 속도 체감 큼)",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v fzf >/dev/null 2>&1`,
      ubuntu: `command -v fzf >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[FZF] Installing fzf..."
command -v fzf >/dev/null 2>&1 || brew install fzf
`,
      ubuntu: `
echo "[FZF] Installing fzf..."
command -v fzf >/dev/null 2>&1 || sudo apt-get install -y fzf
`,
    },
  },
  {
    id: "cli.bat",
    name: "bat",
    category: ["convenience"],
    tags: ["cat", "syntax highlight"],
    iconSlug: "bat",
    shortDesc: "컬러 출력되는 cat 대체 도구",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v bat >/dev/null 2>&1`,
      ubuntu: `command -v batcat >/dev/null 2>&1 || command -v bat >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[BAT] Installing bat..."
command -v bat >/dev/null 2>&1 || brew install bat
`,
      ubuntu: `
echo "[BAT] Installing bat..."
if command -v bat >/dev/null 2>&1; then
  echo "[BAT] Already installed. Skipping."
else
  sudo apt-get install -y bat || true
  # Ubuntu에서는 batcat일 수 있음
fi
`,
    },
  },
  {
    id: "cli.eza",
    name: "eza",
    category: ["convenience"],
    tags: ["ls", "pretty"],
    iconSlug: "eza",
    shortDesc: "ls 대체(가독성 좋음)",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v eza >/dev/null 2>&1`,
      ubuntu: `command -v eza >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[EZA] Installing eza..."
command -v eza >/dev/null 2>&1 || brew install eza
`,
      ubuntu: `
echo "[EZA] Installing eza..."
command -v eza >/dev/null 2>&1 || sudo apt-get install -y eza || true
`,
    },
  },

  // ------------------------------------------------------------
  // Shell UX (optional)
  // ------------------------------------------------------------
  {
    id: "shell.starship",
    name: "Starship prompt",
    category: ["convenience"],
    tags: ["prompt", "shell", "zsh", "bash"],
    iconSlug: "starship",
    shortDesc: "터미널 프롬프트 개선(상태 표시)",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v starship >/dev/null 2>&1`,
      ubuntu: `command -v starship >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[STARSHIP] Installing starship..."
command -v starship >/dev/null 2>&1 || brew install starship
echo '[ -x "$(command -v starship)" ] && eval "$(starship init zsh)"' >> "$HOME/.zshrc"
`,
      ubuntu: `
echo "[STARSHIP] Installing starship..."
command -v starship >/dev/null 2>&1 || curl -fsSL https://starship.rs/install.sh | sh -s -- -y
echo '[ -x "$(command -v starship)" ] && eval "$(starship init bash)"' >> "$HOME/.bashrc"
`,
    },
  },

  // ------------------------------------------------------------
  // Python tools (optional)
  // ------------------------------------------------------------
  {
    id: "lang.python3",
    name: "Python3",
    category: ["languages", "dev_env"],
    tags: ["python", "pip"],
    iconSlug: "python",
    shortDesc: "Python 런타임 설치",
    defaultPolicy: "skip",
    requires: ["base.homebrew"],
    installCheck: {
      mac: `command -v python3 >/dev/null 2>&1`,
      ubuntu: `command -v python3 >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[PY] Installing python3..."
command -v python3 >/dev/null 2>&1 || brew install python
`,
      ubuntu: `
echo "[PY] Installing python3..."
command -v python3 >/dev/null 2>&1 || sudo apt-get install -y python3 python3-pip
`,
    },
  },
  {
    id: "lang.uv",
    name: "uv (fast Python package manager)",
    category: ["languages", "convenience"],
    tags: ["uv", "python", "pip"],
    iconSlug: "python",
    shortDesc: "초고속 Python 패키지 매니저 uv 설치",
    defaultPolicy: "skip",
    requires: ["lang.python3"],
    installCheck: {
      mac: `command -v uv >/dev/null 2>&1`,
      ubuntu: `command -v uv >/dev/null 2>&1`,
    },
    script: {
      mac: `
echo "[UV] Installing uv..."
command -v uv >/dev/null 2>&1 || curl -fsSL https://astral.sh/uv/install.sh | sh
`,
      ubuntu: `
echo "[UV] Installing uv..."
command -v uv >/dev/null 2>&1 || curl -fsSL https://astral.sh/uv/install.sh | sh
`,
    },
  },

  // ------------------------------------------------------------
  // Final verification (nice UX)
  // ------------------------------------------------------------
  {
    id: "verify.summary",
    name: "Verify: print versions summary",
    category: ["beginner", "dev_env"],
    tags: ["verify", "summary", "versions"],
    iconSlug: "terminal",
    shortDesc: "설치 결과를 버전 출력으로 한 번에 확인",
    defaultPolicy: "skip",
    script: {
      mac: `
echo "------------------------------"
echo "[VERIFY] Versions summary"
command -v brew >/dev/null 2>&1 && brew --version | head -n 1 || true
command -v git >/dev/null 2>&1 && git --version || true
command -v node >/dev/null 2>&1 && node -v || true
command -v npm >/dev/null 2>&1 && npm -v || true
command -v python3 >/dev/null 2>&1 && python3 --version || true
command -v rg >/dev/null 2>&1 && rg --version | head -n 1 || true
command -v jq >/dev/null 2>&1 && jq --version || true
echo "------------------------------"
`,
      ubuntu: `
echo "------------------------------"
echo "[VERIFY] Versions summary"
command -v git >/dev/null 2>&1 && git --version || true
command -v node >/dev/null 2>&1 && node -v || true
command -v npm >/dev/null 2>&1 && npm -v || true
command -v python3 >/dev/null 2>&1 && python3 --version || true
command -v rg >/dev/null 2>&1 && rg --version | head -n 1 || true
command -v jq >/dev/null 2>&1 && jq --version || true
echo "------------------------------"
`,
    },
  },
];
