# One-time setup for hosting the dashboard on a Windows server with
# auto-deploy from GitHub. Run in PowerShell as Administrator:
#
#   powershell -ExecutionPolicy Bypass -File setup.ps1 -RepoUrl <url> -RunnerToken <token>
#
# Installs Node.js, writes backend\.env, registers a startup task that runs the
# dashboard, opens the firewall port and installs a GitHub Actions runner as a
# service. After this, every push to main deploys automatically.
param(
  [Parameter(Mandatory)] [string] $RepoUrl,
  [Parameter(Mandatory)] [string] $RunnerToken,
  [string] $InstallDir = 'C:\metflix_dashboard',
  [string] $TaskName = 'metflix_dashboard',
  [int]    $Port = 3001,
  [string] $QbittorrentUrl = 'http://localhost:8080',
  [string] $QbittorrentUsername = 'admin',
  [string] $QbittorrentPassword,
  [string] $TmdbApiKey,
  [string] $DownloadPath = 'G:\'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# --- Node.js ---------------------------------------------------------------
$node = 'C:\Program Files\nodejs\node.exe'
if (Test-Path $node) {
  Step "Node.js already installed: $(& $node -v)"
} else {
  Step 'Installing Node.js LTS'
  $lts = (Invoke-RestMethod https://nodejs.org/dist/index.json | Where-Object { $_.lts } | Select-Object -First 1).version
  $msi = "$env:TEMP\node-$lts-x64.msi"
  Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-x64.msi" -OutFile $msi -UseBasicParsing
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
}
# Pick up the new PATH in this session (the runner records PATH at config time)
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

# --- App folders and .env --------------------------------------------------
Step "Preparing $InstallDir"
$backend = Join-Path $InstallDir 'app\backend'
$dataDir = Join-Path $InstallDir 'data'
New-Item -ItemType Directory -Force -Path $backend, $dataDir, (Join-Path $InstallDir 'app\frontend\dist') | Out-Null

$envFile = Join-Path $backend '.env'
if (Test-Path $envFile) {
  Write-Host "Keeping existing $envFile"
} else {
  if (-not $QbittorrentPassword) { $QbittorrentPassword = Read-Host 'qBittorrent password' }
  if (-not $TmdbApiKey) { $TmdbApiKey = Read-Host 'TMDB API key' }
  @"
NODE_ENV=production
PORT=$Port
QBITTORRENT_URL=$QbittorrentUrl
QBITTORRENT_USERNAME=$QbittorrentUsername
QBITTORRENT_PASSWORD="$QbittorrentPassword"
TMDB_API_KEY=$TmdbApiKey
DATA_DIR=$dataDir
DOWNLOAD_PATH=$DownloadPath
ALLOWED_ORIGINS=*
"@ | Set-Content -Path $envFile -Encoding ASCII
  # Only Administrators and SYSTEM can read the secrets
  icacls $envFile /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' | Out-Null
}

# --- Startup task that runs the dashboard ----------------------------------
Step "Registering startup task '$TaskName'"
$action = New-ScheduledTaskAction -Execute $node -Argument 'server.js' -WorkingDirectory $backend
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Force | Out-Null

# --- Firewall --------------------------------------------------------------
Step "Opening firewall port $Port"
if (-not (Get-NetFirewallRule -Name "$TaskName-$Port" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name "$TaskName-$Port" -DisplayName "$TaskName (TCP $Port)" -Direction Inbound `
    -Protocol TCP -LocalPort $Port -Action Allow -Profile Private, Domain | Out-Null
}

# --- GitHub Actions runner -------------------------------------------------
$runnerDir = 'C:\actions-runner'
if (Test-Path (Join-Path $runnerDir '.runner')) {
  Step 'GitHub runner already configured'
} else {
  Step 'Installing GitHub Actions runner'
  New-Item -ItemType Directory -Force -Path $runnerDir | Out-Null
  $release = Invoke-RestMethod https://api.github.com/repos/actions/runner/releases/latest
  $asset = $release.assets | Where-Object { $_.name -like 'actions-runner-win-x64-*.zip' } | Select-Object -First 1
  $zip = "$env:TEMP\$($asset.name)"
  Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $runnerDir -Force

  # Runs as SYSTEM so deploys can stop/start the SYSTEM startup task
  Push-Location $runnerDir
  & .\config.cmd --unattended --url $RepoUrl --token $RunnerToken --name $env:COMPUTERNAME `
    --labels dashboard --runasservice --windowslogonaccount 'NT AUTHORITY\SYSTEM' --replace
  Pop-Location
  if ($LASTEXITCODE -ne 0) { throw 'Runner configuration failed' }
}

Step 'Done'
Write-Host "Push to main (or run the Deploy workflow in GitHub Actions) to deploy."
Write-Host "Dashboard will be at http://$((Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress):$Port"
