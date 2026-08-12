[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$script:AssertionCount = 0
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "RoToolUpdaterTests-$([Guid]::NewGuid().ToString('N'))"

function Assert-True {
  param(
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $script:AssertionCount += 1
  if (-not $Condition) {
    throw "Assertion failed: $Message"
  }
}

function Assert-Equal {
  param(
    $Actual,
    $Expected,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $script:AssertionCount += 1
  if ($Actual -cne $Expected) {
    throw "Assertion failed: $Message. Expected '$Expected', received '$Actual'."
  }
}

function Assert-SequenceEqual {
  param(
    [object[]]$Actual,
    [object[]]$Expected,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $script:AssertionCount += 1
  if (($Actual | ConvertTo-Json -Compress) -cne ($Expected | ConvertTo-Json -Compress)) {
    throw "Assertion failed: $Message.`nExpected: $($Expected -join ', ')`nActual: $($Actual -join ', ')"
  }
}

function Assert-Throws {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [Parameter(Mandatory = $true)][string]$MessagePattern,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $script:AssertionCount += 1
  try {
    & $Action
  } catch {
    if ($_.Exception.Message -notmatch $MessagePattern) {
      throw "Assertion failed: $Message. Wrong error: $($_.Exception.Message)"
    }
    return
  }
  throw "Assertion failed: $Message. No error was raised."
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value
  )

  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $parent -Force)
  }
  [IO.File]::WriteAllText($Path, $Value, (New-Object Text.UTF8Encoding($false)))
}

function New-TestManifestJson {
  param([string]$Version)

  return (@{
    name = "RoTool"
    manifest_version = 3
    version = $Version
  } | ConvertTo-Json -Compress)
}

function New-TestZip {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object[]]$Entries
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    foreach ($item in $Entries) {
      $entry = $archive.CreateEntry([string]$item.Name)
      if ($null -ne $item.ExternalAttributes) {
        $entry.ExternalAttributes = [int]$item.ExternalAttributes
      }
      $writer = New-Object IO.StreamWriter($entry.Open(), (New-Object Text.UTF8Encoding($false)))
      try {
        $writer.Write([string]$item.Content)
      } finally {
        $writer.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
    $stream.Dispose()
  }
}

function Get-ZipEntryNames {
  param([Parameter(Mandatory = $true)][string]$Path)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($Path)
  try {
    return @($archive.Entries | ForEach-Object { $_.FullName })
  } finally {
    $archive.Dispose()
  }
}

function Read-ZipTextEntry {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$EntryName
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = @($archive.Entries | Where-Object { $_.FullName -ceq $EntryName })
    if ($entry.Count -ne 1) { throw "ZIP entry not found exactly once: $EntryName" }
    $reader = New-Object IO.StreamReader($entry[0].Open(), [Text.Encoding]::UTF8, $true)
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $archive.Dispose()
  }
}

function New-InstallFixture {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Content
  )

  Write-Utf8File -Path (Join-Path $Root "manifest.json") -Value (New-TestManifestJson $Version)
  Write-Utf8File -Path (Join-Path $Root "content.js") -Value $Content
}

try {
  [void](New-Item -ItemType Directory -Path $fixtureRoot)
  $copiedUpdater = Join-Path $fixtureRoot "updater"
  [void](New-Item -ItemType Directory -Path $copiedUpdater)
  Copy-Item -LiteralPath (Join-Path $ProjectRoot "updater\Update-RoTool.ps1") -Destination $copiedUpdater
  Copy-Item -LiteralPath (Join-Path $ProjectRoot "updater\package-files.json") -Destination $copiedUpdater

  . (Join-Path $copiedUpdater "Update-RoTool.ps1") -LibraryOnly

  # Repository identifiers are data, not URLs or paths.
  Assert-Equal (Assert-RoToolRepository "Example-Owner/rotool.release") "Example-Owner/rotool.release" "normal repository identifier is accepted"
  foreach ($unsafeRepository in @(
    "OWNER/REPOSITORY",
    "https://github.com/owner/repo",
    "owner/repo/extra",
    "../repo",
    "owner/..",
    "owner/.",
    "owner repo/name",
    "owner\\repo",
    "owner/repo?ref=main"
  )) {
    Assert-Throws { [void](Assert-RoToolRepository $unsafeRepository) } "OWNER/REPOSITORY" "unsafe repository '$unsafeRepository' is rejected"
  }

  # Configuration is local, validates saved input, and lets an explicit repository win.
  $configuration = Get-RoToolUpdaterConfiguration -RequestedRepository "first-owner/first-repo" -DoNotPrompt
  Assert-Equal $configuration.Repository "first-owner/first-repo" "explicit repository is returned"
  Assert-Equal $configuration.Browser "edge" "new configuration defaults to Edge"
  $savedConfiguration = Get-Content -Raw -LiteralPath $configuration.ConfigPath | ConvertFrom-Json
  Assert-Equal ([string]$savedConfiguration.repository) "first-owner/first-repo" "validated repository is persisted"
  Assert-Equal ([string]$savedConfiguration.browser) "edge" "default browser is persisted"

  Write-Utf8File -Path $configuration.ConfigPath -Value '{"repository":"saved-owner/saved-repo","browser":"chrome"}'
  $configuration = Get-RoToolUpdaterConfiguration -RequestedRepository "override-owner/override-repo" -DoNotPrompt
  Assert-Equal $configuration.Repository "override-owner/override-repo" "command-line repository overrides saved repository"
  Assert-Equal $configuration.Browser "chrome" "valid saved browser is retained"
  $configuration = Get-RoToolUpdaterConfiguration -DoNotPrompt
  Assert-Equal $configuration.Repository "override-owner/override-repo" "saved validated repository supports later noninteractive runs"

  Write-Utf8File -Path $configuration.ConfigPath -Value '{not-json'
  Assert-Throws { [void](Get-RoToolUpdaterConfiguration -DoNotPrompt) } "invalid JSON" "invalid configuration JSON fails closed"
  Remove-Item -LiteralPath $configuration.ConfigPath -Force
  Assert-Throws { [void](Get-RoToolUpdaterConfiguration -DoNotPrompt) } "No GitHub repository" "noninteractive run requires a configured repository"

  # Browser-extension versions compare numerically and fail closed on invalid values.
  Assert-Equal (Compare-RoToolVersion "0.16.10" "0.16.9") 1 "multi-digit version component compares numerically"
  Assert-Equal (Compare-RoToolVersion "1.2" "1.2.0.0") 0 "missing version components compare as zero"
  Assert-Equal (Compare-RoToolVersion "1.2.3" "1.3") -1 "older version compares lower"
  foreach ($invalidVersion in @("01.2.3", "1.2.3.4.5", "1.-2.3", "1.65536.0", "v1.2.3")) {
    Assert-Throws { [void](ConvertTo-RoToolVersionParts $invalidVersion) } "Invalid extension version|exceeds 65535" "invalid version '$invalidVersion' is rejected"
  }

  # Published SHA-256 format and bytes must both match.
  $checksumRoot = Join-Path $fixtureRoot "checksum"
  [void](New-Item -ItemType Directory -Path $checksumRoot)
  $packagePath = Join-Path $checksumRoot "RoTool-extension.zip"
  $checksumPath = "$packagePath.sha256"
  Write-Utf8File -Path $packagePath -Value "package bytes"
  $expectedHash = (Get-RoToolFileSha256 $packagePath).ToLowerInvariant()
  Write-Utf8File -Path $checksumPath -Value "$expectedHash  RoTool-extension.zip`n"
  Assert-Equal (Assert-RoToolChecksum -PackagePath $packagePath -ChecksumPath $checksumPath) $expectedHash.ToUpperInvariant() "valid checksum is accepted"
  Write-Utf8File -Path $checksumPath -Value "$('0' * 64)  RoTool-extension.zip`n"
  Assert-Throws { [void](Assert-RoToolChecksum -PackagePath $packagePath -ChecksumPath $checksumPath) } "does not match" "checksum mismatch is rejected"
  Write-Utf8File -Path $checksumPath -Value "$expectedHash  unexpected.zip`n"
  Assert-Throws { [void](Assert-RoToolChecksum -PackagePath $packagePath -ChecksumPath $checksumPath) } "unexpected format" "checksum for another filename is rejected"

  # The archive must contain exactly the allowlist and cannot traverse or smuggle files.
  $archiveRoot = Join-Path $fixtureRoot "archives"
  [void](New-Item -ItemType Directory -Path $archiveRoot)
  $managedFiles = @("manifest.json", "content.js")
  $manifest123 = New-TestManifestJson "1.2.3"
  $safeEntries = @(
    [PSCustomObject]@{ Name = "manifest.json"; Content = $manifest123; ExternalAttributes = $null },
    [PSCustomObject]@{ Name = "content.js"; Content = "new runtime"; ExternalAttributes = $null }
  )
  $safeZip = Join-Path $archiveRoot "safe.zip"
  New-TestZip -Path $safeZip -Entries $safeEntries
  $safeDestination = Join-Path $archiveRoot "safe-expanded"
  $expandedManifest = Expand-RoToolValidatedPackage -PackagePath $safeZip -Destination $safeDestination -ExpectedVersion "1.2.3" -ManagedFiles $managedFiles
  Assert-Equal ([string]$expandedManifest.version) "1.2.3" "exact allowlisted archive expands"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $safeDestination "content.js")) "new runtime" "validated entry bytes are extracted"

  $archiveCases = @(
    [PSCustomObject]@{
      Label = "extra file"
      Entries = @($safeEntries + [PSCustomObject]@{ Name = "payload.exe"; Content = "bad"; ExternalAttributes = $null })
      Pattern = "unexpected|unsafe"
    },
    [PSCustomObject]@{
      Label = "parent traversal"
      Entries = @($safeEntries + [PSCustomObject]@{ Name = "../outside.txt"; Content = "bad"; ExternalAttributes = $null })
      Pattern = "unexpected|unsafe"
    },
    [PSCustomObject]@{
      Label = "absolute path"
      Entries = @($safeEntries + [PSCustomObject]@{ Name = "/outside.txt"; Content = "bad"; ExternalAttributes = $null })
      Pattern = "unexpected|unsafe"
    },
    [PSCustomObject]@{
      Label = "duplicate path"
      Entries = @($safeEntries + [PSCustomObject]@{ Name = "CONTENT.js"; Content = "duplicate"; ExternalAttributes = $null })
      Pattern = "duplicate|unexpected|unsafe"
    },
    [PSCustomObject]@{
      Label = "missing allowlisted file"
      Entries = @($safeEntries | Select-Object -First 1)
      Pattern = "missing managed files"
    }
  )
  $archiveCaseIndex = 0
  foreach ($case in $archiveCases) {
    $archiveCaseIndex += 1
    $caseZip = Join-Path $archiveRoot "unsafe-$archiveCaseIndex.zip"
    $caseDestination = Join-Path $archiveRoot "unsafe-$archiveCaseIndex-expanded"
    New-TestZip -Path $caseZip -Entries $case.Entries
    Assert-Throws {
      [void](Expand-RoToolValidatedPackage -PackagePath $caseZip -Destination $caseDestination -ExpectedVersion "1.2.3" -ManagedFiles $managedFiles)
    } $case.Pattern "$($case.Label) archive is rejected"
  }

  $wrongVersionZip = Join-Path $archiveRoot "wrong-version.zip"
  New-TestZip -Path $wrongVersionZip -Entries @(
    [PSCustomObject]@{ Name = "manifest.json"; Content = (New-TestManifestJson "1.2.4"); ExternalAttributes = $null },
    [PSCustomObject]@{ Name = "content.js"; Content = "new runtime"; ExternalAttributes = $null }
  )
  Assert-Throws {
    [void](Expand-RoToolValidatedPackage -PackagePath $wrongVersionZip -Destination (Join-Path $archiveRoot "wrong-version-expanded") -ExpectedVersion "1.2.3" -ManagedFiles $managedFiles)
  } "does not match embedded manifest" "release tag and embedded manifest must match"

  $symlinkMode = [Convert]::ToUInt32("A0000000", 16)
  $symlinkAttributes = [BitConverter]::ToInt32([BitConverter]::GetBytes($symlinkMode), 0)
  $symlinkZip = Join-Path $archiveRoot "symlink.zip"
  New-TestZip -Path $symlinkZip -Entries @(
    [PSCustomObject]@{ Name = "manifest.json"; Content = $manifest123; ExternalAttributes = $null },
    [PSCustomObject]@{ Name = "content.js"; Content = "target"; ExternalAttributes = $symlinkAttributes }
  )
  Assert-Throws {
    [void](Expand-RoToolValidatedPackage -PackagePath $symlinkZip -Destination (Join-Path $archiveRoot "symlink-expanded") -ExpectedVersion "1.2.3" -ManagedFiles $managedFiles)
  } "symbolic link" "symbolic-link ZIP entry is rejected"

  # Applying replaces only managed files, preserving the permanent folder and local extras.
  $installRoot = Join-Path $fixtureRoot "permanent-install"
  $stagingRoot = Join-Path $fixtureRoot "staged-release"
  $stateRoot = Join-Path $fixtureRoot "state"
  New-InstallFixture -Root $installRoot -Version "1.0.0" -Content "old runtime"
  New-InstallFixture -Root $stagingRoot -Version "1.1.0" -Content "new runtime"
  Write-Utf8File -Path (Join-Path $installRoot "updater\updater.config.json") -Value '{"repository":"friend/repo","browser":"chrome"}'
  Write-Utf8File -Path (Join-Path $installRoot "friend-notes.txt") -Value "keep me"
  $originalInstallPath = (Get-Item -LiteralPath $installRoot).FullName
  $backupRoot = Install-RoToolValidatedPackage -InstallRoot $installRoot -StagingRoot $stagingRoot -OldVersion "1.0.0" -NewVersion "1.1.0" -StateRoot $stateRoot -ManagedFiles $managedFiles
  Assert-Equal ([string](Get-RoToolManifest $installRoot).version) "1.1.0" "installed manifest advances"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $installRoot "content.js")) "new runtime" "managed runtime file is updated"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $installRoot "friend-notes.txt")) "keep me" "unmanaged user file is preserved"
  Assert-True (Test-Path -LiteralPath (Join-Path $installRoot "updater\updater.config.json") -PathType Leaf) "local updater configuration is preserved"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $installRoot "updater\updater.config.json")) '{"repository":"friend/repo","browser":"chrome"}' "local updater configuration bytes are unchanged"
  Assert-Equal (Get-Item -LiteralPath $installRoot).FullName $originalInstallPath "permanent install folder remains at the same path"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $backupRoot "content.js")) "old runtime" "rollback backup contains old runtime"
  Assert-Equal ([string](Get-Content -Raw -LiteralPath (Join-Path $stateRoot "journal.json") | ConvertFrom-Json).status) "completed" "successful update journal completes"

  # A failure after the first replacement restores every managed file.
  $rollbackInstall = Join-Path $fixtureRoot "rollback-install"
  $rollbackStaging = Join-Path $fixtureRoot "rollback-staging"
  $rollbackState = Join-Path $fixtureRoot "rollback-state"
  New-InstallFixture -Root $rollbackInstall -Version "2.0.0" -Content "old rollback runtime"
  Write-Utf8File -Path (Join-Path $rollbackStaging "manifest.json") -Value (New-TestManifestJson "2.1.0")
  Write-Utf8File -Path (Join-Path $rollbackInstall "unmanaged.txt") -Value "untouched"
  Assert-Throws {
    [void](Install-RoToolValidatedPackage -InstallRoot $rollbackInstall -StagingRoot $rollbackStaging -OldVersion "2.0.0" -NewVersion "2.1.0" -StateRoot $rollbackState -ManagedFiles $managedFiles)
  } "previous files were restored" "mid-apply failure reports rollback"
  Assert-Equal ([string](Get-RoToolManifest $rollbackInstall).version) "2.0.0" "rollback restores old manifest"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackInstall "content.js")) "old rollback runtime" "rollback restores old runtime"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackInstall "unmanaged.txt")) "untouched" "rollback does not touch unmanaged files"
  Assert-Equal ([string](Get-Content -Raw -LiteralPath (Join-Path $rollbackState "journal.json") | ConvertFrom-Json).status) "rolledBack" "failed update journal records rollback"

  # The release builder emits deterministic, exactly allowlisted packages and checksums.
  $manifest = Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot "manifest.json") | ConvertFrom-Json
  $version = [string]$manifest.version
  $buildOne = Join-Path $fixtureRoot "build-one"
  $buildTwo = Join-Path $fixtureRoot "build-two"
  $builder = Join-Path $ProjectRoot "tools\build-release.ps1"
  [void](& $builder -OutputDirectory $buildOne -Repository "sample-owner/sample-repo" -ExpectedTag "v$version")
  [void](& $builder -OutputDirectory $buildTwo -Repository "sample-owner/sample-repo" -ExpectedTag "v$version")
  Assert-Throws {
    [void](& $builder -OutputDirectory (Join-Path $fixtureRoot "bad-tag") -Repository "sample-owner/sample-repo" -ExpectedTag "v999.0.0")
  } "does not match manifest" "release builder rejects a mismatched tag"
  Assert-Throws {
    [void](& $builder -OutputDirectory (Join-Path $fixtureRoot "bad-repository") -Repository "../repo" -ExpectedTag "v$version")
  } "OWNER/REPOSITORY" "release builder rejects traversal-like repository identifier"

  $packageFiles = @((Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot "updater\package-files.json") | ConvertFrom-Json) | ForEach-Object { [string]$_ })
  $expectedRuntimeEntries = @($packageFiles | Sort-Object)
  $extensionArchive = Join-Path $buildOne "RoTool-extension.zip"
  $setupArchive = Join-Path $buildOne "RoTool-setup.zip"
  Assert-SequenceEqual @((Get-ZipEntryNames $extensionArchive) | Sort-Object) $expectedRuntimeEntries "extension archive contains exactly the runtime allowlist"
  $expectedSetupEntries = @($expectedRuntimeEntries + @(
    "updater/README.md",
    "updater/Update RoTool.cmd",
    "updater/Update-RoTool.ps1",
    "updater/package-files.json",
    "updater/updater.config.json"
  ) | Sort-Object)
  Assert-SequenceEqual @((Get-ZipEntryNames $setupArchive) | Sort-Object) $expectedSetupEntries "setup archive adds only updater bootstrap files"
  $embeddedConfiguration = Read-ZipTextEntry -Path $setupArchive -EntryName "updater/updater.config.json" | ConvertFrom-Json
  Assert-Equal ([string]$embeddedConfiguration.repository) "sample-owner/sample-repo" "setup archive embeds release repository"
  Assert-Equal ([string]$embeddedConfiguration.browser) "edge" "setup archive defaults to Edge"
  Assert-Equal (Get-RoToolFileSha256 $extensionArchive) (Get-RoToolFileSha256 (Join-Path $buildTwo "RoTool-extension.zip")) "extension package is reproducible"
  Assert-Equal (Get-RoToolFileSha256 $setupArchive) (Get-RoToolFileSha256 (Join-Path $buildTwo "RoTool-setup.zip")) "setup package is reproducible"

  foreach ($archiveName in @("RoTool-extension.zip", "RoTool-setup.zip")) {
    $archivePath = Join-Path $buildOne $archiveName
    $publishedChecksum = Get-Content -Raw -LiteralPath "$archivePath.sha256"
    $actualHash = (Get-RoToolFileSha256 $archivePath).ToLowerInvariant()
    Assert-True ($publishedChecksum -cmatch "^$actualHash  $([regex]::Escape($archiveName))`n$") "$archiveName checksum names and hashes the matching asset"
  }

  Write-Output "PASS RoTool GitHub updater safety and release fixture ($script:AssertionCount assertions)"
} finally {
  if (Test-Path -LiteralPath $fixtureRoot -PathType Container) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
