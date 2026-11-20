[CmdletBinding()]
param([switch]$RunConcurrencyTests, [switch]$RunFullSuite, [switch]$UpgradeFixture)

$ErrorActionPreference = 'Stop'
$container = "nexus-payroll-91b-$([guid]::NewGuid().ToString('N'))"
$containerRunner = "$($container)-runner"
$ownerLabel = "com.converyn.payroll-verification=$([guid]::NewGuid().ToString('N'))"
$database = 'nexus_payroll_91b'
$databaseUser = 'payroll_91b'
$password = [guid]::NewGuid().ToString('N')
$migrationRoot = Join-Path $PSScriptRoot '../prisma/migrations'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$image = 'nexus-payroll-verification:local'
$guardMigration = '20261118160000_payroll_approved_snapshot_guard'

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE."
    }
}

function Invoke-DockerProbe {
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $output = & docker @args 2>$null
    if ($LASTEXITCODE -eq 0) { $output }
}

if ($RunFullSuite) {
    Get-Command docker, git, node -ErrorAction Stop | Out-Null
    Invoke-Docker info --format 'Docker Engine {{.ServerVersion}}'
    Push-Location $repoRoot
    $results = [ordered]@{}
    try {
        $sources = & git ls-files --cached --others --exclude-standard -- Dockerfile .dockerignore package.json pnpm-lock.yaml pnpm-workspace.yaml patches apps/api apps/web/package.json certs/supabase-root-2021.crt
        if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate verification image inputs.' }
        $manifest = ($sources | Sort-Object -Unique | ForEach-Object {
            if (Test-Path -LiteralPath $_ -PathType Leaf) {
                "$_ $((Get-FileHash -LiteralPath $_).Hash)"
            }
        }) -join "`n"
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $revision = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($manifest))).Replace('-', '').ToLowerInvariant()
        }
        finally { $sha.Dispose() }
        $builtRevision = Invoke-DockerProbe image inspect --format '{{index .Config.Labels "com.converyn.payroll-verification.inputs"}}' $image
        if ($builtRevision -ne $revision) {
            Invoke-Docker build --target api-dev --label "com.converyn.payroll-verification.inputs=$revision" -t $image .
        } else {
            Write-Output 'Reusing current Payroll verification image.'
        }

        $checks = [ordered]@{
            'Fresh PostgreSQL' = { & $PSCommandPath -RunConcurrencyTests }
            'PostgreSQL upgrade' = { & $PSCommandPath -RunConcurrencyTests -UpgradeFixture }
            'PGlite API and unit tests' = {
                Invoke-Docker run --rm --name $containerRunner --network none --label $ownerLabel `
                    --memory 2g --cpus 2 --pids-limit 128 --env NODE_ENV=test $image `
                    sh -ec 'pnpm exec prisma generate && node scripts/run-tests.mjs tests/features/payroll/phase2.test.ts tests/features/payroll/phase3.test.ts tests/features/payroll/phase5.test.ts tests/features/payroll/calculator.test.ts tests/features/payroll/periods.test.ts tests/features/payroll/database-permissions-audit.test.ts'
            }
            'TypeScript compilation' = {
                Invoke-Docker run --rm --name $containerRunner --network none --label $ownerLabel `
                    --memory 2g --cpus 2 --pids-limit 128 $image `
                    sh -ec 'pnpm exec prisma generate && node node_modules/typescript/lib/tsc.js --noEmit -p tests/tsconfig.json'
                if ($LASTEXITCODE -ne 0) { throw 'API TypeScript compilation failed.' }
                & node (Join-Path $repoRoot 'apps/web/node_modules/typescript/bin/tsc') --noEmit -p (Join-Path $repoRoot 'apps/web/tsconfig.json')
                if ($LASTEXITCODE -ne 0) { throw 'Web TypeScript compilation failed.' }
            }
            'ESLint' = {
                & (Join-Path $repoRoot 'node_modules/.bin/eslint.cmd') . --max-warnings 0
                if ($LASTEXITCODE -ne 0) { throw 'ESLint failed.' }
            }
            'PowerShell syntax' = {
                $tokens = $null
                $parseErrors = $null
                [System.Management.Automation.Language.Parser]::ParseFile($PSCommandPath, [ref]$tokens, [ref]$parseErrors) | Out-Null
                if ($parseErrors.Count -gt 0) { throw "PowerShell syntax check failed: $($parseErrors[0].Message)" }
            }
            'Formatting and diff' = {
                $prettier = & node -p "require.resolve('prettier/bin/prettier.cjs')"
                if ($LASTEXITCODE -ne 0) { throw 'Install workspace dependencies before running formatting checks.' }
                & node $prettier --check apps/api/tests/features/payroll/postgres-concurrency.integration.ts apps/api/tests/features/payroll/database-permissions-audit.test.ts apps/api/tests/features/payroll/calculator.test.ts apps/api/tests/features/payroll/phase3.test.ts apps/api/tests/features/payroll/phase5.test.ts apps/api/tests/support/pglite-app.ts apps/api/src/lib/db.ts apps/api/src/lib/postgres-connection.ts apps/api/src/lib/payroll-db-permissions-audit.ts apps/api/scripts/audit-payroll-db-permissions.ts apps/api/src/features/payroll/payroll-runs.service.ts apps/api/src/features/payroll/payroll.service.ts docs/payroll-outstanding-risk-closure-9.5.md
                if ($LASTEXITCODE -ne 0) { throw 'Prettier check failed.' }
                & git diff --check
                if ($LASTEXITCODE -ne 0) { throw 'Diff check failed.' }
            }
        }
        foreach ($check in $checks.GetEnumerator()) {
            Write-Output "Running $($check.Key)"
            try { & $check.Value; $results[$check.Key] = 'PASS' }
            catch { $results[$check.Key] = 'FAIL'; Write-Warning "$($check.Key) failed: $_" }
        }
    }
    finally {
        Pop-Location
        $remaining = Invoke-Docker ps --all --no-trunc --filter "label=$ownerLabel" --filter "name=^/$containerRunner`$" --format '{{.ID}}'
        foreach ($id in $remaining) {
            if ($id -cmatch '^[a-f0-9]{64}$') { Invoke-Docker rm --force --volumes $id | Out-Null }
        }
    }
    Write-Output 'Payroll Phase 9.1-9.5 local verification summary'
    foreach ($result in $results.GetEnumerator()) { Write-Output "$($result.Key): $($result.Value)" }
    if ($results.Values -contains 'FAIL') {
        Write-Output 'Audit verdict: BLOCKED. A verification stage failed.'
        throw 'Payroll verification failed.'
    }
    Write-Output 'Audit verdict: local regression stages passed. Deployed role verification remains deferred to Phase 9.3/9.4 deployment review.'
    return
}

if ($UpgradeFixture -and -not $RunConcurrencyTests) { throw 'Upgrade verification requires the PostgreSQL regression suite.' }
$verificationFailed = $false
try {
    Invoke-Docker run --detach --rm --name $container --network none `
        --label $ownerLabel `
        --memory 512m --cpus 1 --pids-limit 128 `
        --env "POSTGRES_DB=$database" --env "POSTGRES_USER=$databaseUser" `
        --env "POSTGRES_PASSWORD=$password" postgres:16

    $network = Invoke-Docker inspect --format '{{.HostConfig.NetworkMode}}' $container
    if ($network -ne 'none') { throw 'Expected a network-isolated database container.' }
    $connection = @('exec', $container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
        '-h', '/var/run/postgresql', '-U', $databaseUser, '-d', $database)
    $identity = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        # Wait for the permanent server rather than the temporary initialization server.
        $server = Invoke-DockerProbe exec $container cat /proc/1/comm
        if ($server -eq 'postgres') {
            $identity = Invoke-DockerProbe @connection -Atc "SELECT current_database(), current_user, inet_server_addr() IS NULL"
            if ($null -ne $identity) { break }
        }
        Start-Sleep -Seconds 1
    }
    if ($identity -ne "$database|$databaseUser|t") {
        throw 'The database identity or local socket check failed.'
    }
    Write-Output "Verified disposable database via local socket: $identity"

    $migrations = Get-ChildItem -LiteralPath $migrationRoot -Directory |
        Where-Object Name -Match '^\d' | Sort-Object Name
    if ($UpgradeFixture) {
        if ($migrations[-1].Name -ne $guardMigration) { throw 'Upgrade fixture expects the snapshot guard to be the final migration.' }
        $migrations = @($migrations | Where-Object Name -ne $guardMigration)
    }
    foreach ($migration in $migrations) {
        $sql = Join-Path $migration.FullName 'migration.sql'
        Invoke-Docker cp $sql "${container}:/tmp/nexus-migration.sql"
        Invoke-Docker @connection -f /tmp/nexus-migration.sql | Out-Null
    }
    Write-Output "Applied $($migrations.Count) repository migrations."
    Invoke-Docker @connection -c 'SELECT version();'
    Invoke-Docker @connection -c 'SELECT event_object_table, trigger_name FROM information_schema.triggers WHERE trigger_name LIKE ''payroll%'' ORDER BY 1, 2;'
    if ($RunConcurrencyTests) {
        $testUrl = "postgresql://${databaseUser}:${password}@127.0.0.1:5432/${database}?sslmode=disable"
        $upgradeMode = [int][bool]$UpgradeFixture
        Invoke-Docker run --rm --name $containerRunner --network "container:$container" `
            --label $ownerLabel `
            --memory 2g --cpus 2 --pids-limit 128 `
            --env "DATABASE_URL=$testUrl" --env DATABASE_POOL_MAX=4 `
            --env "PAYROLL_POSTGRES_TEST_PASSWORD=$password" --env NODE_ENV=test `
            --env "PAYROLL_POSTGRES_TEST_UPGRADE=$upgradeMode" `
            --env NODE_OPTIONS=--trace-deprecation $image `
            sh -ec 'pnpm exec prisma generate && node scripts/run-tests.mjs tests/features/payroll/postgres-concurrency.integration.ts'
    }
}
catch {
    $verificationFailed = $true
    throw
}
finally {
    try {
        # A failed run command can leave a created container behind.
        $owned = Invoke-Docker ps --all --no-trunc --filter "label=$ownerLabel" --format '{{.ID}}|{{.Names}}'
        foreach ($entry in ($owned | Sort-Object { $_ -like "*|$container-runner" } -Descending)) {
            $id, $name = $entry -split '\|', 2
            if (($name -ceq $container -or $name -ceq "$container-runner") -and $id -cmatch '^[a-f0-9]{64}$') {
                Invoke-Docker rm --force --volumes $id | Out-Null
            }
        }
    }
    catch {
        if (-not $verificationFailed) { throw }
        Write-Warning "Could not confirm cleanup of test container $container. Docker reported: $_"
    }
}
