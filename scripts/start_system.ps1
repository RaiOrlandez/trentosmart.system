
Write-Host "Starting Transmart System..."
Write-Host "Make sure you have run the setup scripts first if this is the first time."

$backendCmd = "cd server; .\.venv\Scripts\Activate.ps1; python manage.py runserver"
$frontendCmd = "npm start"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "Launched Backend and Frontend in separate windows."
