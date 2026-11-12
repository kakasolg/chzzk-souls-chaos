@echo off
rem Builds overlay-dll\chaos-overlay.dll with MSVC (Visual Studio 2019+ or Build Tools, "Desktop development with C++").
setlocal
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath > "%TEMP%\chaos-vspath.txt"
set /p VS=<"%TEMP%\chaos-vspath.txt"
if not defined VS ( echo MSVC not found & exit /b 1 )
call "%VS%\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1
cd /d "%~dp0"
rem Optional arg: output name (the game keeps the loaded DLL locked, so dev builds use another name)
set "OUT=%~1"
if not defined OUT set "OUT=chaos-overlay.dll"
if not exist obj mkdir obj
cl /nologo /O2 /MT /EHsc /std:c++17 /W3 /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS /Foobj\ chaos-overlay.cpp /LD /link /OUT:%OUT% /IMPLIB:obj\chaos-overlay.lib || exit /b 1
echo built %~dp0%OUT%
