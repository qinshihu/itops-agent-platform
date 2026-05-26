#!/bin/bash
# ============================================================
# ITOps Agent Platform - 一键部署脚本
# ============================================================
# 用法:
#   curl -fsSL https://your-repo/deploy.sh | bash
#   或
#   wget -O deploy.sh https://your-repo/deploy.sh && bash deploy.sh
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 镜像配置
REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="huluwa666"
REPO="tsq-images-hub"
BACKEND_TAG="IT_Onlin-ITOps-backend-latest"
FRONTEND_TAG="IT_Onlin-ITOps-frontend-latest"

BACKEND_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:${BACKEND_TAG}"
FRONTEND_IMAGE="${REGISTRY}/${NAMESPACE}/${REPO}:${FRONTEND_TAG}"

# 打印标题
print_header() {
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${CYAN} ITOps Agent Platform - 一键部署${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""
}

# 打印信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_info "检查系统依赖..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        print_info "安装指南: https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    # 检查 Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        print_success "检测到 docker compose (v2)"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        print_success "检测到 docker-compose (v1)"
    else
        print_error "Docker Compose 未安装"
        print_info "安装指南: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        print_error "Docker 服务未运行"
        exit 1
    fi
    
    print_success "系统依赖检查通过"
    echo ""
}

# 创建目录
setup_directory() {
    DEPLOY_DIR="${1:-/opt/itops}"
    
    if [ -d "$DEPLOY_DIR" ]; then
        print_warn "目录 $DEPLOY_DIR 已存在"
        if [ "$AUTO_YES" = true ]; then
            print_info "自动确认模式，继续使用"
        else
            read -p "是否继续使用? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 0
            fi
        fi
    else
        print_info "创建部署目录: $DEPLOY_DIR"
        mkdir -p "$DEPLOY_DIR"
    fi
    
    cd "$DEPLOY_DIR"
    print_success "当前工作目录: $(pwd)"
    echo ""
}

# 生成 docker-compose.yml
generate_compose_file() {
    if [ -f "docker-compose.yml" ]; then
        print_warn "docker-compose.yml 已存在"
        if [ "$AUTO_YES" = true ]; then
            print_info "自动确认模式，覆盖文件"
        else
            read -p "是否覆盖? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "跳过生成 compose 文件"
                return
            fi
        fi
    fi
    
    print_info "生成 docker-compose.yml..."
    
    cat > docker-compose.yml << 'COMPOSE_EOF'
services:
  backend:
    image: ${BACKEND_IMAGE}
    container_name: itops-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: .env
    volumes:
      - app-data:/app/data
    networks:
      - itops-network
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  frontend:
    image: ${FRONTEND_IMAGE}
    container_name: itops-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - itops-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  itops-network:
    driver: bridge

volumes:
  app-data:
    driver: local
COMPOSE_EOF
    
    # 替换镜像变量
    sed -i "s|\${BACKEND_IMAGE}|${BACKEND_IMAGE}|g" docker-compose.yml
    sed -i "s|\${FRONTEND_IMAGE}|${FRONTEND_IMAGE}|g" docker-compose.yml
    
    print_success "docker-compose.yml 已生成"
    echo ""
}

# 生成 .env 文件
generate_env_file() {
    if [ -f ".env" ]; then
        print_warn ".env 文件已存在"
        if [ "$AUTO_YES" = true ]; then
            print_info "自动确认模式，覆盖文件"
        else
            read -p "是否覆盖? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "跳过生成 .env 文件"
                return
            fi
        fi
    fi
    
    print_info "生成 .env 配置文件..."
    
    # 生成随机 JWT_SECRET
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    cat > .env << EOF
# ITOps Agent Platform 配置文件
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# JWT 签名密钥（生产环境必须修改）
JWT_SECRET=${JWT_SECRET}

# 管理员初始密码（请在首次登录后立即修改）
ADMIN_INITIAL_PASSWORD=admin

# 后端端口
PORT=3001

# 运行环境
NODE_ENV=production

# 允许的来源（逗号分隔）
ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://localhost:8080

# 豆包 API 配置（可选）
# DOUBAO_API_KEY=
# DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
# DOUBAO_MODEL=doubao-4o

# OpenAI API 配置（可选）
# OPENAI_API_KEY=
# OPENAI_API_BASE=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o
EOF
    
    print_success ".env 文件已生成"
    
    echo ""
}

# 拉取镜像
pull_images() {
    print_info "开始拉取 Docker 镜像..."
    echo ""
    
    print_info "拉取后端镜像: ${BACKEND_IMAGE}"
    docker pull "$BACKEND_IMAGE"
    print_success "后端镜像拉取成功"
    echo ""
    
    print_info "拉取前端镜像: ${FRONTEND_IMAGE}"
    docker pull "$FRONTEND_IMAGE"
    print_success "前端镜像拉取成功"
    echo ""
}

# 启动服务
start_services() {
    print_info "启动服务..."
    echo ""
    
    $COMPOSE_CMD up -d
    
    echo ""
    print_info "等待服务启动..."
    sleep 5
}

# 验证服务
verify_services() {
    print_info "验证服务状态..."
    echo ""
    
    # 检查容器状态
    $COMPOSE_CMD ps
    echo ""
    
    # 等待后端健康检查
    print_info "等待后端服务就绪..."
    MAX_WAIT=60
    WAIT_COUNT=0
    
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health | grep -q "200"; then
            print_success "后端服务已就绪"
            break
        fi
        sleep 2
        WAIT_COUNT=$((WAIT_COUNT + 2))
    done
    
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        print_warn "后端服务启动超时，请检查日志: docker logs itops-backend"
    fi
    
    # 检查前端
    sleep 3
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
        print_success "前端服务已就绪"
    else
        print_warn "前端服务可能未就绪，请检查日志: docker logs itops-frontend"
    fi
    
    echo ""
}

# 打印部署信息
print_deploy_info() {
    SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "服务器IP")
    
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${GREEN} 部署成功!${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""
    echo -e "前端地址:  ${GREEN}http://${SERVER_IP}${NC}"
    echo -e "后端 API:  ${GREEN}http://${SERVER_IP}:3001/api/health${NC}"
    echo ""
    echo -e "默认账号:  ${YELLOW}admin${NC}"
    echo -e "用户名:  ${YELLOW}admin${NC}"
    echo -e "密码:    ${YELLOW}admin${NC}"
    echo -e "${YELLOW}请在首次登录后立即修改密码!${NC}"
    echo ""
    echo -e "${CYAN}常用命令:${NC}"
    echo -e "  查看状态:  ${BLUE}$COMPOSE_CMD ps${NC}"
    echo -e "  查看日志:  ${BLUE}$COMPOSE_CMD logs -f${NC}"
    echo -e "  停止服务:  ${BLUE}$COMPOSE_CMD down${NC}"
    echo -e "  重启服务:  ${BLUE}$COMPOSE_CMD restart${NC}"
    echo ""
    echo -e "${CYAN}==========================================${NC}"
}

# 主流程
main() {
    print_header
    
    # 解析参数
    DEPLOY_DIR="/opt/itops"
    AUTO_YES=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dir)
                DEPLOY_DIR="$2"
                shift 2
                ;;
            -y|--yes)
                AUTO_YES=true
                shift
                ;;
            -h|--help)
                echo "用法: $0 [-d 部署目录] [-y 自动确认] [-h 帮助]"
                echo ""
                echo "选项:"
                echo "  -d, --dir    部署目录 (默认: /opt/itops)"
                echo "  -y, --yes    自动确认所有提示 (非交互模式)"
                echo "  -h, --help   显示帮助"
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
    
    check_dependencies
    setup_directory "$DEPLOY_DIR"
    generate_compose_file
    generate_env_file
    pull_images
    start_services
    verify_services
    print_deploy_info
}

main "$@"
