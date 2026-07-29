$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root '.venv-ai\Scripts\python.exe'

Push-Location $root
try {
  & $python -m pip install ultralytics
  & $python ai\create_demo_dataset.py
  & $python ai\train_specialized_model.py
}
finally {
  Pop-Location
}
