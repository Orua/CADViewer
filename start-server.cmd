@echo off
setlocal
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 -m http.server 53281 --directory "%~dp0"
) else (
  python -m http.server 53281 --directory "%~dp0"
)
endlocal
