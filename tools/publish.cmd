@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0.."
python "%~dp0package-release.py" %*
set "PUBLISH_EXIT=%ERRORLEVEL%"
if not "%PUBLISH_EXIT%"=="0" echo 发行失败。请查看上方错误信息。
echo.
pause
popd
exit /b %PUBLISH_EXIT%
