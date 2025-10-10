# Important Reminders for Claude

## Repository Structure

### Git Submodules
- **core/** is a git submodule (points to ../drm-core)
- **plugins/** is a git submodule (points to ../drm-plugins)

### When committing:
- Files in `core/` and `plugins/` are managed by their own repositories
- Only commit files in the main app repository
- Never use `git add core/` or `git add plugins/`

### Docker files location:
- Dockerfile for core: `docker/Dockerfile.core` (NOT in core/)
- .dockerignore for core: `docker/.dockerignore.core` (NOT in core/)

## SSL Certificates
- Development: `certs/devcle.test+3.pem` and `certs/devcle.test+3-key.pem`
- Production: `certs/devcle.com.pem` and `certs/devcle.com-key.pem`
- nginx mounts these as `/etc/nginx/certs/server.crt` and `/etc/nginx/certs/server.key`

## Environment Variables
- Use `APP_DOMAIN` for both nginx server_name and application URLs
- Configure in `.env` file (copy from `.env.example`)

## Never Do These:
- `docker compose stop` or `docker compose restart` (breaks development environment)
- Commit files inside `core/` or `plugins/` subdirectories
