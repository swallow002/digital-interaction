$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimePython = 'C:\Users\wangy\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$venvPython = Join-Path $root '.venv-ai\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $venvPython)) {
  & $runtimePython -m venv (Join-Path $root '.venv-ai')
}

Push-Location $root
try {
  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r requirements-ai.txt
  $modelDir = Join-Path $root 'ai\models'
  $modelPath = Join-Path $modelDir 'yolo11n-pose.onnx'
  if (-not (Test-Path -LiteralPath $modelPath)) {
    New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
    Invoke-WebRequest -Uri 'https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n-pose.onnx' -OutFile $modelPath
  }
  & $venvPython ai\analyze_video_pose.py
}
finally {
  Pop-Location
}
