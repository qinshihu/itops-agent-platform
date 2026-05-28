# ============================================================
# ITOps Agent Platform - Quick Deploy Script
# ============================================================
# Usage:
#   .\deploy.ps1 [OPTIONS]
#
# Default behavior: Pulls LATEST images from Aliyun Registry
#   registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-{backend|frontend}-latest
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
    [switch]$Help
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
    Write-Info "Generated JWT secret (will be saved to .env)"
}

# Create .env file
Write-Info "Creating .env file..."
$EnvContent = @"
# ITOps Agent Platform - Environment Configuration
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# JWT Configuration
JWT_SECRET=$JwtSecret

# Administrator Initial Password (optional - defaults to 'admin')
# Leave empty to use default 'admin' password
ADMIN_INITIAL_PASSWORD=

# LLM API Configuration (configure at least one)
# Doubao (豆包)
DOUBAO_API_KEY=
DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-4o

# OpenAI
OPENAI_API_KEY=
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Server Configuration
ALLOWED_ORIGINS=http://localhost:$FrontendPort
"@

$EnvContent | Out-File -FilePath ".env" -Encoding utf8 -Force
Write-Success ".env file created"

# Determine image names (matches CI/CD build format)
$BackendImage = "$Registry/$Namespace/$Repo`:$ImagePrefix-backend-$Version"
$FrontendImage = "$Registry/$Namespace/$Repo`:$ImagePrefix-frontend-$Version"
Write-Info "Using images: $BackendImage, $FrontendImage"

# Create docker-compose.deploy.yml
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
      - JWT_SECRET=${dollar}{JWT_SECRET}
      - DOUBAO_API_KEY=${dollar}{DOUBAO_API_KEY:-}
      - DOUBAO_API_BASE=${dollar}{DOUBAO_API_BASE:-https://ark.cn-beijing.volces.com/api/v3}
      - DOUBAO_MODEL=${dollar}{DOUBAO_MODEL:-doubao-4o}
      - OPENAI_API_KEY=${dollar}{OPENAI_API_KEY:-}
      - OPENAI_API_BASE=${dollar}{OPENAI_API_BASE:-https://api.openai.com/v1}
      - OPENAI_MODEL=${dollar}{OPENAI_MODEL:-gpt-4o}
      - ALLOWED_ORIGINS=${dollar}{ALLOWED_ORIGINS:-http://localhost:$FrontendPort}
    volumes:
      - itops-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  frontend:
    image: $FrontendImage
    container_name: itops-frontend
    ports:
      - "$FrontendPort`:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

volumes:
  itops-data:
    driver: local

networks:
  default:
    driver: bridge
"@

$ComposeContent | Out-File -FilePath "docker-compose.deploy.yml" -Encoding utf8 -Force
Write-Success "Deployment configuration created"

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
docker compose -f docker-compose.deploy.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Error-Msg "Failed to start services"
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
Write-Host "  Health:    http://$ServerIP`:$BackendPort/health"
Write-Host ""
Write-Host "Default Credentials:" -ForegroundColor $Yellow
Write-Host "  Username: admin"
Write-Host "  Password: admin"
Write-Host ""
Write-Host "IMPORTANT: Change password after first login!" -ForegroundColor $Red
Write-Host ""
Write-Host "Quick Commands:" -ForegroundColor $Yellow
Write-Host "  View status:      docker compose -f docker-compose.deploy.yml ps"
Write-Host "  View logs:        docker compose -f docker-compose.deploy.yml logs -f"
Write-Host "  Stop services:    docker compose -f docker-compose.deploy.yml down"
Write-Host "  Restart services: docker compose -f docker-compose.deploy.yml restart"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor $Yellow
Write-Host "  1. Visit http://$ServerIP`:$FrontendPort in your browser"
Write-Host "  2. Login with admin/admin"
Write-Host "  3. Change your password immediately in Settings"
Write-Host "  4. Configure your LLM API keys in Settings"
Write-Host "  5. Start creating agents and workflows!"
Write-Host ""
Write-Host "===========================================" -ForegroundColor $Cyan
