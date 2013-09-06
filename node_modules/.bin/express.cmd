@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\express\bin\express" %*
) ELSE (
  node  "%~dp0\..\express\bin\express" %*
)