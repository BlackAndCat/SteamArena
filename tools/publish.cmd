@echo off
setlocal
pushd "%~dp0.."
python "%~dp0package-release.py" --publish %*
set "PUBLISH_EXIT=%ERRORLEVEL%"
popd
exit /b %PUBLISH_EXIT%
