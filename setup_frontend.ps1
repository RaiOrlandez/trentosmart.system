
Write-Host "Setting up Frontend..."
npm install
if ($?) {
    Write-Host "Dependencies installed."
}
else {
    Write-Host "Failed to install dependencies."
    exit 1
}

Write-Host "Frontend setup complete. To run:"
Write-Host "npm start"
