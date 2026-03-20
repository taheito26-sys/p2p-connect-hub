# fix-clerk-env.ps1
# Usage:
#   .\fix-clerk-env.ps1
# Or:
#   .\fix-clerk-env.ps1 -RepoRoot "C:\p2p-connect-hub"

param(
    [string]$RepoRoot = "C:\p2p-connect-hub"
)

$ErrorActionPreference = "Stop"

$envFile = Join-Path $RepoRoot ".env.local"
$keyName = "VITE_CLERK_PUBLISHABLE_KEY"
$keyValue = "pk_live_Y2xlcmsudGFoZWl0bzI2LndvcmtlcnMuZGV2JA"
$newLine = "$keyName=$keyValue"

if (-not (Test-Path $RepoRoot)) {
    throw "Repo root does not exist: $RepoRoot"
}

Write-Host "Repo root: $RepoRoot"
Write-Host "Target env file: $envFile"

# Create file if missing
if (-not (Test-Path $envFile)) {
    Set-Content -Path $envFile -Value $newLine -Encoding UTF8
    Write-Host "Created .env.local with Clerk key."
}
else {
    $content = Get-Content -Path $envFile -Raw -Encoding UTF8

    if ($content -match "(?m)^\s*$keyName\s*=") {
        $updated = [regex]::Replace(
            $content,
            "(?m)^\s*$keyName\s*=.*$",
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newLine }
        )

        if ($updated -ne $content) {
            Set-Content -Path $envFile -Value $updated -Encoding UTF8
            Write-Host "Updated existing $keyName in .env.local."
        }
        else {
            Write-Host "$keyName already exists and appears correct."
        }
    }
    else {
        $trimmed = $content.TrimEnd("`r", "`n")
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            Set-Content -Path $envFile -Value $newLine -Encoding UTF8
        }
        else {
            Set-Content -Path $envFile -Value ($trimmed + "`r`n" + $newLine) -Encoding UTF8
        }
        Write-Host "Appended $keyName to .env.local."
    }
}

Write-Host ""
Write-Host "Final .env.local contents:"
Get-Content -Path $envFile -Encoding UTF8 | ForEach-Object { Write-Host $_ }

Write-Host ""
Write-Host "Important: fully stop your Vite dev server, then run:"
Write-Host "  npm run dev"