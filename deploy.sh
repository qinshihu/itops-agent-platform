#!/bin/bash
# ============================================================
# ITOps Agent Platform - 一键部署脚本
# ============================================================
# 默认行为: 自动从阿里云镜像仓库拉取 LATEST 最新镜像
#   registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-{backend|frontend}-latest
#
# 设计原则: 最少环境变量，所有配置通过 Web UI 完成
#   - JWT_SECRET 自动生成并注入（首次启动必需）
#   - 其他所有配置（AI 模型、通知渠道等）均在 Web UI 中设置
#   - 默认不创建 .env 文件
#
# 用法:
#   curl -fsSL https://your-repo/deploy.sh | bash
#   或
#   wget -O deploy.sh https://your-repo/deploy.sh && bash deploy.sh
#
# 示例:
#   # 部署最新版本 (默认)
#   bash deploy.sh
#
#   # 指定部署目录并自动确认
#   bash deploy.sh -d /opt/itops -y
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
    echo -e "${YELLOW}作者: ${NC}谭策"
    echo -e "${YELLOW}公众号: ${NC}IT Online"
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

# 检查端口是否被占用
# 用法：check_port <端口号> <用途说明>
check_port() {
    local port=$1
    local usage=$2

    # 优先使用 ss，回退到 netstat，再回退到 lsof
    local in_use=false
    if command -v ss &> /dev/null; then
        if ss -ltn 2>/dev/null | grep -qE ":${port}\s"; then
            in_use=true
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -ltn 2>/dev/null | grep -qE ":${port}\s"; then
            in_use=true
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -iTCP:${port} -sTCP:LISTEN &>/dev/null; then
            in_use=true
        fi
    else
        print_warn "无法检查端口 ${port}（未安装 ss/netstat/lsof），请手动确认"
        return 0
    fi

    if [ "$in_use" = true ]; then
        print_error "端口 ${port} 已被占用（${usage}）"
        echo -e "${YELLOW}请选择以下任一方式解决：${NC}"
        echo -e "  1. 停止占用该端口的服务"
        echo -e "  2. 修改本脚本中对应的端口映射（第 ${port} 行附近）"
        echo -e "     将 \"<宿主机端口>:<容器端口>\" 中的宿主机端口改成空闲端口"
        return 1
    fi

    print_success "端口 ${port} 可用（${usage}）"
    return 0
}

# 批量检查部署所需端口
check_required_ports() {
    print_info "检查端口占用情况..."

    local failed=0

    # 宿主机端口由 docker-compose 决定，按脚本里的默认值检查
    check_port 3001 "后端 API" || failed=1
    check_port 8080 "前端 Web" || failed=1

    echo ""
    if [ $failed -ne 0 ]; then
        print_error "端口检查未通过，请处理后再重试"
        exit 1
    fi
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

    # 生成 JWT_SECRET
    JWT_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

    cat > docker-compose.yml << COMPOSE_EOF
services:
  backend:
    image: ${BACKEND_IMAGE}
    container_name: itops-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/app.db
      - JWT_SECRET=${JWT_SECRET}
      - ALLOWED_ORIGINS=http://localhost:8080
    volumes:
      - app-data:/app/data
      - app-backups:/app/backups
    networks:
      - itops-network
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
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"

networks:
  itops-network:
    driver: bridge

volumes:
  app-data:
    driver: local
  app-backups:
    driver: local
COMPOSE_EOF

    print_success "docker-compose.yml 已生成"
    echo ""
}

# 带重试的镜像拉取（避免 set -e 在网络抖动时直接失败退出）
# 用法：retry_pull <镜像名> [最大重试次数，默认3]
retry_pull() {
    local image=$1
    local max_retry=${2:-3}
    local retry=0
    local delay=5

    while [ $retry -lt $max_retry ]; do
        retry=$((retry + 1))

        # docker pull 在某些错误下也会写 stdout，用 if 捕获退出码
        if docker pull "$image"; then
            return 0
        fi

        if [ $retry -lt $max_retry ]; then
            print_warn "拉取失败，第 ${retry}/${max_retry} 次重试（${delay}s 后）..."
            sleep "$delay"
            # 重试间隔递增
            delay=$((delay * 2))
        fi
    done

    return 1
}

# 拉取镜像
pull_images() {
    print_info "开始拉取 Docker 镜像..."
    echo ""

    print_info "拉取后端镜像: ${BACKEND_IMAGE}"
    if ! retry_pull "$BACKEND_IMAGE" 3; then
        print_error "后端镜像拉取失败（已重试 3 次）"
        print_info "可能原因：网络问题 / 镜像仓库鉴权失败 / 镜像不存在"
        exit 1
    fi
    print_success "后端镜像拉取成功"
    echo ""

    print_info "拉取前端镜像: ${FRONTEND_IMAGE}"
    if ! retry_pull "$FRONTEND_IMAGE" 3; then
        print_error "前端镜像拉取失败（已重试 3 次）"
        print_info "可能原因：网络问题 / 镜像仓库鉴权失败 / 镜像不存在"
        exit 1
    fi
    print_success "前端镜像拉取成功"
    echo ""
}

# 启动服务
start_services() {
    print_info "启动服务..."
    echo ""

    # 更新模式下，先彻底清理旧容器和网络
    if [ "$UPDATE_MODE" = true ]; then
        print_info "清理旧容器和网络..."
        $COMPOSE_CMD down --remove-orphans
        echo ""
    fi

    # 拉取最新镜像，确保使用最新版本
    print_info "拉取最新镜像..."
    if ! $COMPOSE_CMD pull; then
        print_error "docker compose pull 失败，请检查网络和镜像仓库配置"
        exit 1
    fi

    echo ""
    print_info "启动容器..."
    if ! $COMPOSE_CMD up -d --remove-orphans; then
        print_error "docker compose up 失败，请检查日志"
        exit 1
    fi

    echo ""
    print_info "等待服务启动..."
    sleep 5

    # 清理未使用的镜像（仅限本项目相关，节省磁盘空间）
    if [ "$UPDATE_MODE" = true ]; then
        print_info "清理旧版本残留镜像..."
        docker image prune -f --filter "reference=${REGISTRY}/${NAMESPACE}/${REPO}*" 2>/dev/null || true
    fi
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
    echo -e "前端地址:  ${GREEN}http://${SERVER_IP}:8080${NC}"
    echo -e "后端地址:  ${GREEN}http://${SERVER_IP}:3001${NC}"
    echo -e "健康检查:  ${GREEN}http://${SERVER_IP}:3001/health${NC}"
    echo ""
    echo -e "默认账号:  ${YELLOW}admin${NC}"
    echo -e "密码:    ${YELLOW}admin${NC}"
    echo -e "${YELLOW}请在首次登录后立即修改密码!${NC}"
    echo ""
    echo -e "${CYAN}后续配置（通过 Web UI 完成）:${NC}"
    echo -e "  1. 访问 http://${SERVER_IP}:8080，使用 admin/admin 登录"
    echo -e "  2. 进入设置 → 修改初始密码"
    echo -e "  3. 进入 AI 模型 → 配置你使用的 AI 提供商"
    echo -e "  4. 进入通知 → 配置通知渠道"
    echo -e "  5. 开始创建 Agent 和工作流!"
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
    UPDATE_MODE=false

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
            -u|--update)
                UPDATE_MODE=true
                shift
                ;;
            -h|--help)
                echo "用法: $0 [-d 部署目录] [-y 自动确认] [-u 更新模式] [-h 帮助]"
                echo ""
                echo "选项:"
                echo "  -d, --dir    部署目录 (默认: /opt/itops)"
                echo "  -y, --yes    自动确认所有提示 (非交互模式)"
                echo "  -u, --update 更新模式（跳过文件生成，仅拉取镜像并重启，清理残留）"
                echo "  -h, --help   显示帮助"
                echo ""
                echo "设计原则:"
                echo "  最少环境变量，所有配置（AI 模型、通知渠道等）"
                echo "  均在部署完成后通过 Web UI 配置。"
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                exit 1
                ;;
        esac
    done

    check_dependencies
    check_required_ports
    setup_directory "$DEPLOY_DIR"

    if [ "$UPDATE_MODE" = false ]; then
        generate_compose_file
    fi

    pull_images
    start_services
    verify_services
    print_deploy_info
}

main "$@"
