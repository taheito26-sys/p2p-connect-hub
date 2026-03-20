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
$keyValue = "pk_test_replace_with_your_local_clerk_publishable_key"
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
Write-Host "Important: use a Clerk publishable key whose allowed origins include your local dev URL (for example http://localhost:8080)."
Write-Host "Then fully stop your Vite dev server and run:"
Write-Host "  npm run dev"