# ============================================================
# ITOps Agent Platform - Quick Deploy Script
# ============================================================
# Usage:
#   .\deploy.ps1 [OPTIONS]
#
# Default behavior: Pulls LATEST images from Aliyun Registry
#   registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-{backend|frontend}-latest
#
# Design principle: Minimal environment variables, configure via Web UI
#   - JWT_SECRET is auto-generated and injected (required for first boot)
#   - All other settings (AI models, notifications, etc.) are configured in the Web UI
#   - No .env file is created by default
#
# Examples:
#   # Deploy latest version (DEFAULT)
#   .\deploy.ps1
#
#   # Deploy with custom image registry
#   .\deploy.ps1 -Namespace your-namespace -Repo your-repo
#
#   # Deploy specific version on custom ports
#   .\deploy.ps1 -Version v3.0.3 -BackendPort 8000 -FrontendPort 9000
# ============================================================

param(
    [string]$Registry = "registry.cn-hangzhou.aliyuncs.com",
    [string]$Namespace = "huluwa666",
    [string]$Repo = "tsq-images-hub",
    [string]$ImagePrefix = "IT_Onlin-ITOps",
    [string]$Version = "latest",
    [string]$BackendPort = "3001",
    [string]$FrontendPort = "8080",
    [string]$JwtSecret = "",
    [switch]$Help,
    [switch]$Update
)

# Show help if requested
if ($Help) {
    Write-Host @"
===========================================
 ITOps Agent Platform - Deploy Script
===========================================

Usage:
  .\deploy.ps1 [OPTIONS]

Options:
  -Registry     Container registry (default: registry.cn-hangzhou.aliyuncs.com)
  -Namespace    Registry namespace (default: huluwa666)
  -Repo         Registry repository (default: tsq-images-hub)
  -ImagePrefix  Image name prefix (default: IT_Onlin-ITOps)
  -Version      Image version tag (default: latest)
  -BackendPort  Backend API port (default: 3001)
  -FrontendPort Frontend web port (default: 8080)
  -JwtSecret    JWT secret key (auto-generated if not provided)
  -Help         Show this help message
  -Update       Update mode: restart with new images, clean up old ones

Design Principle:
  Minimal environment variables. All configuration (AI models,
  notifications, etc.) is done through the Web UI after deployment.

Examples:
  # Deploy with default settings
  .\deploy.ps1

  # Deploy with custom images
  .\deploy.ps1 -Namespace your-namespace -Repo your-repo

  # Deploy specific version on custom ports
  .\deploy.ps1 -Namespace your-namespace -Version v1.0.0 -BackendPort 8000 -FrontendPort 9000

===========================================
"@
    exit 0
}

# Colors
$Green = "Green"
$Blue = "Blue"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor $Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor $Green }
function Write-Warn { param($Message) Write-Host "[WARN] $Message" -ForegroundColor $Yellow }
function Write-Error-Msg { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor $Red; exit 1 }

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Docker
try {
    $null = docker --version
    Write-Success "Docker is installed"
} catch {
    Write-Error-Msg "Docker is not installed. Please install Docker Desktop first: https://www.docker.com/products/docker-desktop"
}

# Check Docker Compose
try {
    $null = docker compose version
    Write-Success "Docker Compose is available"
} catch {
    Write-Error-Msg "Docker Compose is not available. Please install Docker Desktop."
}

# Check if ports are available
Write-Info "Checking port availability..."

function Test-Port {
    param($Port, $Name)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, [int]$Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-Port -Port $BackendPort -Name "Backend")) {
    Write-Error-Msg "Port $BackendPort is already in use. Please choose a different port with -BackendPort"
}
Write-Success "Backend port $BackendPort is available"

if (-not (Test-Port -Port $FrontendPort -Name "Frontend")) {
    Write-Error-Msg "Port $FrontendPort is already in use. Please choose a different port with -FrontendPort"
}
Write-Success "Frontend port $FrontendPort is available"

# Generate JWT secret if not provided
if ([string]::IsNullOrEmpty($JwtSecret)) {
    $JwtSecret = [System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()
    Write-Info "Generated JWT secret (stored in deployment compose file)"
}

# Determine image names (matches CI/CD build format)
$BackendImage = "$Registry/$Namespace/$Repo`:$ImagePrefix-backend-$Version"
$FrontendImage = "$Registry/$Namespace/$Repo`:$ImagePrefix-frontend-$Version"
Write-Info "Using images: $BackendImage, $FrontendImage"

# Update or Create docker-compose.deploy.yml
if (-not $Update -or -not (Test-Path "docker-compose.deploy.yml")) {
    Write-Info "Creating deployment configuration..."

    # Use $dollar variable to avoid PowerShell parsing issues with ${...} syntax
    $dollar = '$'
    $ComposeContent = @"
version: '3.8'

services:
  backend:
    image: $BackendImage
    container_name: itops-backend
    ports:
      - "$BackendPort`:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/app.db
      - JWT_SECRET=$JwtSecret
      - ALLOWED_ORIGINS=http://localhost:$FrontendPort
    volumes:
      - itops-data:/app/data
      - itops-backups:/app/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  frontend:
    image: $FrontendImage
    container_name: itops-frontend
    ports:
      - "$FrontendPort`:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"

volumes:
  itops-data:
    driver: local
  itops-backups:
    driver: local

networks:
  default:
    driver: bridge
"@

    $ComposeContent | Out-File -FilePath "docker-compose.deploy.yml" -Encoding utf8 -Force
    Write-Success "Deployment configuration created (docker-compose.deploy.yml)"
} else {
    Write-Info "Update mode: skipping compose file generation"
}

# Pull images
Write-Info "Pulling images from $Registry..."
docker pull $BackendImage
if ($LASTEXITCODE -ne 0) {
    Write-Error-Msg "Failed to pull backend image"
}
Write-Success "Backend image pulled"

docker pull $FrontendImage
if ($LASTEXITCODE -ne 0) {
    Write-Error-Msg "Failed to pull frontend image"
}
Write-Success "Frontend image pulled"

# Start services
Write-Info "Starting ITOps Agent Platform..."
if ($Update) {
    Write-Info "Update mode: stopping and removing old containers..."
    docker compose -f docker-compose.deploy.yml down --remove-orphans
}

docker compose -f docker-compose.deploy.yml up -d --remove-orphans
if ($LASTEXITCODE -ne 0) {
    Write-Error-Msg "Failed to start services"
}

if ($Update) {
    Write-Info "Pruning old images to free up space..."
    docker image prune -f --filter "reference=$Registry/$Namespace/$Repo*" 2>$null
}

# Wait for services to be ready
Write-Info "Waiting for services to start..."
Start-Sleep -Seconds 10

# Check health
$maxRetries = 30
$retryCount = 0
$backendReady = $false

while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        # Service not ready yet
    }
    Start-Sleep -Seconds 2
    $retryCount++
    Write-Host "." -NoNewline
}

Write-Host ""

if ($backendReady) {
    Write-Success "ITOps Agent Platform is ready!"
} else {
    Write-Warn "Backend service might still be starting. Check with: docker compose -f docker-compose.deploy.yml ps"
}

# Get server IP address
try {
    $ServerIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress
} catch {
    $ServerIP = "localhost"
}

# Show access information
Write-Host ""
Write-Host "===========================================" -ForegroundColor $Cyan
Write-Host " ITOps Agent Platform Deployed Successfully!" -ForegroundColor $Green
Write-Host "===========================================" -ForegroundColor $Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor $Yellow
Write-Host "  Frontend:   http://$ServerIP`:$FrontendPort"
Write-Host "  Backend:    http://$ServerIP`:$BackendPort"
Write-Host "  Health:     http://$ServerIP`:$BackendPort/health"
Write-Host ""
Write-Host "Default Credentials:" -ForegroundColor $Yellow
Write-Host "  Username: admin"
Write-Host "  Password: admin"
Write-Host ""
Write-Host "IMPORTANT: Change password after first login!" -ForegroundColor $Red
Write-Host ""
Write-Host "Next Steps (configure via Web UI):" -ForegroundColor $Yellow
Write-Host "  1. Visit http://$ServerIP`:$FrontendPort and login with admin/admin"
Write-Host "  2. Go to Settings → change your password"
Write-Host "  3. Go to AI Models → configure your preferred AI provider"
Write-Host "  4. Go to Notifications → configure notification channels"
Write-Host "  5. Start creating agents and workflows!"
Write-Host ""
Write-Host "Quick Commands:" -ForegroundColor $Yellow
Write-Host "  View status:      docker compose -f docker-compose.deploy.yml ps"
Write-Host "  View logs:        docker compose -f docker-compose.deploy.yml logs -f"
Write-Host "  Stop services:    docker compose -f docker-compose.deploy.yml down"
Write-Host "  Restart services: docker compose -f docker-compose.deploy.yml restart"
Write-Host ""
Write-Host "===========================================" -ForegroundColor $Cyan
