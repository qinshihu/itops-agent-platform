@echo off
REM ============================================================
REM ITOps Agent Platform - 本地开发环境停止脚本 (Windows)
REM ============================================================
REM 用法:
REM   stop-dev.bat           - 停止开发环境（保留数据卷）
REM   stop-dev.bat --clean   - 停止并清理数据卷（删除数据库/备份/上传）
REM   stop-dev.bat --images  - 停止并删除构建的镜像（强制下次启动时重构建）
REM ============================================================

cd /d "%~dp0"

if "%1"=="--clean" goto :clean
if "%1"=="--images" goto :images

echo.
echo ============================================================
echo  停止开发环境
echo ============================================================
echo.

docker compose down 2>nul
if errorlevel 1 (
    docker-compose down 2>nul
    if errorlevel 1 (
        echo [WARN] 未检测到运行中的服务
    )
)

echo.
echo [INFO] 开发环境已停止
echo        数据卷已保留（数据库/备份/上传文件不会丢失）
echo        下次启动: start-dev.bat
echo.
pause
goto :end

:clean
echo.
echo ============================================================
echo  停止并清理开发环境
echo ============================================================
echo [WARN] 这将删除所有开发数据（数据库/备份/上传文件）！
echo.

docker compose down -v 2>nul
if errorlevel 1 (
    docker-compose down -v 2>nul
)

echo.
echo [INFO] 开发环境已停止并清理
echo        下次启动将重新初始化数据库
echo.
pause
goto :end

:images
echo.
echo ============================================================
echo  停止并清理镜像
echo ============================================================
echo.

docker compose down --rmi local 2>nul
if errorlevel 1 (
    docker-compose down --rmi local 2>nul
)

echo.
echo [INFO] 开发环境已停止，本地镜像已删除
echo        下次启动将重新构建镜像
echo.
pause

:end
