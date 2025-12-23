
Write-Host "Setting up Backend..."

# Ensure venv is active context logic handled by calling python via path
$python = ".\.venv\Scripts\python"
$pip = ".\.venv\Scripts\pip"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating venv..."
    python -m venv .venv
}

Write-Host "Installing requirements..."
& $pip install -r requirements.txt
if (-not $?) {
    Write-Host "Failed to install requirements."
    exit 1
}

Write-Host "Creating database 'transport'..."
& $python create_db_python.py

Write-Host "Running migrations..."
& $python manage.py makemigrations
& $python manage.py migrate

Write-Host "Backend setup complete."
