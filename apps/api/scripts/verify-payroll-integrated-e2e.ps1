[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$null = Add-Type -AssemblyName System.Net.Http
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$apiLoopbackPreload = ([System.Uri]::new((Join-Path $PSScriptRoot 'payroll-e2e-loopback.mjs'))).AbsoluteUri
$suffix = [guid]::NewGuid().ToString('N')
$runId = $suffix.Substring(0, 12)
$database = "payroll_c_$runId"
$databaseUser = "payroll_c_$runId"
$databasePassword = [guid]::NewGuid().ToString('N')
$databaseContainer = "payroll-c-db-$suffix"
$network = "payroll-c-net-$suffix"
$ownerLabel = "com.converyn.payroll-c-e2e=$suffix"
$targetDate = (Get-Date).AddMonths(1)
$period = $targetDate.ToString('yyyy-MM', [Globalization.CultureInfo]::InvariantCulture)
$periodStart = $targetDate.ToString('yyyy-MM-01', [Globalization.CultureInfo]::InvariantCulture)
$userPassword = "PayrollC-E2E!$runId"
$jwtSecret = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
$apiProcess = $null
$webProcess = $null
$databaseUrl = $null
$taskDirectory = Join-Path $env:TEMP "converyn-payroll-c-$suffix"
$apiLog = Join-Path $taskDirectory 'api.log'
$apiErrorLog = Join-Path $taskDirectory 'api-error.log'
$webLog = Join-Path $taskDirectory 'web.log'
$webErrorLog = Join-Path $taskDirectory 'web-error.log'
$expectedPath = Join-Path $taskDirectory 'verified-payroll.json'
$containerStarted = $false
$networkCreated = $false

function Get-FreeLoopbackPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try {
        return [int]$listener.LocalEndpoint.Port
    }
    finally {
        $listener.Stop()
    }
}

function Save-Environment([string[]]$Names) {
    $saved = @{}
    foreach ($name in $Names) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    return $saved
}

function Restore-Environment([hashtable]$Saved) {
    foreach ($name in $Saved.Keys) {
        [Environment]::SetEnvironmentVariable($name, $Saved[$name], 'Process')
    }
}

function Set-EnvironmentValues([hashtable]$Values) {
    foreach ($name in $Values.Keys) {
        [Environment]::SetEnvironmentVariable($name, [string]$Values[$name], 'Process')
    }
}

function Invoke-Pnpm([string[]]$PnpmArguments, [hashtable]$Environment) {
    $saved = Save-Environment @($Environment.Keys)
    try {
        Set-EnvironmentValues $Environment
        & pnpm @PnpmArguments
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm $($PnpmArguments -join ' ') failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Restore-Environment $saved
    }
}

function Start-PnpmProcess(
    [string[]]$PnpmArguments,
    [hashtable]$Environment,
    [string]$StandardOutput,
    [string]$StandardError
) {
    $saved = Save-Environment @($Environment.Keys)
    try {
        Set-EnvironmentValues $Environment
        return Start-Process `
            -FilePath (Get-Command pnpm.cmd -ErrorAction Stop).Source `
            -ArgumentList $PnpmArguments `
            -WorkingDirectory $repoRoot `
            -WindowStyle Hidden `
            -PassThru `
            -RedirectStandardOutput $StandardOutput `
            -RedirectStandardError $StandardError
    }
    finally {
        Restore-Environment $saved
    }
}

function Wait-ForHttp([string]$Uri, [string]$Name, [System.Diagnostics.Process]$Process) {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(3)
    $lastStatus = 'no response'
    try {
        for ($attempt = 0; $attempt -lt 120; $attempt++) {
            if ($Process.HasExited) {
                throw "$Name process exited before its readiness endpoint responded."
            }
            try {
                $response = $client.GetAsync($Uri).GetAwaiter().GetResult()
                $lastStatus = [string][int]$response.StatusCode
                if ($response.StatusCode -eq [System.Net.HttpStatusCode]::OK) {
                    $response.Dispose()
                    return
                }
                $response.Dispose()
            }
            catch {
                $lastStatus = $_.Exception.GetType().Name
            }
            Start-Sleep -Milliseconds 500
        }
    }
    finally {
        $client.Dispose()
    }
    $listeners = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
        Where-Object { $_.Port -eq ([uri]$Uri).Port } |
        ForEach-Object { $_.ToString() }) -join ', '
    throw "$Name readiness timed out at $Uri (last result: $lastStatus; listeners: $listeners)."
}

function Test-LoopbackPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $Port)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Assert-LoopbackListener([int]$Port, [string]$Name) {
    $endpoints = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
        Where-Object { $_.Port -eq $Port })
    if (
        $endpoints.Count -eq 0 -or
        @($endpoints | Where-Object { -not $_.Address.Equals([System.Net.IPAddress]::Loopback) }).Count -gt 0
    ) {
        throw "$Name is not bound exclusively to IPv4 loopback."
    }
}

function Stop-ProcessTree([System.Diagnostics.Process]$Process) {
    if ($null -ne $Process -and -not $Process.HasExited) {
        & taskkill.exe /PID $Process.Id /T /F *> $null
    }
}

function Show-RedactedLog([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $content = [System.IO.File]::ReadAllText($Path)
    if ($databaseUrl) { $content = $content.Replace($databaseUrl, '[DATABASE_URL REDACTED]') }
    if ($databasePassword) { $content = $content.Replace($databasePassword, '[DATABASE PASSWORD REDACTED]') }
    if ($jwtSecret) { $content = $content.Replace($jwtSecret, '[JWT SECRET REDACTED]') }
    $lines = $content -split "`r?`n"
    foreach ($line in ($lines | Select-Object -Last 35)) {
        if ($line.Trim()) { Write-Output $line }
    }
}

try {
    New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
    Get-Command docker, pnpm, node -ErrorAction Stop | Out-Null

    $apiPort = Get-FreeLoopbackPort
    $webPort = Get-FreeLoopbackPort
    $databasePort = Get-FreeLoopbackPort
    $apiUrl = "http://127.0.0.1:$apiPort"
    $webUrl = "http://127.0.0.1:$webPort"
    $databaseUrl = "postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${databasePort}/${database}?sslmode=disable"

    # Docker Desktop drops published-port connectivity for internal networks.
    # This unique bridge publishes PostgreSQL only on IPv4 loopback.
    docker network create --label $ownerLabel $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the private E2E network.' }
    $networkCreated = $true
    $internal = docker network inspect --format '{{.Internal}}' $network
    $driver = docker network inspect --format '{{.Driver}}' $network
    if ($LASTEXITCODE -ne 0 -or $internal -ne 'false' -or $driver -ne 'bridge') {
        throw 'The E2E database network is not an isolated user-defined bridge.'
    }

    docker run --detach --rm `
        --name $databaseContainer `
        --network $network `
        --publish "127.0.0.1:${databasePort}:5432" `
        --label $ownerLabel `
        --memory 512m --cpus 1 --pids-limit 128 `
        --env "POSTGRES_DB=$database" `
        --env "POSTGRES_USER=$databaseUser" `
        --env "POSTGRES_PASSWORD=$databasePassword" `
        postgres:16 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not launch the disposable PostgreSQL container.' }
    $containerStarted = $true

    $networkBinding = docker inspect --format '{{json .HostConfig.PortBindings}}' $databaseContainer
    if ($LASTEXITCODE -ne 0 -or $networkBinding -notmatch '127\.0\.0\.1') {
        throw 'The disposable database is not bound to loopback only.'
    }
    $databaseReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        docker exec $databaseContainer pg_isready -U $databaseUser -d $database *> $null
        if ($LASTEXITCODE -eq 0) { $databaseReady = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $databaseReady) {
        docker logs --tail 30 $databaseContainer
        throw 'PostgreSQL did not become ready inside the disposable container.'
    }
    Write-Output 'PostgreSQL passed its in-container readiness check.'
    $hostPortReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-LoopbackPort $databasePort) { $hostPortReady = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $hostPortReady) {
        docker inspect --format '{{json .NetworkSettings.Ports}}' $databaseContainer
        docker logs --tail 30 $databaseContainer
        throw 'PostgreSQL was ready in Docker, but its host loopback port did not accept connections.'
    }
    Write-Output 'The PostgreSQL port is reachable through its loopback-only host binding.'
    $identity = docker exec $databaseContainer psql -X -v ON_ERROR_STOP=1 `
        -U $databaseUser -d $database -Atc `
        'SELECT current_database(), current_user, inet_server_addr() IS NULL'
    if ($LASTEXITCODE -ne 0 -or $identity -ne "$database|$databaseUser|t") {
        throw 'PostgreSQL database identity verification failed.'
    }
    docker exec $databaseContainer psql -X -v ON_ERROR_STOP=1 -U $databaseUser -d $database -Atc 'SELECT version()'
    if ($LASTEXITCODE -ne 0) { throw 'Could not confirm PostgreSQL version.' }

    $databaseEnvironment = @{
        DATABASE_URL = $databaseUrl
        DIRECT_URL = $databaseUrl
        NEXUS_PAYROLL_E2E_DATABASE = $database
        NEXUS_PAYROLL_E2E_DATABASE_USER = $databaseUser
        NEXUS_PAYROLL_E2E_RUN_ID = $runId
        NEXUS_PAYROLL_E2E_PASSWORD = $userPassword
    }
    Write-Output 'Applying Prisma migrations to the verified disposable database.'
    Invoke-Pnpm @('--filter', '@nexus/api', 'exec', 'prisma', 'migrate', 'deploy') $databaseEnvironment
    Write-Output 'Creating synthetic test-only accounts and employee links.'
    Invoke-Pnpm @('--filter', '@nexus/api', 'exec', 'tsx', 'scripts/payroll-integrated-fixture.ts', 'seed') $databaseEnvironment

    $apiEnvironment = @{
        DATABASE_URL = $databaseUrl
        DIRECT_URL = $databaseUrl
        DATABASE_POOL_MAX = '4'
        JWT_SECRET = $jwtSecret
        NODE_ENV = 'development'
        PAYROLL_LOCAL_SIMULATOR = 'true'
        PORT = [string]$apiPort
        NEXUS_PAYROLL_E2E_API_PORT = [string]$apiPort
        NODE_OPTIONS = "--import=$apiLoopbackPreload"
        WEB_ORIGIN = $webUrl
    }
    Write-Output "Starting Express API on loopback port $apiPort."
    $apiProcess = Start-PnpmProcess `
        @('--filter', '@nexus/api', 'exec', 'tsx', 'src/index.ts') `
        $apiEnvironment $apiLog $apiErrorLog
    Wait-ForHttp "$apiUrl/api/ready" 'Express API' $apiProcess
    Assert-LoopbackListener $apiPort 'Express API'

    $webEnvironment = @{
        API_PROXY_TARGET = $apiUrl
        HOSTNAME = '127.0.0.1'
        NODE_ENV = 'development'
        NEXT_TELEMETRY_DISABLED = '1'
        PORT = [string]$webPort
    }
    Write-Output "Starting Next.js frontend on loopback port $webPort."
    $webProcess = Start-PnpmProcess `
        @('--filter', '@nexus/web', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', [string]$webPort) `
        $webEnvironment $webLog $webErrorLog
    Wait-ForHttp "$webUrl/internal/login" 'Next.js frontend' $webProcess
    Assert-LoopbackListener $webPort 'Next.js frontend'

    $testEnvironment = @{
        NEXUS_E2E_BASE_URL = $webUrl
        NEXUS_E2E_LIVE = '1'
        NEXUS_PAYROLL_E2E_DATABASE = $database
        NEXUS_PAYROLL_E2E_DATABASE_USER = $databaseUser
        NEXUS_PAYROLL_E2E_RUN_ID = $runId
        NEXUS_PAYROLL_E2E_PASSWORD = $userPassword
        NEXUS_PAYROLL_E2E_PERIOD = $period
        NEXUS_PAYROLL_E2E_EXPECTED_PATH = $expectedPath
        PLAYWRIGHT_CHANNEL = 'chrome'
    }
    Write-Output 'Running the real browser, Express, and PostgreSQL Admin-to-Staff lifecycle and role checks.'
    Invoke-Pnpm @(
        '--filter', '@nexus/web', 'exec', 'playwright', 'test',
        '--config=playwright.integrated.config.ts',
        '--grep', 'PAY-E2E-001|PAY-E2E-002'
    ) $testEnvironment

    Write-Output 'Running the simulated disbursement browser workflow and idempotent batch check.'
    Invoke-Pnpm @(
        '--filter', '@nexus/web', 'exec', 'playwright', 'test',
        '--config=playwright.integrated.config.ts',
        '--grep', 'PAY-E2E-007'
    ) $testEnvironment

    Write-Output 'Verifying payroll and simulator persistence independently through Prisma.'
    $verifyEnvironment = $databaseEnvironment.Clone()
    $verifyEnvironment['NEXUS_PAYROLL_E2E_PERIOD'] = $period
    $verifyEnvironment['NEXUS_PAYROLL_E2E_EXPECTED_PATH'] = $expectedPath
    Invoke-Pnpm @('--filter', '@nexus/api', 'exec', 'tsx', 'scripts/payroll-integrated-fixture.ts', 'verify') $verifyEnvironment

    Write-Output 'Comparing real CSV and XLSX downloads with independently queried database rows.'
    Invoke-Pnpm @(
        '--filter', '@nexus/web', 'exec', 'playwright', 'test',
        '--config=playwright.integrated.config.ts',
        '--grep', 'PAY-E2E-006'
    ) $testEnvironment

    Write-Output 'Running integrated responsive, accessibility, and network-recovery checks.'
    Invoke-Pnpm @(
        '--filter', '@nexus/web', 'exec', 'playwright', 'test',
        '--config=playwright.integrated.config.ts',
        '--grep', 'PAY-E2E-008|PAY-E2E-009|PAY-E2E-010'
    ) $testEnvironment

    Write-Output 'Repeating the independent database verification after all integrated workflows.'
    Invoke-Pnpm @('--filter', '@nexus/api', 'exec', 'tsx', 'scripts/payroll-integrated-fixture.ts', 'verify') $verifyEnvironment
    Write-Output 'Integrated Payroll E2E and independent database verification passed.'
}
catch {
    Write-Warning "Integrated Payroll E2E failed: $_"
    Stop-ProcessTree $webProcess
    Stop-ProcessTree $apiProcess
    Write-Output 'Recent API log (sensitive values redacted):'
    Show-RedactedLog $apiLog
    Show-RedactedLog $apiErrorLog
    Write-Output 'Recent frontend log (sensitive values redacted):'
    Show-RedactedLog $webLog
    Show-RedactedLog $webErrorLog
    throw
}
finally {
    Stop-ProcessTree $webProcess
    Stop-ProcessTree $apiProcess
    if ($containerStarted) {
        docker stop $databaseContainer *> $null
    }
    if ($networkCreated) {
        docker network rm $network *> $null
    }

    $remainingContainers = docker ps -aq --filter "label=$ownerLabel"
    foreach ($containerId in $remainingContainers) {
        if ($containerId -match '^[a-f0-9]{64}$') {
            docker rm --force --volumes $containerId *> $null
        }
    }
    $remainingNetworks = docker network ls -q --filter "label=$ownerLabel"
    foreach ($networkId in $remainingNetworks) {
        if ($networkId -match '^[a-f0-9]{64}$') {
            docker network rm $networkId *> $null
        }
    }

    $resolvedTaskDirectory = [System.IO.Path]::GetFullPath($taskDirectory)
    $resolvedTempDirectory = [System.IO.Path]::GetFullPath($env:TEMP)
    if (
        $resolvedTaskDirectory.StartsWith($resolvedTempDirectory, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($resolvedTaskDirectory) -eq "converyn-payroll-c-$suffix"
    ) {
        Remove-Item -LiteralPath $resolvedTaskDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
