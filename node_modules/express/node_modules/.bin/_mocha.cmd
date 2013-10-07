@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\mocha\bin\_mocha" %*
) ELSE (
  node  "%~dp0\..\mocha\bin\_mocha" %*
)