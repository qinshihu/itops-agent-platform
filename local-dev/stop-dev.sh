#!/bin/bash
# ============================================================
# ITOps Agent Platform - 本地开发环境停止脚本 (Linux/Mac)
# ============================================================
# 用法:
#   ./stop-dev.sh           - 停止开发环境（保留数据卷）
#   ./stop-dev.sh --clean   - 停止并清理数据卷
#   ./stop-dev.sh --images  - 停止并删除构建的镜像
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 选择 docker compose 命令
if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif docker-compose --version > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[WARN] 未检测到 docker compose"
  exit 1
fi

case "${1:-}" in
  --clean)
    echo ""
    echo "==========================================================="
    echo "  停止并清理开发环境"
    echo "==========================================================="
    echo "[WARN] 这将删除所有开发数据（数据库/备份/上传文件）！"
    echo ""

    $COMPOSE_CMD down -v

    echo ""
    echo "[INFO] 开发环境已停止并清理"
    echo "       下次启动将重新初始化数据库"
    echo ""
    ;;

  --images)
    echo ""
    echo "==========================================================="
    echo "  停止并清理镜像"
    echo "==========================================================="
    echo ""

    $COMPOSE_CMD down --rmi local

    echo ""
    echo "[INFO] 开发环境已停止，本地镜像已删除"
    echo "       下次启动将重新构建镜像"
    echo ""
    ;;

  *)
    echo ""
    echo "==========================================================="
    echo "  停止开发环境"
    echo "==========================================================="
    echo ""

    $COMPOSE_CMD down

    echo ""
    echo "[INFO] 开发环境已停止"
    echo "       数据卷已保留（数据库/备份/上传文件不会丢失）"
    echo "       下次启动: ./start-dev.sh"
    echo ""
    ;;
esac
