# Docker Optimization Tools

This document outlines several open-source tools that can help optimize Docker images for the PRD Maker application.

## 1. Docker-Slim

[Docker-Slim](https://github.com/docker-slim/docker-slim) is a tool that automatically analyzes and optimizes Docker images, making them smaller and more secure without manual intervention.

### Installation

```bash
# macOS with Homebrew
brew install docker-slim

# Linux/Windows
# Download from https://github.com/docker-slim/docker-slim/releases
```

### Usage with PRD Maker

```bash
# Build your images first
docker-compose -f docker-compose.prod.yml build

# Optimize backend image
docker-slim build --http-probe=false --include-path="/app" --include-bin="/usr/local/bin/node" prd-generator-backend:latest

# Optimize frontend image
docker-slim build --http-probe=false --include-path="/app" --include-bin="/usr/local/bin/node" prd-generator-frontend:latest
```

### Benefits

- Reduces image size by up to 30x
- Improves security by removing unnecessary components
- Reduces attack surface
- Faster deployments due to smaller image sizes

## 2. Hadolint

[Hadolint](https://github.com/hadolint/hadolint) is a Dockerfile linter that helps you build best practice Docker images by checking the Dockerfile against a set of rules.

### Installation

```bash
# macOS with Homebrew
brew install hadolint

# Linux/Windows
# Download from https://github.com/hadolint/hadolint/releases
```

### Usage with PRD Maker

```bash
# Lint backend Dockerfile
hadolint backend/Dockerfile

# Lint frontend Dockerfile
hadolint frontend/Dockerfile
```

### Common Issues Detected

- Using latest tag instead of specific versions
- Missing labels
- Using ADD instead of COPY
- Running apt-get without proper flags
- Not removing package manager cache

### Integration with CI/CD

Add this step to your CI/CD pipeline:

```yaml
- name: Lint Dockerfiles
  run: |
    hadolint backend/Dockerfile
    hadolint frontend/Dockerfile
```

## 3. Dive

[Dive](https://github.com/wagoodman/dive) is a tool for exploring Docker image layers, helping you identify what's making your images large.

### Installation

```bash
# macOS with Homebrew
brew install dive

# Linux
wget https://github.com/wagoodman/dive/releases/download/v0.10.0/dive_0.10.0_linux_amd64.deb
sudo apt install ./dive_0.10.0_linux_amd64.deb

# Windows
# Download from https://github.com/wagoodman/dive/releases
```

### Usage with PRD Maker

```bash
# Analyze backend image
dive prd-generator-backend:latest

# Analyze frontend image
dive prd-generator-frontend:latest
```

### Features

- Interactive layer explorer
- Shows image efficiency score
- Highlights wasted space
- Identifies large files and directories

## Best Practices for Docker Optimization

1. **Use multi-stage builds** (already implemented in our Dockerfiles)
2. **Minimize the number of layers** by combining RUN commands
3. **Use .dockerignore** to exclude unnecessary files (already implemented)
4. **Use specific base image versions** instead of 'latest'
5. **Clean up in the same layer** where packages are installed
6. **Use Alpine-based images** when possible (already implemented)
7. **Optimize node_modules** with production dependencies only

## Automated Optimization Workflow

Add this to your development process:

1. Write Dockerfile
2. Validate with `hadolint`
3. Build the image
4. Analyze with `dive` to identify optimization opportunities
5. Optimize using `docker-slim`
6. Test the optimized image
7. Deploy optimized image

By integrating these tools into your workflow, you can ensure the PRD Maker Docker images remain optimized, secure, and follow best practices.