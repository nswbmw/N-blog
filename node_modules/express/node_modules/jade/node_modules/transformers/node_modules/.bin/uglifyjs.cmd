@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\uglify-js\bin\uglifyjs" %*
) ELSE (
  node  "%~dp0\..\uglify-js\bin\uglifyjs" %*
)