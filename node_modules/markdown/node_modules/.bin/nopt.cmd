@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\nopt\bin\nopt.js" %*
) ELSE (
  node  "%~dp0\..\nopt\bin\nopt.js" %*
)