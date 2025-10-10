# Minimal Dockerfile for the Remix application container image.
# This is an implementation scaffold and does not assume the code layout.
# Reviewers: Adjust build steps when application code structure is available.

FROM node:20-alpine AS base

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.11.0 --activate

WORKDIR /app

# App source is not present in this repository (managed via submodules/workspaces).
# We keep the Dockerfile minimal to allow the container to run a placeholder.

EXPOSE 8080

# Placeholder start command; replace with app start when code is wired.
CMD ["node", "-e", "console.log('Web container placeholder: expose :8080 and proxy via nginx'); setInterval(()=>{}, 1<<30)"]

