[CmdletBinding()]
param(
  [string]$Repository,
  [switch]$Force,
  [switch]$CheckOnly,
  [switch]$NoOpenBrowser,
  [switch]$NonInteractive,
  [switch]$LibraryOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$script:UpdaterVersion = "1.0.0"
$script:PackageAssetName = "RoTool-extension.zip"
$script:ChecksumAssetName = "RoTool-extension.zip.sha256"
$script:MaximumArchiveBytes = 12MB
$script:MaximumEntryBytes = 4MB
$script:MaximumExtractedBytes = 12MB

function Get-RoToolPackageFiles {
  param([string]$DefinitionPath = (Join-Path $PSScriptRoot "package-files.json"))

  if (-not (Test-Path -LiteralPath $DefinitionPath -PathType Leaf)) {
    throw "The updater package definition is missing: $DefinitionPath"
  }

  $items = @((Get-Content -Raw -LiteralPath $DefinitionPath | ConvertFrom-Json))
  if ($items.Count -eq 0) {
    throw "The updater package definition is empty."
  }

  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $normalized = foreach ($item in $items) {
    if ($item -isnot [string]) {
      throw "Every managed package path must be text."
    }
    $path = $item.Replace("\", "/").Trim()
    if (
      [string]::IsNullOrWhiteSpace($path) -or
      $path.StartsWith("/") -or
      $path.Contains(":") -or
      $path.Split("/") -contains ".." -or
      $path.Split("/") -contains "." -or
      -not $seen.Add($path)
    ) {
      throw "Unsafe or duplicate managed package path: $item"
    }
    $path
  }
  return @($normalized)
}

function ConvertTo-RoToolVersionParts {
  param([Parameter(Mandatory = $true)][string]$Version)

  if ($Version -notmatch '^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,3}$') {
    throw "Invalid extension version: $Version"
  }
  $parts = @($Version.Split(".") | ForEach-Object {
    $number = [int]$_
    if ($number -gt 65535) {
      throw "Extension version component exceeds 65535: $Version"
    }
    $number
  })
  while ($parts.Count -lt 4) {
    $parts += 0
  }
  return ,$parts
}

function Get-RoToolFileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Compare-RoToolVersion {
  param(
    [Parameter(Mandatory = $true)][string]$Left,
    [Parameter(Mandatory = $true)][string]$Right
  )

  $leftParts = ConvertTo-RoToolVersionParts $Left
  $rightParts = ConvertTo-RoToolVersionParts $Right
  for ($index = 0; $index -lt 4; $index += 1) {
    if ($leftParts[$index] -lt $rightParts[$index]) { return -1 }
    if ($leftParts[$index] -gt $rightParts[$index]) { return 1 }
  }
  return 0
}

function Assert-RoToolRepository {
  param([Parameter(Mandatory = $true)][string]$Value)

  $candidate = $Value.Trim()
  $parts = @($candidate.Split("/"))
  if (
    $parts.Count -ne 2 -or
    $parts[0] -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$' -or
    $parts[1] -notmatch '^[A-Za-z0-9_.-]+$' -or
    $parts[1] -in @(".", "..") -or
    $candidate -eq 'OWNER/REPOSITORY'
  ) {
    throw "GitHub repository must be written as OWNER/REPOSITORY."
  }
  return $candidate
}

function Get-RoToolUpdaterConfiguration {
  param(
    [string]$RequestedRepository,
    [switch]$DoNotPrompt
  )

  $configPath = Join-Path $PSScriptRoot "updater.config.json"
  $config = $null
  if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    try {
      $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    } catch {
      throw "The updater configuration is invalid JSON: $configPath"
    }
  }

  $candidate = $RequestedRepository
  if ([string]::IsNullOrWhiteSpace($candidate) -and $null -ne $config -and $null -ne $config.repository) {
    $candidate = [string]$config.repository
  }
  if ([string]::IsNullOrWhiteSpace($candidate) -or $candidate -eq "OWNER/REPOSITORY") {
    if ($DoNotPrompt) {
      throw "No GitHub repository is configured. Pass -Repository OWNER/REPOSITORY."
    }
    $candidate = Read-Host "Public GitHub repository (OWNER/REPOSITORY)"
  }

  $validatedRepository = Assert-RoToolRepository $candidate
  $browser = "edge"
  if ($null -ne $config -and [string]$config.browser -in @("edge", "chrome")) {
    $browser = [string]$config.browser
  }

  $saved = [ordered]@{
    repository = $validatedRepository
    browser = $browser
  } | ConvertTo-Json
  [IO.File]::WriteAllText($configPath, $saved + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))

  return [PSCustomObject]@{
    Repository = $validatedRepository
    Browser = $browser
    ConfigPath = $configPath
  }
}

function Get-RoToolManifest {
  param([Parameter(Mandatory = $true)][string]$Root)

  $manifestPath = Join-Path $Root "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "RoTool manifest was not found at $manifestPath. Keep the updater folder directly inside the loaded RoTool folder."
  }
  try {
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  } catch {
    throw "RoTool manifest is invalid JSON: $manifestPath"
  }
  if ($manifest.name -ne "RoTool" -or [int]$manifest.manifest_version -ne 3) {
    throw "The selected folder is not a RoTool Manifest V3 installation."
  }
  [void](ConvertTo-RoToolVersionParts ([string]$manifest.version))
  return $manifest
}

function Get-RoToolLatestRelease {
  param([Parameter(Mandatory = $true)][string]$ValidatedRepository)

  $uri = "https://api.github.com/repos/$ValidatedRepository/releases/latest"
  $headers = @{
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent" = "RoTool-Updater/$script:UpdaterVersion"
  }
  try {
    $release = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  } catch {
    throw "GitHub's latest release could not be read. Check the repository name and internet connection. $($_.Exception.Message)"
  }

  if ($release.draft -eq $true -or $release.prerelease -eq $true) {
    throw "GitHub returned a draft or prerelease instead of a stable release."
  }
  $tag = [string]$release.tag_name
  if ($tag -notmatch '^v(.+)$') {
    throw "Latest release tag must use vX.Y.Z. Received: $tag"
  }
  $version = $Matches[1]
  [void](ConvertTo-RoToolVersionParts $version)

  $assets = @($release.assets)
  $packageMatches = @($assets | Where-Object { $_.name -eq $script:PackageAssetName })
  $checksumMatches = @($assets | Where-Object { $_.name -eq $script:ChecksumAssetName })
  if ($packageMatches.Count -ne 1 -or $checksumMatches.Count -ne 1) {
    throw "Release $tag must contain exactly one $script:PackageAssetName and one $script:ChecksumAssetName."
  }
  if ([long]$packageMatches[0].size -le 0 -or [long]$packageMatches[0].size -gt $script:MaximumArchiveBytes) {
    throw "Release package size is unsafe."
  }
  if ([long]$checksumMatches[0].size -le 0 -or [long]$checksumMatches[0].size -gt 4096) {
    throw "Release checksum size is unsafe."
  }

  $expectedPrefix = "https://github.com/$ValidatedRepository/releases/download/"
  foreach ($asset in @($packageMatches[0], $checksumMatches[0])) {
    $downloadUrl = [string]$asset.browser_download_url
    if (-not $downloadUrl.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Release asset download URL is not under the configured GitHub repository."
    }
  }

  return [PSCustomObject]@{
    Tag = $tag
    Version = $version
    Package = $packageMatches[0]
    Checksum = $checksumMatches[0]
    HtmlUrl = [string]$release.html_url
  }
}

function Invoke-RoToolDownload {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $oldProgress = $ProgressPreference
  $ProgressPreference = "SilentlyContinue"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination -Headers @{
      Accept = "application/octet-stream"
      "User-Agent" = "RoTool-Updater/$script:UpdaterVersion"
    }
  } finally {
    $ProgressPreference = $oldProgress
  }
}

function Assert-RoToolChecksum {
  param(
    [Parameter(Mandatory = $true)][string]$PackagePath,
    [Parameter(Mandatory = $true)][string]$ChecksumPath
  )

  $text = Get-Content -Raw -LiteralPath $ChecksumPath
  $escapedName = [regex]::Escape($script:PackageAssetName)
  $match = [regex]::Match($text, "(?im)^([0-9a-f]{64})[ \t]+\*?$escapedName[ \t]*$")
  if (-not $match.Success) {
    throw "The release checksum file has an unexpected format."
  }
  $expected = $match.Groups[1].Value.ToUpperInvariant()
  $actual = (Get-RoToolFileSha256 $PackagePath).ToUpperInvariant()
  if ($actual -ne $expected) {
    throw "Downloaded package checksum does not match the published SHA-256."
  }
  return $actual
}

function Expand-RoToolValidatedPackage {
  param(
    [Parameter(Mandatory = $true)][string]$PackagePath,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$ExpectedVersion,
    [string[]]$ManagedFiles = (Get-RoToolPackageFiles)
  )

  if ((Get-Item -LiteralPath $PackagePath).Length -gt $script:MaximumArchiveBytes) {
    throw "Downloaded package exceeds the updater size limit."
  }
  if (Test-Path -LiteralPath $Destination) {
    throw "The staging destination already exists: $Destination"
  }
  [void](New-Item -ItemType Directory -Path $Destination)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $allowed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $ManagedFiles) { [void]$allowed.Add($file) }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $archive = [IO.Compression.ZipFile]::OpenRead($PackagePath)
  try {
    $total = 0L
    foreach ($entry in $archive.Entries) {
      $path = $entry.FullName.Replace("\", "/")
      if (
        [string]::IsNullOrWhiteSpace($path) -or
        $path.EndsWith("/") -or
        $path.StartsWith("/") -or
        $path.Contains(":") -or
        $path.Split("/") -contains ".." -or
        $path.Split("/") -contains "." -or
        -not $allowed.Contains($path) -or
        -not $seen.Add($path)
      ) {
        throw "Release contains an unexpected, unsafe, or duplicate path: $path"
      }
      $attributeBits = [BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$entry.ExternalAttributes), 0)
      $unixType = (($attributeBits -shr 16) -band 0xF000)
      if ($unixType -eq 0xA000) {
        throw "Release contains a symbolic link: $path"
      }
      if ($entry.Length -lt 0 -or $entry.Length -gt $script:MaximumEntryBytes) {
        throw "Release entry exceeds the updater size limit: $path"
      }
      $total += $entry.Length
      if ($total -gt $script:MaximumExtractedBytes) {
        throw "Release extracted size exceeds the updater limit."
      }

      $target = Join-Path $Destination ($path.Replace("/", [IO.Path]::DirectorySeparatorChar))
      $parent = Split-Path -Parent $target
      if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $parent -Force)
      }
      $inputStream = $entry.Open()
      $outputStream = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
      try {
        $inputStream.CopyTo($outputStream)
      } finally {
        $outputStream.Dispose()
        $inputStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
  }

  if ($seen.Count -ne $allowed.Count) {
    $missing = @($ManagedFiles | Where-Object { -not $seen.Contains($_) })
    throw "Release is missing managed files: $($missing -join ', ')"
  }
  $manifest = Get-RoToolManifest $Destination
  if ([string]$manifest.version -ne $ExpectedVersion) {
    throw "Release tag version $ExpectedVersion does not match embedded manifest version $($manifest.version)."
  }
  return $manifest
}

function Write-RoToolJournal {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Value
  )

  $temporary = "$Path.tmp"
  $json = $Value | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText($temporary, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Restore-RoToolBackup {
  param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [string[]]$ManagedFiles = (Get-RoToolPackageFiles)
  )

  foreach ($relative in $ManagedFiles) {
    $backup = Join-Path $BackupRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
    $destination = Join-Path $InstallRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
      throw "Rollback backup is incomplete: $relative"
    }
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
      [void](New-Item -ItemType Directory -Path $parent -Force)
    }
    Copy-Item -LiteralPath $backup -Destination $destination -Force
  }
}

function Repair-RoToolInterruptedUpdate {
  param(
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [string[]]$ManagedFiles = (Get-RoToolPackageFiles)
  )

  $journalPath = Join-Path $StateRoot "journal.json"
  if (-not (Test-Path -LiteralPath $journalPath -PathType Leaf)) { return }
  try {
    $journal = Get-Content -Raw -LiteralPath $journalPath | ConvertFrom-Json
  } catch {
    throw "A prior updater journal is unreadable: $journalPath"
  }
  if ([string]$journal.status -ne "applying") { return }

  Write-Host "Recovering the previous interrupted RoTool update..." -ForegroundColor Yellow
  Restore-RoToolBackup -InstallRoot ([string]$journal.installRoot) -BackupRoot ([string]$journal.backupRoot) -ManagedFiles $ManagedFiles
  $journal.status = "recovered"
  Write-RoToolJournal -Path $journalPath -Value $journal
}

function Install-RoToolValidatedPackage {
  param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$StagingRoot,
    [Parameter(Mandatory = $true)][string]$OldVersion,
    [Parameter(Mandatory = $true)][string]$NewVersion,
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [string[]]$ManagedFiles = (Get-RoToolPackageFiles)
  )

  [void](Get-RoToolManifest $InstallRoot)
  if (-not (Test-Path -LiteralPath $StateRoot -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $StateRoot -Force)
  }
  Repair-RoToolInterruptedUpdate -StateRoot $StateRoot -ManagedFiles $ManagedFiles

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupRoot = Join-Path $StateRoot "backups\$stamp-v$OldVersion"
  [void](New-Item -ItemType Directory -Path $backupRoot -Force)
  foreach ($relative in $ManagedFiles) {
    $source = Join-Path $InstallRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Current RoTool installation is incomplete; refusing to update: $relative"
    }
    $backup = Join-Path $backupRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
    $parent = Split-Path -Parent $backup
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
      [void](New-Item -ItemType Directory -Path $parent -Force)
    }
    Copy-Item -LiteralPath $source -Destination $backup
  }

  $journalPath = Join-Path $StateRoot "journal.json"
  $journal = [PSCustomObject]@{
    status = "applying"
    installRoot = $InstallRoot
    backupRoot = $backupRoot
    oldVersion = $OldVersion
    newVersion = $NewVersion
    startedAt = [DateTime]::UtcNow.ToString("o")
    completedAt = ""
    failure = ""
  }
  Write-RoToolJournal -Path $journalPath -Value $journal

  $temporaryFiles = New-Object 'System.Collections.Generic.List[string]'
  try {
    $applicationOrder = @($ManagedFiles | Where-Object { $_ -ne "manifest.json" }) + @("manifest.json")
    foreach ($relative in $applicationOrder) {
      $source = Join-Path $StagingRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
      $destination = Join-Path $InstallRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
      $temporary = "$destination.rotool-new-$([Guid]::NewGuid().ToString('N'))"
      $temporaryFiles.Add($temporary)
      Copy-Item -LiteralPath $source -Destination $temporary
      if ((Get-RoToolFileSha256 $source) -ne (Get-RoToolFileSha256 $temporary)) {
        throw "Staged copy verification failed: $relative"
      }
      if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $replacementBackup = "$destination.rotool-replaced-$([Guid]::NewGuid().ToString('N'))"
        try {
          [IO.File]::Replace($temporary, $destination, $replacementBackup, $true)
        } finally {
          if (Test-Path -LiteralPath $replacementBackup -PathType Leaf) {
            Remove-Item -LiteralPath $replacementBackup -Force
          }
        }
      } else {
        [IO.File]::Move($temporary, $destination)
      }
      [void]$temporaryFiles.Remove($temporary)
    }

    $installedManifest = Get-RoToolManifest $InstallRoot
    if ([string]$installedManifest.version -ne $NewVersion) {
      throw "Post-update manifest version verification failed."
    }
    foreach ($relative in $ManagedFiles) {
      $source = Join-Path $StagingRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
      $destination = Join-Path $InstallRoot ($relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
      if ((Get-RoToolFileSha256 $source) -ne (Get-RoToolFileSha256 $destination)) {
        throw "Post-update file verification failed: $relative"
      }
    }
  } catch {
    $failure = $_
    foreach ($temporaryFile in $temporaryFiles) {
      if (Test-Path -LiteralPath $temporaryFile -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryFile -Force
      }
    }
    Restore-RoToolBackup -InstallRoot $InstallRoot -BackupRoot $backupRoot -ManagedFiles $ManagedFiles
    $journal.status = "rolledBack"
    $journal.failure = $failure.Exception.Message
    Write-RoToolJournal -Path $journalPath -Value $journal
    throw "RoTool update failed and the previous files were restored. $($failure.Exception.Message)"
  }

  $journal.status = "completed"
  $journal.completedAt = [DateTime]::UtcNow.ToString("o")
  Write-RoToolJournal -Path $journalPath -Value $journal
  return $backupRoot
}

function Open-RoToolExtensionsPage {
  param([ValidateSet("edge", "chrome")][string]$Browser = "edge")

  $executable = if ($Browser -eq "chrome") { "chrome.exe" } else { "msedge.exe" }
  $page = if ($Browser -eq "chrome") { "chrome://extensions" } else { "edge://extensions" }
  try {
    Start-Process -FilePath $executable -ArgumentList $page
  } catch {
    Write-Host "Open $page manually." -ForegroundColor Yellow
  }
}

function Invoke-RoToolUpdater {
  param(
    [string]$RequestedRepository,
    [switch]$ReinstallCurrent,
    [switch]$OnlyCheck,
    [switch]$DoNotOpenBrowser,
    [switch]$DoNotPrompt
  )

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $installRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
  $stateBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { [IO.Path]::GetTempPath() } else { $env:LOCALAPPDATA }
  $stateRoot = Join-Path $stateBase "RoToolUpdater"
  if (-not (Test-Path -LiteralPath $stateRoot -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $stateRoot -Force)
  }
  Repair-RoToolInterruptedUpdate -StateRoot $stateRoot
  $currentManifest = Get-RoToolManifest $installRoot
  $configuration = Get-RoToolUpdaterConfiguration -RequestedRepository $RequestedRepository -DoNotPrompt:$DoNotPrompt

  Write-Host "Checking $($configuration.Repository) for a RoTool update..." -ForegroundColor Cyan
  $release = Get-RoToolLatestRelease $configuration.Repository
  $comparison = Compare-RoToolVersion $release.Version ([string]$currentManifest.version)
  if ($comparison -lt 0) {
    throw "Latest GitHub release $($release.Version) is older than installed RoTool $($currentManifest.version)."
  }
  if ($comparison -eq 0 -and -not $ReinstallCurrent) {
    Write-Host "RoTool $($currentManifest.version) is already current." -ForegroundColor Green
    return
  }
  if ($OnlyCheck) {
    Write-Host "RoTool $($release.Version) is available. Installed: $($currentManifest.version)." -ForegroundColor Green
    return
  }

  $workRoot = Join-Path ([IO.Path]::GetTempPath()) "RoToolUpdater-$([Guid]::NewGuid().ToString('N'))"
  [void](New-Item -ItemType Directory -Path $workRoot)
  try {
    $packagePath = Join-Path $workRoot $script:PackageAssetName
    $checksumPath = Join-Path $workRoot $script:ChecksumAssetName
    Write-Host "Downloading RoTool $($release.Version)..."
    Invoke-RoToolDownload -Uri ([string]$release.Package.browser_download_url) -Destination $packagePath
    Invoke-RoToolDownload -Uri ([string]$release.Checksum.browser_download_url) -Destination $checksumPath
    if ((Get-Item -LiteralPath $packagePath).Length -ne [long]$release.Package.size) {
      throw "Downloaded package size does not match GitHub's release metadata."
    }
    if ((Get-Item -LiteralPath $checksumPath).Length -ne [long]$release.Checksum.size) {
      throw "Downloaded checksum size does not match GitHub's release metadata."
    }
    [void](Assert-RoToolChecksum -PackagePath $packagePath -ChecksumPath $checksumPath)

    $stagingRoot = Join-Path $workRoot "validated"
    [void](Expand-RoToolValidatedPackage -PackagePath $packagePath -Destination $stagingRoot -ExpectedVersion $release.Version)
    $backup = Install-RoToolValidatedPackage -InstallRoot $installRoot -StagingRoot $stagingRoot -OldVersion ([string]$currentManifest.version) -NewVersion $release.Version -StateRoot $stateRoot

    Write-Host "RoTool updated: $($currentManifest.version) -> $($release.Version)" -ForegroundColor Green
    Write-Host "Rollback backup: $backup"
    Write-Host "Press Reload on the SAME RoTool card, then refresh Roblox." -ForegroundColor Cyan
    if (-not $DoNotOpenBrowser) {
      Open-RoToolExtensionsPage $configuration.Browser
    }
  } finally {
    if (Test-Path -LiteralPath $workRoot -PathType Container) {
      Remove-Item -LiteralPath $workRoot -Recurse -Force
    }
  }
}

if (-not $LibraryOnly) {
  try {
    Invoke-RoToolUpdater -RequestedRepository $Repository -ReinstallCurrent:$Force -OnlyCheck:$CheckOnly -DoNotOpenBrowser:$NoOpenBrowser -DoNotPrompt:$NonInteractive
    exit 0
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}
