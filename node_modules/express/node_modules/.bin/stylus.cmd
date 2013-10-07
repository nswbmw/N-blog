@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\stylus\bin\stylus" %*
) ELSE (
  node  "%~dp0\..\stylus\bin\stylus" %*
)