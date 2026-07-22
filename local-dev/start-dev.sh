#!/bin/bash
# ============================================================
# ITOps Agent Platform - 本地开发环境启动脚本 (Linux/Mac)
# ============================================================
# 用法:
#   ./start-dev.sh            - 启动开发环境
#   ./start-dev.sh --build    - 强制重新构建镜像
#   ./start-dev.sh --no-cache - 强制重建且不用缓存
#   ./start-dev.sh --logs     - 启动后自动跟踪日志
#   ./start-dev.sh --help     - 显示帮助
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_FLAG=""
LOGS_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD_FLAG="--build"
      shift
      ;;
    --no-cache)
      BUILD_FLAG="--build --no-cache"
      shift
      ;;
    --logs)
      LOGS_FLAG="1"
      shift
      ;;
    --help|-h)
      echo ""
      echo "ITOps Agent Platform - Local Development Environment"
      echo ""
      echo "Usage: ./start-dev.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --build       强制重新构建镜像（更新了 package.json 后用）"
      echo "  --no-cache    强制重建且不用缓存"
      echo "  --logs        启动后自动跟踪日志"
      echo "  --help, -h    显示帮助"
      echo ""
      exit 0
      ;;
    *)
      echo "[WARN] 未知参数: $1"
      shift
      ;;
  esac
done

echo ""
echo "==========================================================="
echo "  ITOps Agent Platform - 本地开发环境"
echo "==========================================================="
echo ""

# ── 检查 Docker ──
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 未运行，请启动 Docker Desktop 后重试"
  exit 1
fi

# ── 选择 docker compose 命令 ──
if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif docker-compose --version > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[ERROR] 未检测到 docker compose，请安装 Docker Desktop"
  exit 1
fi

echo "[INFO] 使用: $COMPOSE_CMD"
echo ""

# ── 停止旧容器（如果存在） ──
echo "[INFO] 停止旧容器（如有）..."
$COMPOSE_CMD down 2> /dev/null || true
echo ""

# ── 构建 ──
if [ -n "$BUILD_FLAG" ]; then
  echo "[INFO] 重新构建镜像: $BUILD_FLAG"
  $COMPOSE_CMD $BUILD_FLAG
else
  echo "[INFO] 如需要将构建镜像..."
  $COMPOSE_CMD build
fi
echo ""

# ── 启动 ──
echo "[INFO] 启动服务..."
$COMPOSE_CMD up -d
echo ""

echo "==========================================================="
echo "  开发环境已启动！"
echo "==========================================================="
echo ""
echo "  前端:           http://localhost:5173"
echo "  后端 API:       http://localhost:3001"
echo "  健康检查:       http://localhost:3001/health/live"
echo "  Swagger 文档:   http://localhost:3001/api-docs"
echo "  Node.js 调试:   localhost:9229 （chrome://inspect）"
echo ""
echo "  默认账号: admin / admin（首次登录会强制改密码）"
echo ""
echo "  常用命令:"
echo "    $COMPOSE_CMD logs -f             - 实时跟踪所有日志"
echo "    $COMPOSE_CMD logs -f backend     - 实时跟踪后端日志"
echo "    $COMPOSE_CMD logs -f frontend    - 实时跟踪前端日志"
echo "    $COMPOSE_CMD ps                  - 查看服务状态"
echo "    $COMPOSE_CMD restart backend     - 重启后端（依赖变更后用）"
echo "    $COMPOSE_CMD exec backend sh     - 进入后端容器调试"
echo ""
echo "  停止: ./stop-dev.sh   清理: ./stop-dev.sh --clean"
echo "==========================================================="
echo ""

# ── 显示服务状态 ──
$COMPOSE_CMD ps

# ── 可选：自动跟踪日志 ──
if [ -n "$LOGS_FLAG" ]; then
  echo ""
  echo "[INFO] 跟踪日志（Ctrl+C 退出跟踪不影响服务）..."
  $COMPOSE_CMD logs -f
fi
