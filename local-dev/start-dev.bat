@echo off
REM ============================================================
REM ITOps Agent Platform - 本地开发环境启动脚本 (Windows)
REM ============================================================
REM 用法:
REM   start-dev.bat            - 启动开发环境
REM   start-dev.bat --build    - 强制重新构建镜像（更新依赖后用）
REM   start-dev.bat --no-cache - 强制重建且不用缓存
REM   start-dev.bat --logs     - 启动后自动跟踪日志（Ctrl+C 退出跟踪不影响服务）
REM   start-dev.bat --help     - 显示帮助
REM ============================================================

cd /d "%~dp0"

set "BUILD_FLAG="
set "LOGS_FLAG="

:parse_args
if "%1"=="" goto :parse_done
if "%1"=="--build" (
    set "BUILD_FLAG=--build"
    shift
    goto :parse_args
)
if "%1"=="--no-cache" (
    set "BUILD_FLAG=--build --no-cache"
    shift
    goto :parse_args
)
if "%1"=="--logs" (
    set "LOGS_FLAG=1"
    shift
    goto :parse_args
)
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help
echo [WARN] Unknown option: %1
shift
goto :parse_args

:parse_done

echo.
echo ===========================================================
echo  ITOps Agent Platform - 本地开发环境
echo ===========================================================
echo.

REM ── 检查 Docker ──
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker 未运行，请启动 Docker Desktop 后重试
    pause
    exit /b 1
)

REM ── 检查 Docker Compose ──
docker compose version >nul 2>&1
if errorlevel 1 (
    docker-compose --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] 未检测到 docker compose，请安装 Docker Desktop
        pause
        exit /b 1
    )
    set "COMPOSE_CMD=docker-compose"
) else (
    set "COMPOSE_CMD=docker compose"
)

echo [INFO] 使用: %COMPOSE_CMD%
echo.

REM ── 停止旧容器（如果存在） ──
echo [INFO] 停止旧容器（如有）...
%COMPOSE_CMD% down 2>nul
echo.

REM ── 构建 ──
if defined BUILD_FLAG (
    echo [INFO] 重新构建镜像: %BUILD_FLAG%
    %COMPOSE_CMD% %BUILD_FLAG%
) else (
    echo [INFO] 如需要将构建镜像...
    %COMPOSE_CMD% build
)
if errorlevel 1 (
    echo [ERROR] 构建失败
    pause
    exit /b 1
)
echo.

REM ── 启动 ──
echo [INFO] 启动服务...
%COMPOSE_CMD% up -d
if errorlevel 1 (
    echo [ERROR] 启动失败
    pause
    exit /b 1
)
echo.

echo ===========================================================
echo  开发环境已启动！
echo ===========================================================
echo.
echo  前端:           http://localhost:5173
echo  后端 API:       http://localhost:3001
echo  健康检查:       http://localhost:3001/health/live
echo  Swagger 文档:   http://localhost:3001/api-docs
echo  Node.js 调试:   localhost:9229 （chrome://inspect）
echo.
echo  默认账号: admin / admin（首次登录会强制改密码）
echo.
echo  常用命令:
echo    %COMPOSE_CMD% logs -f             - 实时跟踪所有日志
echo    %COMPOSE_CMD% logs -f backend     - 实时跟踪后端日志
echo    %COMPOSE_CMD% logs -f frontend    - 实时跟踪前端日志
echo    %COMPOSE_CMD% ps                  - 查看服务状态
echo    %COMPOSE_CMD% restart backend     - 重启后端（依赖变更后用）
echo    %COMPOSE_CMD% exec backend sh     - 进入后端容器调试
echo.
echo  停止: stop-dev.bat   清理: stop-dev.bat --clean
echo ===========================================================
echo.

REM ── 显示服务状态 ──
%COMPOSE_CMD% ps

REM ── 可选：自动跟踪日志 ──
if defined LOGS_FLAG (
    echo.
    echo [INFO] 跟踪日志（Ctrl+C 退出跟踪不影响服务）...
    %COMPOSE_CMD% logs -f
)

goto :end

:help
echo.
echo ITOps Agent Platform - Local Development Environment
echo.
echo Usage: start-dev.bat [OPTIONS]
echo.
echo Options:
echo   --build       强制重新构建镜像（更新了 package.json 后用）
echo   --no-cache    强制重建且不用缓存
echo   --logs        启动后自动跟踪日志
echo   --help, -h    显示此帮助
echo.
exit /b 0

:end
pause
