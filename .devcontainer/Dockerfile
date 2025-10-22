FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}


# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
COPY enable-docker-sock.sh /usr/local/bin/
COPY update-hosts.sh /usr/local/bin/
USER root
# ===== Docker CLI (client only) を入れる =====
# ベース: Debian(bookworm/bullseye系)。daemonは不要なので cli と plugin だけ入れる
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg apt-transport-https; \
    install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg; \
    chmod a+r /etc/apt/keyrings/docker.gpg; \
    . /etc/os-release; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      docker-ce-cli \
      docker-buildx-plugin \
      docker-compose-plugin; \
    # 互換: `docker-compose` コマンドを使いたい場合のラッパー
    printf '#!/bin/sh\nexec docker compose "$@"\n' >/usr/local/bin/docker-compose; \
    chmod +x /usr/local/bin/docker-compose; \
    rm -rf /var/lib/apt/lists/*
# （任意）ロケール警告の抑止
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
  libxcomposite1 libxrandr2 libxdamage1 libpango-1.0-0 libharfbuzz0b \
  libgtk-3-0 libx11-xcb1 libxshmfence1 fonts-noto fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*
# パッケージ導入後に Playwright とブラウザ
WORKDIR /workspace/core
RUN npm i -D playwright && \
  npm install -g pnpm && \
  pnpm exec playwright install --with-deps chromium

RUN (type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
	&& sudo mkdir -p -m 755 /etc/apt/keyrings \
	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
	&& sudo apt update \
	&& sudo apt install gh -y

RUN chmod +x /usr/local/bin/init-firewall.sh && \
  chmod +x /usr/local/bin/update-hosts.sh && \
  chmod +x /usr/local/bin/enable-docker-sock.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/sbin/groupadd" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/sbin/usermod" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/bin/docker" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/bin/tee" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/docker" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /bin/sh" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /bin/chmod" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/update-hosts.sh" >> /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
WORKDIR /workspace/
USER node
RUN echo "alias cc='claude --dangerously-skip-permissions'" >> ~/.zshrc
