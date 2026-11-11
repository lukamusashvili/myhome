# Packs extension/ into frontend/public/agentos-extension.zip, which the
# install modal's Download button serves. Run it after any extension change
# (and bump "version" in extension/manifest.json):
#
#   powershell -ExecutionPolicy Bypass -File .\build-extension-zip.ps1
#
# The zip holds a single "agentos-extension" folder so "Extract All" gives
# agents exactly the folder they pick in chrome://extensions -> Load unpacked.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$files = @('manifest.json', 'background.js', 'portal.js', 'popup.html', 'popup.js')

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$out = Join-Path $root 'frontend\public\agentos-extension.zip'
if (Test-Path $out) { Remove-Item $out -Force }

# Built entry by entry (not Compress-Archive): Windows PowerShell 5.1 writes
# backslash paths, which macOS unzips as literal "a\b" file names.
$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
    foreach ($f in $files) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, (Join-Path $root "extension\$f"), "agentos-extension/$f") | Out-Null
    }
} finally {
    $zip.Dispose()
}

$version = (Get-Content (Join-Path $root 'extension\manifest.json') -Raw | ConvertFrom-Json).version
Write-Host "Built $out (v$version)"
