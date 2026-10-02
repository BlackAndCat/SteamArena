@echo off
setlocal
call "%~dp0tools\publish.cmd" %*
exit /b %ERRORLEVEL%
