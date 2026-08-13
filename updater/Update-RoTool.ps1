[CmdletBinding()]
param(
  [string]$Repository,
  [switch]$Force,
  [switch]$CheckOnly,
  [switch]$NoOpenBrowser,
  [switch]$NonInteractive,
  [switch]$SkipUpdaterRefresh,
  [switch]$LibraryOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$script:UpdaterVersion = "1.2.0"
$script:PackageAssetName = "RoTool-extension.zip"
$script:ChecksumAssetName = "RoTool-extension.zip.sha256"
$script:UpdaterPackageAssetName = "RoTool-updater.zip"
$script:UpdaterChecksumAssetName = "RoTool-updater.zip.sha256"
$script:UpdaterCoreFiles = @("Update-RoTool.ps1", "README.md", "package-files.json")
$script:MaximumArchiveBytes = 12MB
$script:MaximumEntryBytes = 4MB
$script:MaximumExtractedBytes = 12MB
$script:MaximumUpdaterArchiveBytes = 4MB

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
  # Setup packages before configuration schema 2 wrote "edge" even though the
  # user had never selected it. Migrate those generated files to automatic
  # detection; schema-2 edge/chrome values are deliberate user overrides.
  $browser = "auto"
  $configVersionProperty = if ($null -ne $config) { $config.PSObject.Properties["configVersion"] } else { $null }
  $browserProperty = if ($null -ne $config) { $config.PSObject.Properties["browser"] } else { $null }
  if (
    $null -ne $configVersionProperty -and
    [int]$configVersionProperty.Value -eq 2 -and
    $null -ne $browserProperty -and
    [string]$browserProperty.Value -in @("auto", "edge", "chrome")
  ) {
    $browser = [string]$browserProperty.Value
  }

  $saved = [ordered]@{
    configVersion = 2
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
  $updaterPackageMatches = @($assets | Where-Object { $_.name -eq $script:UpdaterPackageAssetName })
  $updaterChecksumMatches = @($assets | Where-Object { $_.name -eq $script:UpdaterChecksumAssetName })
  if ($packageMatches.Count -ne 1 -or $checksumMatches.Count -ne 1) {
    throw "Release $tag must contain exactly one $script:PackageAssetName and one $script:ChecksumAssetName."
  }
  if (
    $updaterPackageMatches.Count -gt 1 -or
    $updaterChecksumMatches.Count -gt 1 -or
    $updaterPackageMatches.Count -ne $updaterChecksumMatches.Count
  ) {
    throw "Release $tag must contain either no updater assets or exactly one $script:UpdaterPackageAssetName and one $script:UpdaterChecksumAssetName."
  }
  if ([long]$packageMatches[0].size -le 0 -or [long]$packageMatches[0].size -gt $script:MaximumArchiveBytes) {
    throw "Release package size is unsafe."
  }
  if ([long]$checksumMatches[0].size -le 0 -or [long]$checksumMatches[0].size -gt 4096) {
    throw "Release checksum size is unsafe."
  }
  if ($updaterPackageMatches.Count -eq 1) {
    if ([long]$updaterPackageMatches[0].size -le 0 -or [long]$updaterPackageMatches[0].size -gt $script:MaximumUpdaterArchiveBytes) {
      throw "Release updater package size is unsafe."
    }
    if ([long]$updaterChecksumMatches[0].size -le 0 -or [long]$updaterChecksumMatches[0].size -gt 4096) {
      throw "Release updater checksum size is unsafe."
    }
  }

  $expectedPrefix = "https://github.com/$ValidatedRepository/releases/download/"
  $validatedAssets = @($packageMatches[0], $checksumMatches[0])
  if ($updaterPackageMatches.Count -eq 1) {
    $validatedAssets += @($updaterPackageMatches[0], $updaterChecksumMatches[0])
  }
  foreach ($asset in $validatedAssets) {
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
    UpdaterPackage = if ($updaterPackageMatches.Count -eq 1) { $updaterPackageMatches[0] } else { $null }
    UpdaterChecksum = if ($updaterChecksumMatches.Count -eq 1) { $updaterChecksumMatches[0] } else { $null }
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
    [Parameter(Mandatory = $true)][string]$ChecksumPath,
    [string]$AssetName = $script:PackageAssetName
  )

  $text = Get-Content -Raw -LiteralPath $ChecksumPath
  $escapedName = [regex]::Escape($AssetName)
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

function Get-RoToolUpdaterVersionFromFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $parseErrors = $null
  $tokens = $null
  [void][Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$parseErrors)
  if ($parseErrors.Count -ne 0) {
    throw "Updater package contains an invalid PowerShell script."
  }
  $source = Get-Content -Raw -LiteralPath $Path
  $matches = @([regex]::Matches($source, '(?m)^\$script:UpdaterVersion\s*=\s*"([0-9]+(?:\.[0-9]+){0,3})"\s*$'))
  if ($matches.Count -ne 1) {
    throw "Updater package does not declare exactly one updater version."
  }
  $version = $matches[0].Groups[1].Value
  [void](ConvertTo-RoToolVersionParts $version)
  return $version
}

function Expand-RoToolValidatedUpdaterPackage {
  param(
    [Parameter(Mandatory = $true)][string]$PackagePath,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$CoreFiles = $script:UpdaterCoreFiles
  )

  if ((Get-Item -LiteralPath $PackagePath).Length -gt $script:MaximumUpdaterArchiveBytes) {
    throw "Downloaded updater package exceeds the updater size limit."
  }
  if (Test-Path -LiteralPath $Destination) {
    throw "The updater staging destination already exists: $Destination"
  }
  [void](New-Item -ItemType Directory -Path $Destination)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $allowed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in $CoreFiles) { [void]$allowed.Add($file) }
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
        throw "Updater release contains an unexpected, unsafe, or duplicate path: $path"
      }
      $attributeBits = [BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$entry.ExternalAttributes), 0)
      if (((($attributeBits -shr 16) -band 0xF000)) -eq 0xA000) {
        throw "Updater release contains a symbolic link: $path"
      }
      if ($entry.Length -lt 0 -or $entry.Length -gt $script:MaximumEntryBytes) {
        throw "Updater release entry exceeds the updater size limit: $path"
      }
      $total += $entry.Length
      if ($total -gt $script:MaximumUpdaterArchiveBytes) {
        throw "Updater release extracted size exceeds the updater limit."
      }

      $target = Join-Path $Destination $path
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
    $missing = @($CoreFiles | Where-Object { -not $seen.Contains($_) })
    throw "Updater release is missing core files: $($missing -join ', ')"
  }
  $updaterVersion = Get-RoToolUpdaterVersionFromFile (Join-Path $Destination "Update-RoTool.ps1")
  return $updaterVersion
}

function Restore-RoToolUpdaterBackup {
  param(
    [Parameter(Mandatory = $true)][string]$UpdaterRoot,
    [Parameter(Mandatory = $true)][string]$BackupRoot,
    [string[]]$CoreFiles = $script:UpdaterCoreFiles
  )

  foreach ($relative in $CoreFiles) {
    $backup = Join-Path $BackupRoot $relative
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
      throw "Updater rollback backup is incomplete: $relative"
    }
    Copy-Item -LiteralPath $backup -Destination (Join-Path $UpdaterRoot $relative) -Force
  }
}

function Repair-RoToolInterruptedUpdaterUpdate {
  param(
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [string]$ExpectedUpdaterRoot = "",
    [string[]]$CoreFiles = $script:UpdaterCoreFiles
  )

  $journalPath = Join-Path $StateRoot "updater-journal.json"
  if (-not (Test-Path -LiteralPath $journalPath -PathType Leaf)) { return }
  try {
    $journal = Get-Content -Raw -LiteralPath $journalPath | ConvertFrom-Json
  } catch {
    throw "A prior updater-core journal is unreadable: $journalPath"
  }
  if ([string]$journal.status -ne "applying") { return }
  $journalUpdaterRoot = [IO.Path]::GetFullPath([string]$journal.updaterRoot).TrimEnd('\')
  $journalBackupRoot = [IO.Path]::GetFullPath([string]$journal.backupRoot).TrimEnd('\')
  $allowedBackupRoot = [IO.Path]::GetFullPath((Join-Path $StateRoot "updater-backups")).TrimEnd('\') + '\'
  if (
    (-not [string]::IsNullOrWhiteSpace($ExpectedUpdaterRoot) -and
      $journalUpdaterRoot -ne [IO.Path]::GetFullPath($ExpectedUpdaterRoot).TrimEnd('\')) -or
    -not ($journalBackupRoot + '\').StartsWith($allowedBackupRoot, [StringComparison]::OrdinalIgnoreCase)
  ) {
    throw "A prior updater-core journal contains paths outside this RoTool installation."
  }
  Write-Host "Recovering the previous interrupted updater refresh..." -ForegroundColor Yellow
  Restore-RoToolUpdaterBackup -UpdaterRoot $journalUpdaterRoot -BackupRoot $journalBackupRoot -CoreFiles $CoreFiles
  $journal.status = "recovered"
  Write-RoToolJournal -Path $journalPath -Value $journal
}

function Install-RoToolUpdaterCore {
  param(
    [Parameter(Mandatory = $true)][string]$UpdaterRoot,
    [Parameter(Mandatory = $true)][string]$StagingRoot,
    [Parameter(Mandatory = $true)][string]$StateRoot,
    [Parameter(Mandatory = $true)][string]$RunningVersion,
    [string[]]$CoreFiles = $script:UpdaterCoreFiles
  )

  Repair-RoToolInterruptedUpdaterUpdate -StateRoot $StateRoot -ExpectedUpdaterRoot $UpdaterRoot -CoreFiles $CoreFiles
  $stagedVersion = Get-RoToolUpdaterVersionFromFile (Join-Path $StagingRoot "Update-RoTool.ps1")
  $versionComparison = Compare-RoToolVersion $stagedVersion $RunningVersion
  if ($versionComparison -lt 0) {
    throw "Release updater $stagedVersion is older than running updater $RunningVersion."
  }
  $changedFiles = @($CoreFiles | Where-Object {
    $installed = Join-Path $UpdaterRoot $_
    $staged = Join-Path $StagingRoot $_
    -not (Test-Path -LiteralPath $installed -PathType Leaf) -or
      (Get-RoToolFileSha256 $installed) -ne (Get-RoToolFileSha256 $staged)
  })
  if ($changedFiles.Count -eq 0) {
    return [PSCustomObject]@{ Updated = $false; Version = $stagedVersion; BackupRoot = "" }
  }
  if ($versionComparison -eq 0) {
    throw "Release updater core differs without a newer updater version."
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupRoot = Join-Path $StateRoot "updater-backups\$stamp-v$RunningVersion"
  [void](New-Item -ItemType Directory -Path $backupRoot -Force)
  foreach ($relative in $CoreFiles) {
    $installed = Join-Path $UpdaterRoot $relative
    if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) {
      throw "Current updater installation is incomplete: $relative"
    }
    Copy-Item -LiteralPath $installed -Destination (Join-Path $backupRoot $relative)
  }

  $journalPath = Join-Path $StateRoot "updater-journal.json"
  $journal = [PSCustomObject]@{
    status = "applying"
    updaterRoot = $UpdaterRoot
    backupRoot = $backupRoot
    oldVersion = $RunningVersion
    newVersion = $stagedVersion
    startedAt = [DateTime]::UtcNow.ToString("o")
    completedAt = ""
    failure = ""
  }
  Write-RoToolJournal -Path $journalPath -Value $journal
  $temporaryFiles = New-Object 'System.Collections.Generic.List[string]'
  try {
    $applicationOrder = @($CoreFiles | Where-Object { $_ -ne "Update-RoTool.ps1" }) + @("Update-RoTool.ps1")
    foreach ($relative in $applicationOrder) {
      $source = Join-Path $StagingRoot $relative
      $destination = Join-Path $UpdaterRoot $relative
      $temporary = "$destination.rotool-new-$([Guid]::NewGuid().ToString('N'))"
      $temporaryFiles.Add($temporary)
      Copy-Item -LiteralPath $source -Destination $temporary
      if ((Get-RoToolFileSha256 $source) -ne (Get-RoToolFileSha256 $temporary)) {
        throw "Updater staged copy verification failed: $relative"
      }
      $replacementBackup = "$destination.rotool-replaced-$([Guid]::NewGuid().ToString('N'))"
      try {
        [IO.File]::Replace($temporary, $destination, $replacementBackup, $true)
      } finally {
        if (Test-Path -LiteralPath $replacementBackup -PathType Leaf) {
          Remove-Item -LiteralPath $replacementBackup -Force
        }
      }
      [void]$temporaryFiles.Remove($temporary)
    }
    foreach ($relative in $CoreFiles) {
      if ((Get-RoToolFileSha256 (Join-Path $StagingRoot $relative)) -ne (Get-RoToolFileSha256 (Join-Path $UpdaterRoot $relative))) {
        throw "Updater post-update verification failed: $relative"
      }
    }
  } catch {
    $failure = $_
    foreach ($temporaryFile in $temporaryFiles) {
      if (Test-Path -LiteralPath $temporaryFile -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryFile -Force
      }
    }
    Restore-RoToolUpdaterBackup -UpdaterRoot $UpdaterRoot -BackupRoot $backupRoot -CoreFiles $CoreFiles
    $journal.status = "rolledBack"
    $journal.failure = $failure.Exception.Message
    Write-RoToolJournal -Path $journalPath -Value $journal
    throw "Updater refresh failed and its previous files were restored. $($failure.Exception.Message)"
  }
  $journal.status = "completed"
  $journal.completedAt = [DateTime]::UtcNow.ToString("o")
  Write-RoToolJournal -Path $journalPath -Value $journal
  return [PSCustomObject]@{ Updated = $true; Version = $stagedVersion; BackupRoot = $backupRoot }
}

function Update-RoToolUpdaterCoreFromRelease {
  param(
    [Parameter(Mandatory = $true)]$Release,
    [Parameter(Mandatory = $true)][string]$WorkRoot,
    [Parameter(Mandatory = $true)][string]$StateRoot
  )

  if ($null -eq $Release.UpdaterPackage -or $null -eq $Release.UpdaterChecksum) {
    return [PSCustomObject]@{ Updated = $false; Version = $script:UpdaterVersion; BackupRoot = "" }
  }
  $packagePath = Join-Path $WorkRoot $script:UpdaterPackageAssetName
  $checksumPath = Join-Path $WorkRoot $script:UpdaterChecksumAssetName
  Invoke-RoToolDownload -Uri ([string]$Release.UpdaterPackage.browser_download_url) -Destination $packagePath
  Invoke-RoToolDownload -Uri ([string]$Release.UpdaterChecksum.browser_download_url) -Destination $checksumPath
  if ((Get-Item -LiteralPath $packagePath).Length -ne [long]$Release.UpdaterPackage.size) {
    throw "Downloaded updater package size does not match GitHub's release metadata."
  }
  if ((Get-Item -LiteralPath $checksumPath).Length -ne [long]$Release.UpdaterChecksum.size) {
    throw "Downloaded updater checksum size does not match GitHub's release metadata."
  }
  [void](Assert-RoToolChecksum -PackagePath $packagePath -ChecksumPath $checksumPath -AssetName $script:UpdaterPackageAssetName)
  $stagingRoot = Join-Path $WorkRoot "validated-updater"
  [void](Expand-RoToolValidatedUpdaterPackage -PackagePath $packagePath -Destination $stagingRoot)
  $result = Install-RoToolUpdaterCore -UpdaterRoot $PSScriptRoot -StagingRoot $stagingRoot -StateRoot $StateRoot -RunningVersion $script:UpdaterVersion
  return $result
}

function Restart-RoToolUpdater {
  param(
    [switch]$ReinstallCurrent,
    [switch]$DoNotOpenBrowser,
    [switch]$DoNotPrompt
  )

  $arguments = @(
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $PSScriptRoot "Update-RoTool.ps1"),
    "-SkipUpdaterRefresh"
  )
  if ($ReinstallCurrent) { $arguments += "-Force" }
  if ($DoNotOpenBrowser) { $arguments += "-NoOpenBrowser" }
  if ($DoNotPrompt) { $arguments += "-NonInteractive" }
  & powershell.exe @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "The refreshed updater exited with code $LASTEXITCODE."
  }
}

function ConvertTo-RoToolCanonicalPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  try {
    return [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  } catch {
    return ""
  }
}

function Read-RoToolBrowserJson {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $stream = $null
  $reader = $null
  try {
    # Chromium may be writing profile metadata while the updater is running.
    $stream = New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $reader = New-Object IO.StreamReader($stream, (New-Object Text.UTF8Encoding($false, $true)), $true)
    return $reader.ReadToEnd() | ConvertFrom-Json
  } catch {
    return $null
  } finally {
    if ($null -ne $reader) { $reader.Dispose() }
    elseif ($null -ne $stream) { $stream.Dispose() }
  }
}

function Test-RoToolBrowserRegistration {
  param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$UserDataRoot
  )

  if (-not (Test-Path -LiteralPath $UserDataRoot -PathType Container)) { return $false }
  $profileNames = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  [void]$profileNames.Add("Default")
  $localState = Read-RoToolBrowserJson (Join-Path $UserDataRoot "Local State")
  $profileProperty = if ($null -ne $localState) { $localState.PSObject.Properties["profile"] } else { $null }
  $infoCacheProperty = if ($null -ne $profileProperty -and $null -ne $profileProperty.Value) {
    $profileProperty.Value.PSObject.Properties["info_cache"]
  } else {
    $null
  }
  if ($null -ne $infoCacheProperty -and $null -ne $infoCacheProperty.Value) {
    foreach ($property in $infoCacheProperty.Value.PSObject.Properties) {
      if ($property.Name -match '^(Default|Profile [0-9]+)$') { [void]$profileNames.Add($property.Name) }
    }
  }
  foreach ($directory in @(Get-ChildItem -LiteralPath $UserDataRoot -Directory -ErrorAction SilentlyContinue)) {
    if ($directory.Name -match '^(Default|Profile [0-9]+)$') { [void]$profileNames.Add($directory.Name) }
  }

  $expected = ConvertTo-RoToolCanonicalPath $InstallRoot
  if ([string]::IsNullOrWhiteSpace($expected)) { return $false }
  foreach ($profileName in $profileNames) {
    foreach ($fileName in @("Preferences", "Secure Preferences")) {
      $preferences = Read-RoToolBrowserJson (Join-Path (Join-Path $UserDataRoot $profileName) $fileName)
      if ($null -eq $preferences) { continue }
      $extensionsProperty = $preferences.PSObject.Properties["extensions"]
      if ($null -eq $extensionsProperty -or $null -eq $extensionsProperty.Value) { continue }
      $settingsProperty = $extensionsProperty.Value.PSObject.Properties["settings"]
      if ($null -eq $settingsProperty -or $null -eq $settingsProperty.Value) { continue }
      foreach ($settingProperty in $settingsProperty.Value.PSObject.Properties) {
        $setting = $settingProperty.Value
        if ($null -eq $setting) { continue }
        $pathProperty = $setting.PSObject.Properties["path"]
        if ($null -eq $pathProperty -or $null -eq $pathProperty.Value) { continue }
        $candidate = ConvertTo-RoToolCanonicalPath ([string]$pathProperty.Value)
        if ($candidate -and [string]::Equals($candidate, $expected, [StringComparison]::OrdinalIgnoreCase)) {
          return $true
        }
      }
    }
  }
  return $false
}

function Get-RoToolInstalledBrowserExecutable {
  param([Parameter(Mandatory = $true)][ValidateSet("edge", "chrome")][string]$Browser)

  $name = if ($Browser -eq "chrome") { "chrome.exe" } else { "msedge.exe" }
  $relative = if ($Browser -eq "chrome") { "Google\Chrome\Application\chrome.exe" } else { "Microsoft\Edge\Application\msedge.exe" }
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $candidates += (Join-Path $env:LOCALAPPDATA $relative) }
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) { $candidates += (Join-Path $env:ProgramFiles $relative) }
  $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) { $candidates += (Join-Path $programFilesX86 $relative) }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if ($null -ne $command) { return [string]$command.Source }
  return ""
}

function Get-RoToolDefaultBrowser {
  try {
    $choice = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice" -Name ProgId -ErrorAction Stop
    $program = [string]$choice.ProgId
    if ($program -match 'Chrome') { return "chrome" }
    if ($program -match 'MSEdge') { return "edge" }
  } catch {}
  return ""
}

function Resolve-RoToolBrowser {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("auto", "edge", "chrome")][string]$Browser,
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [string]$ChromeUserDataRoot,
    [string]$EdgeUserDataRoot,
    [string[]]$RunningBrowserNames
  )

  if ($Browser -ne "auto") { return $Browser }
  if ([string]::IsNullOrWhiteSpace($ChromeUserDataRoot)) { $ChromeUserDataRoot = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data" }
  if ([string]::IsNullOrWhiteSpace($EdgeUserDataRoot)) { $EdgeUserDataRoot = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data" }
  $chromeMatch = Test-RoToolBrowserRegistration -InstallRoot $InstallRoot -UserDataRoot $ChromeUserDataRoot
  $edgeMatch = Test-RoToolBrowserRegistration -InstallRoot $InstallRoot -UserDataRoot $EdgeUserDataRoot
  if ($chromeMatch -and -not $edgeMatch) { return "chrome" }
  if ($edgeMatch -and -not $chromeMatch) { return "edge" }

  if (-not $PSBoundParameters.ContainsKey("RunningBrowserNames")) {
    $RunningBrowserNames = @(Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessName })
  }
  $chromeRunning = @($RunningBrowserNames | Where-Object { $_ -in @("chrome", "chrome.exe") }).Count -gt 0
  $edgeRunning = @($RunningBrowserNames | Where-Object { $_ -in @("msedge", "msedge.exe", "edge", "edge.exe") }).Count -gt 0
  if ($chromeRunning -and -not $edgeRunning) { return "chrome" }
  if ($edgeRunning -and -not $chromeRunning) { return "edge" }
  $defaultBrowser = Get-RoToolDefaultBrowser
  if ($defaultBrowser) { return $defaultBrowser }
  if (Get-RoToolInstalledBrowserExecutable "chrome") { return "chrome" }
  return "edge"
}

function Initialize-RoToolNativeWindow {
  if ("RoTool.NativeWindow" -as [type]) { return }

  [void](Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace RoTool {
  public static class NativeWindow {
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
}
"@)
}

function Test-RoToolForegroundBrowser {
  param([Parameter(Mandatory = $true)][ValidateSet("chrome", "msedge")][string]$ProcessName)

  Initialize-RoToolNativeWindow
  $foregroundWindow = [RoTool.NativeWindow]::GetForegroundWindow()
  if ($foregroundWindow -eq [IntPtr]::Zero) { return $false }

  [uint32]$foregroundProcessId = 0
  [void][RoTool.NativeWindow]::GetWindowThreadProcessId($foregroundWindow, [ref]$foregroundProcessId)
  if ($foregroundProcessId -eq 0) { return $false }
  try {
    $foregroundProcess = Get-Process -Id ([int]$foregroundProcessId) -ErrorAction Stop
    return [string]::Equals($foregroundProcess.ProcessName, $ProcessName, [StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function Focus-RoToolBrowserWindow {
  param([Parameter(Mandatory = $true)][ValidateSet("chrome", "msedge")][string]$ProcessName)

  Initialize-RoToolNativeWindow
  for ($attempt = 0; $attempt -lt 15; $attempt += 1) {
    $window = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
      Sort-Object StartTime -Descending |
      Select-Object -First 1
    if ($null -ne $window) {
      [void][RoTool.NativeWindow]::ShowWindowAsync($window.MainWindowHandle, 9)
      [void][RoTool.NativeWindow]::SetForegroundWindow($window.MainWindowHandle)
      try { [void](New-Object -ComObject WScript.Shell).AppActivate($window.Id) } catch {}
      Start-Sleep -Milliseconds 50
      if (Test-RoToolForegroundBrowser -ProcessName $ProcessName) { return $true }
    }
    Start-Sleep -Milliseconds 200
  }
  return $false
}

function Set-RoToolBrowserInternalPage {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("chrome", "msedge")][string]$ProcessName,
    [Parameter(Mandatory = $true)][string]$Page
  )

  $expectedPage = if ($ProcessName -eq "chrome") { "chrome://extensions/" } else { "edge://extensions/" }
  if (-not [string]::Equals($Page, $expectedPage, [StringComparison]::Ordinal)) {
    throw "Refusing to enter an unexpected browser address."
  }
  if (-not (Test-RoToolForegroundBrowser -ProcessName $ProcessName)) { return $false }

  try {
    Add-Type -AssemblyName System.Windows.Forms
    # Chromium deliberately drops internal pages supplied as startup URLs. Enter
    # this fixed, non-secret address only after verifying the foreground process.
    [Windows.Forms.SendKeys]::SendWait("^l$Page{ENTER}")
    return $true
  } catch {
    return $false
  }
}

function Open-RoToolExtensionsPage {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("edge", "chrome")][string]$Browser,
    [scriptblock]$StartProcessAction,
    [scriptblock]$WindowAction,
    [scriptblock]$NavigateAction
  )

  $processName = if ($Browser -eq "chrome") { "chrome" } else { "msedge" }
  $executable = Get-RoToolInstalledBrowserExecutable $Browser
  if ([string]::IsNullOrWhiteSpace($executable)) { $executable = "$processName.exe" }
  $page = if ($Browser -eq "chrome") { "chrome://extensions/" } else { "edge://extensions/" }
  if ($null -eq $StartProcessAction) {
    $StartProcessAction = { param($file, $arguments) Start-Process -FilePath $file -ArgumentList $arguments }
  }
  if ($null -eq $WindowAction) {
    $WindowAction = { param($name) return (Focus-RoToolBrowserWindow -ProcessName $name) }
  }
  if ($null -eq $NavigateAction) {
    $NavigateAction = { param($name, $address) return (Set-RoToolBrowserInternalPage -ProcessName $name -Page $address) }
  }
  try {
    # Pass no internal URL on the command line: current Chrome and Edge replace
    # it with New Tab. One launch creates the destination tab; there is no second
    # fallback launch that could leave another blank browser window behind.
    [void](& $StartProcessAction $executable @("--new-tab"))
    $focused = [bool](& $WindowAction $processName)
    if (-not $focused) { throw "The selected browser could not be verified in the foreground." }
    $navigated = [bool](& $NavigateAction $processName $page)
    if (-not $navigated) { throw "The extensions page could not be entered safely." }
  } catch {
    Write-Host "The update is installed, but the browser page could not be opened safely." -ForegroundColor Yellow
    Write-Host "Open $page manually and press Reload on RoTool." -ForegroundColor Yellow
  }
}

function Invoke-RoToolUpdater {
  param(
    [string]$RequestedRepository,
    [switch]$ReinstallCurrent,
    [switch]$OnlyCheck,
    [switch]$DoNotOpenBrowser,
    [switch]$DoNotPrompt,
    [switch]$DoNotRefreshUpdater
  )

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $installRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
  $stateBase = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { [IO.Path]::GetTempPath() } else { $env:LOCALAPPDATA }
  $stateRoot = Join-Path $stateBase "RoToolUpdater"
  if (-not (Test-Path -LiteralPath $stateRoot -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $stateRoot -Force)
  }
  Repair-RoToolInterruptedUpdaterUpdate -StateRoot $stateRoot -ExpectedUpdaterRoot $PSScriptRoot
  Repair-RoToolInterruptedUpdate -StateRoot $stateRoot
  $currentManifest = Get-RoToolManifest $installRoot
  $configuration = Get-RoToolUpdaterConfiguration -RequestedRepository $RequestedRepository -DoNotPrompt:$DoNotPrompt

  Write-Host "Checking $($configuration.Repository) for a RoTool update..." -ForegroundColor Cyan
  $release = Get-RoToolLatestRelease $configuration.Repository
  $comparison = Compare-RoToolVersion $release.Version ([string]$currentManifest.version)
  if ($comparison -lt 0) {
    throw "Latest GitHub release $($release.Version) is older than installed RoTool $($currentManifest.version)."
  }
  if ($OnlyCheck) {
    if ($comparison -eq 0) {
      Write-Host "RoTool $($currentManifest.version) is already current." -ForegroundColor Green
    } else {
      Write-Host "RoTool $($release.Version) is available. Installed: $($currentManifest.version)." -ForegroundColor Green
    }
    return
  }

  $workRoot = Join-Path ([IO.Path]::GetTempPath()) "RoToolUpdater-$([Guid]::NewGuid().ToString('N'))"
  [void](New-Item -ItemType Directory -Path $workRoot)
  try {
    if (-not $DoNotRefreshUpdater) {
      $updaterResult = Update-RoToolUpdaterCoreFromRelease -Release $release -WorkRoot $workRoot -StateRoot $stateRoot
      if ($updaterResult.Updated) {
        Write-Host "RoTool updater refreshed: $script:UpdaterVersion -> $($updaterResult.Version)" -ForegroundColor Green
        Write-Host "Restarting the verified updater..." -ForegroundColor Cyan
        Restart-RoToolUpdater -ReinstallCurrent:$ReinstallCurrent -DoNotOpenBrowser:$DoNotOpenBrowser -DoNotPrompt:$DoNotPrompt
        return
      }
    }

    if ($comparison -eq 0 -and -not $ReinstallCurrent) {
      Write-Host "RoTool $($currentManifest.version) is already current." -ForegroundColor Green
      if (-not $DoNotOpenBrowser) {
        $resolvedBrowser = Resolve-RoToolBrowser -Browser $configuration.Browser -InstallRoot $installRoot
        Write-Host "Opening $resolvedBrowser extensions for Reload..." -ForegroundColor Cyan
        Open-RoToolExtensionsPage $resolvedBrowser
      }
      return
    }

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
      $resolvedBrowser = Resolve-RoToolBrowser -Browser $configuration.Browser -InstallRoot $installRoot
      Write-Host "Opening $resolvedBrowser extensions for Reload..." -ForegroundColor Cyan
      Open-RoToolExtensionsPage $resolvedBrowser
    }
  } finally {
    if (Test-Path -LiteralPath $workRoot -PathType Container) {
      Remove-Item -LiteralPath $workRoot -Recurse -Force
    }
  }
}

if (-not $LibraryOnly) {
  try {
    Invoke-RoToolUpdater -RequestedRepository $Repository -ReinstallCurrent:$Force -OnlyCheck:$CheckOnly -DoNotOpenBrowser:$NoOpenBrowser -DoNotPrompt:$NonInteractive -DoNotRefreshUpdater:$SkipUpdaterRefresh
    exit 0
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}
