@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\mocha\bin\mocha" %*
) ELSE (
  node  "%~dp0\..\mocha\bin\mocha" %*
)