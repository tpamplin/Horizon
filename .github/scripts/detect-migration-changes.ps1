# Migration Change Detection (Horizon)

# Detects whether changed files include migration-related changes.
# Returns exit code 0 when migrations need attention.
# 
# Usage:
#   .\detect-migration-changes.ps1
#   .\detect-migration-changes.ps1 -Files "file1.sql,file2.ts"

param(
    [string]$Files = ""
)

if (-not $Files) {
    # Check git diff for staged + unstaged changes
    $Files = (git diff --name-only HEAD) + (git diff --name-only --cached)
}

$migrationPatterns = @(
    'server/migrations/.*\.sql$',           # Migration SQL files
    'server/src/migrations/runner\.ts$',    # Migration runner
    'server/src/models/db\.ts$',            # Database initialization
    'server/package\.json$'                 # Schema-related dependency changes
)

$changed = $Files | Where-Object { $file = $_; $migrationPatterns | Where-Object { $file -match $_ } }

if ($changed) {
    Write-Host "Migration-related files changed:"
    $changed | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "REMINDER: Migrations are additive only."
    Write-Host "  - New migration files (NNN_description.sql): OK"
    Write-Host "  - Edited existing migration files: NOT ALLOWED"
    Write-Host "  - If schema change is needed, create a NEW migration file."
    exit 0
} else {
    exit 1
}
