# Toolchain image for the devcontainer. Languages are design decisions; each
# one is added here once decided: TypeScript on Node.js (decision 1).
FROM mcr.microsoft.com/devcontainers/base:ubuntu AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    jq \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI — tracked work lives on GitHub Issues.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Node.js — the app's runtime (decision 1) and the agent tooling's hooks
# (ECC, impeccable).
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Shared libraries and fonts for Playwright's browser tests (Chromium).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libdbus-1-3 libx11-6 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 \
    libxkbcommon0 libasound2t64 libatspi2.0-0t64 libxres1 \
    fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# tmux: persistent sessions that outlive the editor.
# Written inline because .devcontainer/ is not copied into the image.
RUN printf '%s\n' \
    '# Persistent sessions. Detach: Ctrl-b d. Reattach: dev' \
    'set -g mouse on' \
    'set -g history-limit 100000' \
    'set -g mode-keys vi' \
    'bind -T copy-mode-vi v send -X begin-selection' \
    'bind -T copy-mode-vi y send -X copy-selection-and-cancel' \
    'set -g default-terminal "tmux-256color"' \
    'set -g renumber-windows on' \
    'set -g status-left-length 20' \
    'set -g status-left "[#S] "' \
    > /home/vscode/.tmux.conf \
    && chown vscode:vscode /home/vscode/.tmux.conf \
    && printf '%s\n' \
    "# Build-or-attach the dev tmux session. WORKSPACE_DIR is set by the" \
    "# devcontainer (remoteEnv)." \
    "alias dev='bash \"\${WORKSPACE_DIR:-/workspaces/time-keep}/scripts/dev-session.sh\"'" \
    "alias tw='bash \"\${WORKSPACE_DIR:-/workspaces/time-keep}/scripts/dev-session.sh\"'" \
    > /etc/profile.d/tmux-session.sh \
    && echo '. /etc/profile.d/tmux-session.sh' >> /etc/bash.bashrc

# Claude Code and CodeGraph, installed as vscode so they land in its home.
USER vscode
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
ENV PATH="/home/vscode/.local/bin:${PATH}"
USER root
