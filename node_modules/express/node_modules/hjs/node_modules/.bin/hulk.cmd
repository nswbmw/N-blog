@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\hogan.js\bin\hulk" %*
) ELSE (
  node  "%~dp0\..\hogan.js\bin\hulk" %*
)