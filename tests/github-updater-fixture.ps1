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

function New-ChromiumProfileFixture {
  param(
    [Parameter(Mandatory = $true)][string]$UserDataRoot,
    [Parameter(Mandatory = $true)][string]$ProfileName,
    [Parameter(Mandatory = $true)][string]$ExtensionPath,
    [string]$PreferenceFileName = "Preferences"
  )

  $localState = [ordered]@{
    profile = [ordered]@{
      info_cache = [ordered]@{
        $ProfileName = [ordered]@{ name = $ProfileName }
      }
    }
  } | ConvertTo-Json -Depth 8
  Write-Utf8File -Path (Join-Path $UserDataRoot "Local State") -Value $localState

  $preferences = [ordered]@{
    extensions = [ordered]@{
      settings = [ordered]@{
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" = [ordered]@{
          location = 4
          path = $ExtensionPath
        }
      }
    }
  } | ConvertTo-Json -Depth 8
  Write-Utf8File -Path (Join-Path (Join-Path $UserDataRoot $ProfileName) $PreferenceFileName) -Value $preferences
}

function New-TestUpdaterCore {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Marker
  )

  Write-Utf8File -Path (Join-Path $Root "Update-RoTool.ps1") -Value "`$script:UpdaterVersion = `"$Version`"`nSet-StrictMode -Version 2.0`n# $Marker`n"
  Write-Utf8File -Path (Join-Path $Root "README.md") -Value "updater readme $Marker"
  Write-Utf8File -Path (Join-Path $Root "package-files.json") -Value "[`"manifest.json`"]"
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
  Assert-Equal $configuration.Browser "auto" "new configuration defaults to automatic browser detection"
  $savedConfiguration = Get-Content -Raw -LiteralPath $configuration.ConfigPath | ConvertFrom-Json
  Assert-Equal ([string]$savedConfiguration.repository) "first-owner/first-repo" "validated repository is persisted"
  Assert-Equal ([string]$savedConfiguration.browser) "auto" "automatic browser detection is persisted"

  Write-Utf8File -Path $configuration.ConfigPath -Value '{"repository":"saved-owner/saved-repo","browser":"chrome","configVersion":2}'
  $configuration = Get-RoToolUpdaterConfiguration -RequestedRepository "override-owner/override-repo" -DoNotPrompt
  Assert-Equal $configuration.Repository "override-owner/override-repo" "command-line repository overrides saved repository"
  Assert-Equal $configuration.Browser "chrome" "valid saved browser is retained"
  $configuration = Get-RoToolUpdaterConfiguration -DoNotPrompt
  Assert-Equal $configuration.Repository "override-owner/override-repo" "saved validated repository supports later noninteractive runs"
  $savedConfiguration = Get-Content -Raw -LiteralPath $configuration.ConfigPath | ConvertFrom-Json
  Assert-Equal ([int]$savedConfiguration.configVersion) 2 "current configuration schema version is persisted"

  foreach ($legacyBrowser in @("edge", "chrome")) {
    Write-Utf8File -Path $configuration.ConfigPath -Value "{`"repository`":`"legacy-owner/legacy-repo`",`"browser`":`"$legacyBrowser`"}"
    $legacyConfiguration = Get-RoToolUpdaterConfiguration -DoNotPrompt
    Assert-Equal $legacyConfiguration.Browser "auto" "legacy generated $legacyBrowser default migrates to automatic detection"
    $migratedConfiguration = Get-Content -Raw -LiteralPath $legacyConfiguration.ConfigPath | ConvertFrom-Json
    Assert-Equal ([int]$migratedConfiguration.configVersion) 2 "legacy $legacyBrowser configuration migrates to schema 2"
    Assert-Equal ([string]$migratedConfiguration.browser) "auto" "legacy $legacyBrowser configuration no longer forces the wrong browser"
  }

  foreach ($explicitBrowser in @("edge", "chrome")) {
    Write-Utf8File -Path $configuration.ConfigPath -Value "{`"repository`":`"explicit-owner/explicit-repo`",`"browser`":`"$explicitBrowser`",`"configVersion`":2}"
    $explicitConfiguration = Get-RoToolUpdaterConfiguration -DoNotPrompt
    Assert-Equal $explicitConfiguration.Browser $explicitBrowser "schema 2 explicit $explicitBrowser override remains honored"
  }

  Write-Utf8File -Path $configuration.ConfigPath -Value '{not-json'
  Assert-Throws { [void](Get-RoToolUpdaterConfiguration -DoNotPrompt) } "invalid JSON" "invalid configuration JSON fails closed"
  Remove-Item -LiteralPath $configuration.ConfigPath -Force
  Assert-Throws { [void](Get-RoToolUpdaterConfiguration -DoNotPrompt) } "No GitHub repository" "noninteractive run requires a configured repository"

  # Browser detection uses only exact unpacked-install registrations, while an
  # explicit choice and a running-browser fallback remain deterministic.
  $browserInstall = Join-Path $fixtureRoot "Browser Install"
  $nearbyInstall = "$browserInstall-other"
  New-InstallFixture -Root $browserInstall -Version "1.0.0" -Content "browser fixture"
  New-InstallFixture -Root $nearbyInstall -Version "1.0.0" -Content "nearby fixture"
  $chromeUserData = Join-Path $fixtureRoot "Chrome User Data"
  $edgeUserData = Join-Path $fixtureRoot "Edge User Data"
  New-ChromiumProfileFixture -UserDataRoot $chromeUserData -ProfileName "Profile 2" -ExtensionPath $browserInstall
  New-ChromiumProfileFixture -UserDataRoot $edgeUserData -ProfileName "Default" -ExtensionPath $nearbyInstall -PreferenceFileName "Secure Preferences"

  Assert-Equal (Resolve-RoToolBrowser -Browser "edge" -InstallRoot $browserInstall -ChromeUserDataRoot $chromeUserData -EdgeUserDataRoot $edgeUserData -RunningBrowserNames @("chrome")) "edge" "explicit Edge override is honored"
  Assert-Equal (Resolve-RoToolBrowser -Browser "chrome" -InstallRoot $browserInstall -ChromeUserDataRoot $chromeUserData -EdgeUserDataRoot $edgeUserData -RunningBrowserNames @("msedge")) "chrome" "explicit Chrome override is honored"
  Assert-Equal (Resolve-RoToolBrowser -Browser "auto" -InstallRoot $browserInstall -ChromeUserDataRoot $chromeUserData -EdgeUserDataRoot $edgeUserData -RunningBrowserNames @("msedge")) "chrome" "exact Chrome profile registration wins over an Edge path prefix and running Edge"

  $unregisteredInstall = Join-Path $fixtureRoot "Unregistered Install"
  New-InstallFixture -Root $unregisteredInstall -Version "1.0.0" -Content "unregistered fixture"
  Assert-Equal (Resolve-RoToolBrowser -Browser "auto" -InstallRoot $unregisteredInstall -ChromeUserDataRoot $chromeUserData -EdgeUserDataRoot $edgeUserData -RunningBrowserNames @("chrome")) "chrome" "running Chrome is the safe fallback when no profile registers this installation"
  Assert-Equal (Resolve-RoToolBrowser -Browser "auto" -InstallRoot $unregisteredInstall -ChromeUserDataRoot $chromeUserData -EdgeUserDataRoot $edgeUserData -RunningBrowserNames @("msedge")) "edge" "running Edge is the safe fallback when no profile registers this installation"

  $dualInstall = Join-Path $fixtureRoot "Dual Browser Install"
  New-InstallFixture -Root $dualInstall -Version "1.0.0" -Content "dual browser fixture"
  $dualChromeUserData = Join-Path $fixtureRoot "Dual Chrome User Data"
  $dualEdgeUserData = Join-Path $fixtureRoot "Dual Edge User Data"
  New-ChromiumProfileFixture -UserDataRoot $dualChromeUserData -ProfileName "Default" -ExtensionPath $dualInstall
  New-ChromiumProfileFixture -UserDataRoot $dualEdgeUserData -ProfileName "Profile 3" -ExtensionPath $dualInstall -PreferenceFileName "Secure Preferences"
  Assert-Equal (Resolve-RoToolBrowser -Browser "auto" -InstallRoot $dualInstall -ChromeUserDataRoot $dualChromeUserData -EdgeUserDataRoot $dualEdgeUserData -RunningBrowserNames @("chrome")) "chrome" "running Chrome disambiguates an installation registered in both browsers"
  Assert-Equal (Resolve-RoToolBrowser -Browser "auto" -InstallRoot $dualInstall -ChromeUserDataRoot $dualChromeUserData -EdgeUserDataRoot $dualEdgeUserData -RunningBrowserNames @("msedge")) "edge" "running Edge disambiguates an installation registered in both browsers"

  # Real Chromium profiles can omit any intermediate registration property.
  # StrictMode must treat each incomplete shape as an ordinary non-match.
  $incompleteProfileCases = @(
    [PSCustomObject]@{ Label = "profile"; LocalState = '{}'; Preferences = '{}' },
    [PSCustomObject]@{ Label = "info_cache"; LocalState = '{"profile":{}}'; Preferences = '{}' },
    [PSCustomObject]@{ Label = "extensions"; LocalState = '{"profile":{"info_cache":{"Default":{}}}}'; Preferences = '{}' },
    [PSCustomObject]@{ Label = "settings"; LocalState = '{"profile":{"info_cache":{"Default":{}}}}'; Preferences = '{"extensions":{}}' },
    [PSCustomObject]@{ Label = "path"; LocalState = '{"profile":{"info_cache":{"Default":{}}}}'; Preferences = '{"extensions":{"settings":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":{"location":4}}}}' }
  )
  foreach ($case in $incompleteProfileCases) {
    $incompleteUserData = Join-Path $fixtureRoot "Incomplete-$($case.Label)"
    Write-Utf8File -Path (Join-Path $incompleteUserData "Local State") -Value $case.LocalState
    Write-Utf8File -Path (Join-Path (Join-Path $incompleteUserData "Default") "Preferences") -Value $case.Preferences
    Assert-Equal (Test-RoToolBrowserRegistration -InstallRoot $browserInstall -UserDataRoot $incompleteUserData) $false "missing $($case.Label) property is a safe browser-registration non-match"
  }

  # Chromium drops chrome:// and edge:// startup URLs. Opening is observable
  # without launching a browser: exactly one URL-free new-tab launch must be
  # followed by successful foreground verification and then navigation.
  $script:BrowserOpenExecutable = $null
  $script:BrowserOpenArguments = @()
  $script:BrowserWindowName = $null
  $script:BrowserNavigationName = $null
  $script:BrowserNavigationPage = $null
  $script:BrowserOpenCount = 0
  $script:BrowserActionOrder = @()
  $startBrowserHook = {
    param([string]$Executable, [object[]]$Arguments)
    $script:BrowserOpenCount += 1
    $script:BrowserOpenExecutable = $Executable
    $script:BrowserOpenArguments = @($Arguments)
    $script:BrowserActionOrder += "start"
  }
  $focusBrowserHook = {
    param([string]$ProcessName)
    $script:BrowserWindowName = $ProcessName
    $script:BrowserActionOrder += "focus"
    return $true
  }
  $navigateBrowserHook = {
    param([string]$ProcessName, [string]$Page)
    $script:BrowserNavigationName = $ProcessName
    $script:BrowserNavigationPage = $Page
    $script:BrowserActionOrder += "navigate"
    return $true
  }
  Open-RoToolExtensionsPage -Browser "chrome" -StartProcessAction $startBrowserHook -WindowAction $focusBrowserHook -NavigateAction $navigateBrowserHook
  Assert-Equal ([IO.Path]::GetFileName($script:BrowserOpenExecutable)) "chrome.exe" "Chrome executable is selected"
  Assert-Equal $script:BrowserOpenCount 1 "Chrome uses exactly one browser launch"
  Assert-SequenceEqual $script:BrowserOpenArguments @("--new-tab") "Chrome internal URL is not lost as a startup argument"
  Assert-Equal $script:BrowserWindowName "chrome" "Chrome window is restored and foregrounded"
  Assert-Equal $script:BrowserNavigationName "chrome" "navigation is bound to the verified Chrome process"
  Assert-Equal $script:BrowserNavigationPage "chrome://extensions/" "Chrome extensions page is entered after focus"
  Assert-SequenceEqual $script:BrowserActionOrder @("start", "focus", "navigate") "Chrome focus is verified before address entry"

  $script:BrowserOpenCount = 0
  $script:BrowserActionOrder = @()
  Open-RoToolExtensionsPage -Browser "edge" -StartProcessAction $startBrowserHook -WindowAction $focusBrowserHook -NavigateAction $navigateBrowserHook
  Assert-Equal ([IO.Path]::GetFileName($script:BrowserOpenExecutable)) "msedge.exe" "Edge executable is selected"
  Assert-Equal $script:BrowserOpenCount 1 "Edge uses exactly one browser launch"
  Assert-SequenceEqual $script:BrowserOpenArguments @("--new-tab") "Edge internal URL is not lost as a startup argument"
  Assert-Equal $script:BrowserWindowName "msedge" "Edge window is restored and foregrounded"
  Assert-Equal $script:BrowserNavigationName "msedge" "navigation is bound to the verified Edge process"
  Assert-Equal $script:BrowserNavigationPage "edge://extensions/" "Edge extensions page is entered after focus"
  Assert-SequenceEqual $script:BrowserActionOrder @("start", "focus", "navigate") "Edge focus is verified before address entry"

  # Omitting NavigateAction must route through the production navigation
  # function, still after the focus result has been accepted.
  $realNavigationFunction = (Get-Item -LiteralPath Function:\Set-RoToolBrowserInternalPage).ScriptBlock
  $script:BrowserOpenCount = 0
  $script:BrowserActionOrder = @()
  $script:DefaultNavigationName = $null
  $script:DefaultNavigationPage = $null
  try {
    Set-Item -LiteralPath Function:\Set-RoToolBrowserInternalPage -Value {
      param([string]$ProcessName, [string]$Page)
      $script:DefaultNavigationName = $ProcessName
      $script:DefaultNavigationPage = $Page
      $script:BrowserActionOrder += "default-navigate"
      return $true
    }
    Open-RoToolExtensionsPage -Browser "chrome" -StartProcessAction $startBrowserHook -WindowAction $focusBrowserHook
  } finally {
    Set-Item -LiteralPath Function:\Set-RoToolBrowserInternalPage -Value $realNavigationFunction
  }
  Assert-Equal $script:BrowserOpenCount 1 "default navigation path uses one browser launch"
  Assert-Equal $script:DefaultNavigationName "chrome" "default navigation receives the verified browser process"
  Assert-Equal $script:DefaultNavigationPage "chrome://extensions/" "default navigation receives the exact Chrome extensions page"
  Assert-SequenceEqual $script:BrowserActionOrder @("start", "focus", "default-navigate") "default navigation runs only after verified focus"

  # A focus failure must fail closed: no key/address action and no fallback
  # browser launch that could leave another blank window behind.
  $script:BrowserOpenCount = 0
  $script:BrowserNavigationCount = 0
  $failedFocusHook = { param([string]$ProcessName) return $false }
  $unexpectedNavigateHook = {
    param([string]$ProcessName, [string]$Page)
    $script:BrowserNavigationCount += 1
    return $true
  }
  Open-RoToolExtensionsPage -Browser "edge" -StartProcessAction $startBrowserHook -WindowAction $failedFocusHook -NavigateAction $unexpectedNavigateHook
  Assert-Equal $script:BrowserOpenCount 1 "failed focus does not trigger a second browser launch"
  Assert-Equal $script:BrowserNavigationCount 0 "failed foreground verification sends no browser address"

  $script:BrowserOpenCount = 0
  $failedNavigationHook = { param([string]$ProcessName, [string]$Page) return $false }
  Open-RoToolExtensionsPage -Browser "chrome" -StartProcessAction $startBrowserHook -WindowAction $focusBrowserHook -NavigateAction $failedNavigationHook
  Assert-Equal $script:BrowserOpenCount 1 "failed navigation does not trigger a fallback browser launch"
  Assert-Throws { Set-RoToolBrowserInternalPage -ProcessName "chrome" -Page "edge://extensions/" } "unexpected browser address" "address entry rejects a page that does not match the verified browser"

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

  # The replaceable updater core is a separate strict package. The stable CMD
  # launcher and local browser/repository configuration are never overwritten.
  $updaterArchiveRoot = Join-Path $fixtureRoot "updater-archives"
  [void](New-Item -ItemType Directory -Path $updaterArchiveRoot)
  $updaterEntries = @(
    [PSCustomObject]@{ Name = "Update-RoTool.ps1"; Content = '$script:UpdaterVersion = "2.0.0"'; ExternalAttributes = $null },
    [PSCustomObject]@{ Name = "README.md"; Content = "new updater docs"; ExternalAttributes = $null },
    [PSCustomObject]@{ Name = "package-files.json"; Content = '["manifest.json"]'; ExternalAttributes = $null }
  )
  $safeUpdaterZip = Join-Path $updaterArchiveRoot "safe-updater.zip"
  New-TestZip -Path $safeUpdaterZip -Entries $updaterEntries
  $safeUpdaterDestination = Join-Path $updaterArchiveRoot "safe-expanded"
  Assert-Equal (Expand-RoToolValidatedUpdaterPackage -PackagePath $safeUpdaterZip -Destination $safeUpdaterDestination) "2.0.0" "strict updater package returns its declared version"
  Assert-SequenceEqual @((Get-ChildItem -LiteralPath $safeUpdaterDestination -File | ForEach-Object Name) | Sort-Object) @("package-files.json", "README.md", "Update-RoTool.ps1") "strict updater package extracts exactly its core allowlist"

  $extraUpdaterZip = Join-Path $updaterArchiveRoot "extra-updater.zip"
  New-TestZip -Path $extraUpdaterZip -Entries @($updaterEntries + [PSCustomObject]@{ Name = "updater.config.json"; Content = '{"browser":"edge"}'; ExternalAttributes = $null })
  Assert-Throws {
    [void](Expand-RoToolValidatedUpdaterPackage -PackagePath $extraUpdaterZip -Destination (Join-Path $updaterArchiveRoot "extra-expanded"))
  } "unexpected|unsafe" "updater package cannot overwrite local configuration"
  $traversalUpdaterZip = Join-Path $updaterArchiveRoot "traversal-updater.zip"
  New-TestZip -Path $traversalUpdaterZip -Entries @($updaterEntries + [PSCustomObject]@{ Name = "../Update RoTool.cmd"; Content = "bad"; ExternalAttributes = $null })
  Assert-Throws {
    [void](Expand-RoToolValidatedUpdaterPackage -PackagePath $traversalUpdaterZip -Destination (Join-Path $updaterArchiveRoot "traversal-expanded"))
  } "unexpected|unsafe" "updater package cannot traverse into the stable launcher"

  $installedUpdaterRoot = Join-Path $fixtureRoot "installed-updater"
  $stagedUpdaterRoot = Join-Path $fixtureRoot "staged-updater"
  $updaterStateRoot = Join-Path $fixtureRoot "updater-state"
  New-TestUpdaterCore -Root $installedUpdaterRoot -Version "1.0.0" -Marker "old"
  New-TestUpdaterCore -Root $stagedUpdaterRoot -Version "1.1.0" -Marker "new"
  Write-Utf8File -Path (Join-Path $installedUpdaterRoot "Update RoTool.cmd") -Value "stable launcher"
  Write-Utf8File -Path (Join-Path $installedUpdaterRoot "updater.config.json") -Value '{"repository":"friend/repo","browser":"chrome","configVersion":2}'
  $updaterInstallResult = Install-RoToolUpdaterCore -UpdaterRoot $installedUpdaterRoot -StagingRoot $stagedUpdaterRoot -StateRoot $updaterStateRoot -RunningVersion "1.0.0"
  Assert-True ([bool]$updaterInstallResult.Updated) "newer updater core is installed"
  Assert-Equal (Get-RoToolUpdaterVersionFromFile (Join-Path $installedUpdaterRoot "Update-RoTool.ps1")) "1.1.0" "installed updater advances to staged version"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $installedUpdaterRoot "Update RoTool.cmd")) "stable launcher" "updater refresh preserves the CMD launcher"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $installedUpdaterRoot "updater.config.json")) '{"repository":"friend/repo","browser":"chrome","configVersion":2}' "updater refresh preserves local configuration bytes"
  Assert-Equal ([string](Get-Content -Raw -LiteralPath (Join-Path $updaterStateRoot "updater-journal.json") | ConvertFrom-Json).status) "completed" "updater refresh journal completes"

  $identicalUpdaterResult = Install-RoToolUpdaterCore -UpdaterRoot $installedUpdaterRoot -StagingRoot $stagedUpdaterRoot -StateRoot $updaterStateRoot -RunningVersion "1.1.0"
  Assert-True (-not [bool]$identicalUpdaterResult.Updated) "byte-identical updater core is a safe no-op"
  $differentSameVersionUpdaterRoot = Join-Path $fixtureRoot "different-same-version-updater"
  New-TestUpdaterCore -Root $differentSameVersionUpdaterRoot -Version "1.1.0" -Marker "different-build-bytes"
  Assert-Throws {
    [void](Install-RoToolUpdaterCore -UpdaterRoot $installedUpdaterRoot -StagingRoot $differentSameVersionUpdaterRoot -StateRoot $updaterStateRoot -RunningVersion "1.1.0")
  } "differs without a newer updater version" "different updater bytes require a newer updater version"
  $olderUpdaterRoot = Join-Path $fixtureRoot "older-updater"
  New-TestUpdaterCore -Root $olderUpdaterRoot -Version "1.0.0" -Marker "older"
  Assert-Throws {
    [void](Install-RoToolUpdaterCore -UpdaterRoot $installedUpdaterRoot -StagingRoot $olderUpdaterRoot -StateRoot $updaterStateRoot -RunningVersion "1.1.0")
  } "older than running updater" "updater core cannot downgrade itself"

  # Force the final script replacement to fail after the earlier core files
  # were replaced. Rollback must restore all core bytes without touching the
  # stable launcher or local configuration.
  $rollbackUpdaterRoot = Join-Path $fixtureRoot "rollback-updater"
  $rollbackUpdaterStaging = Join-Path $fixtureRoot "rollback-updater-staging"
  $rollbackUpdaterState = Join-Path $fixtureRoot "rollback-updater-state"
  New-TestUpdaterCore -Root $rollbackUpdaterRoot -Version "2.0.0" -Marker "rollback-old"
  New-TestUpdaterCore -Root $rollbackUpdaterStaging -Version "2.1.0" -Marker "rollback-new"
  Write-Utf8File -Path (Join-Path $rollbackUpdaterRoot "Update RoTool.cmd") -Value "rollback stable launcher"
  Write-Utf8File -Path (Join-Path $rollbackUpdaterRoot "updater.config.json") -Value '{"repository":"rollback/repo","browser":"edge","configVersion":2}'
  $oldUpdaterScript = Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "Update-RoTool.ps1")
  $oldUpdaterReadme = Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "README.md")
  $oldUpdaterPackageFiles = Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "package-files.json")
  (Get-Item -LiteralPath (Join-Path $rollbackUpdaterRoot "Update-RoTool.ps1")).IsReadOnly = $true
  Assert-Throws {
    [void](Install-RoToolUpdaterCore -UpdaterRoot $rollbackUpdaterRoot -StagingRoot $rollbackUpdaterStaging -StateRoot $rollbackUpdaterState -RunningVersion "2.0.0")
  } "previous files were restored" "mid-apply updater failure reports rollback"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "Update-RoTool.ps1")) $oldUpdaterScript "updater rollback restores old script bytes"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "README.md")) $oldUpdaterReadme "updater rollback restores old README bytes"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "package-files.json")) $oldUpdaterPackageFiles "updater rollback restores old package definition bytes"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "Update RoTool.cmd")) "rollback stable launcher" "updater rollback leaves the CMD launcher untouched"
  Assert-Equal (Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterRoot "updater.config.json")) '{"repository":"rollback/repo","browser":"edge","configVersion":2}' "updater rollback leaves local configuration untouched"
  Assert-Equal ([string](Get-Content -Raw -LiteralPath (Join-Path $rollbackUpdaterState "updater-journal.json") | ConvertFrom-Json).status) "rolledBack" "mid-apply updater failure records rolledBack status"

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
  $updaterArchive = Join-Path $buildOne "RoTool-updater.zip"
  $setupArchive = Join-Path $buildOne "RoTool-setup.zip"
  Assert-SequenceEqual @((Get-ZipEntryNames $extensionArchive) | Sort-Object) $expectedRuntimeEntries "extension archive contains exactly the runtime allowlist"
  $expectedUpdaterEntries = @(
    "README.md",
    "Update-RoTool.ps1",
    "package-files.json"
  ) | Sort-Object
  Assert-SequenceEqual @((Get-ZipEntryNames $updaterArchive) | Sort-Object) $expectedUpdaterEntries "updater archive contains only replaceable updater core files"
  $expectedSetupEntries = @($expectedRuntimeEntries + @(
    "updater/README.md",
    "updater/Update RoTool.cmd",
    "updater/Update-RoTool.ps1",
    "updater/package-files.json",
    "updater/updater.config.json"
  ) | Sort-Object)
  Assert-SequenceEqual @((Get-ZipEntryNames $setupArchive) | Sort-Object) $expectedSetupEntries "setup archive adds only updater bootstrap files"
  $sourceUpdaterVersion = Get-RoToolUpdaterVersionFromFile (Join-Path $ProjectRoot "updater\Update-RoTool.ps1")
  $builtUpdaterScript = Read-ZipTextEntry -Path $updaterArchive -EntryName "Update-RoTool.ps1"
  $builtSetupUpdaterScript = Read-ZipTextEntry -Path $setupArchive -EntryName "updater/Update-RoTool.ps1"
  Assert-True ($builtUpdaterScript -cmatch "(?m)^\`$script:UpdaterVersion\s*=\s*\`"$([regex]::Escape($sourceUpdaterVersion))\`"\s*$") "updater archive declares the current source updater version"
  Assert-True ($builtSetupUpdaterScript -cmatch "(?m)^\`$script:UpdaterVersion\s*=\s*\`"$([regex]::Escape($sourceUpdaterVersion))\`"\s*$") "setup archive embeds the current source updater version"
  $embeddedConfiguration = Read-ZipTextEntry -Path $setupArchive -EntryName "updater/updater.config.json" | ConvertFrom-Json
  Assert-Equal ([string]$embeddedConfiguration.repository) "sample-owner/sample-repo" "setup archive embeds release repository"
  Assert-Equal ([string]$embeddedConfiguration.browser) "auto" "setup archive uses automatic browser detection"
  Assert-Equal ([int]$embeddedConfiguration.configVersion) 2 "setup archive embeds the current updater configuration schema"
  Assert-Equal (Get-RoToolFileSha256 $extensionArchive) (Get-RoToolFileSha256 (Join-Path $buildTwo "RoTool-extension.zip")) "extension package is reproducible"
  Assert-Equal (Get-RoToolFileSha256 $updaterArchive) (Get-RoToolFileSha256 (Join-Path $buildTwo "RoTool-updater.zip")) "updater package is reproducible"
  Assert-Equal (Get-RoToolFileSha256 $setupArchive) (Get-RoToolFileSha256 (Join-Path $buildTwo "RoTool-setup.zip")) "setup package is reproducible"

  foreach ($archiveName in @("RoTool-extension.zip", "RoTool-updater.zip", "RoTool-setup.zip")) {
    $archivePath = Join-Path $buildOne $archiveName
    $publishedChecksum = Get-Content -Raw -LiteralPath "$archivePath.sha256"
    $actualHash = (Get-RoToolFileSha256 $archivePath).ToLowerInvariant()
    Assert-True ($publishedChecksum -cmatch "^$actualHash  $([regex]::Escape($archiveName))`n$") "$archiveName checksum names and hashes the matching asset"
  }

  # A normal same-version run still opens the extensions page so rerunning the
  # updater after a refresh leads directly to Reload. Check-only and the
  # explicit no-browser switch remain side-effect-free.
  Write-Utf8File -Path (Join-Path $fixtureRoot "manifest.json") -Value (New-TestManifestJson $version)
  Write-Utf8File -Path (Join-Path $copiedUpdater "updater.config.json") -Value '{"configVersion":2,"repository":"sample-owner/sample-repo","browser":"chrome"}'
  $oldLocalAppData = $env:LOCALAPPDATA
  $env:LOCALAPPDATA = Join-Path $fixtureRoot "same-version-state"
  $script:OpenedBrowserCount = 0
  $script:OpenedBrowserName = ""
  function Get-RoToolLatestRelease {
    param([string]$ValidatedRepository)
    return [PSCustomObject]@{ Version = $version }
  }
  function Open-RoToolExtensionsPage {
    param([string]$Browser)
    $script:OpenedBrowserCount += 1
    $script:OpenedBrowserName = $Browser
  }
  try {
    Invoke-RoToolUpdater -DoNotRefreshUpdater -DoNotPrompt
    Assert-Equal $script:OpenedBrowserCount 1 "normal same-version run opens the extensions page"
    Assert-Equal $script:OpenedBrowserName "chrome" "normal same-version run honors explicit schema-2 browser selection"
    Invoke-RoToolUpdater -DoNotRefreshUpdater -DoNotPrompt -OnlyCheck
    Assert-Equal $script:OpenedBrowserCount 1 "check-only same-version run does not open a browser"
    Invoke-RoToolUpdater -DoNotRefreshUpdater -DoNotPrompt -DoNotOpenBrowser
    Assert-Equal $script:OpenedBrowserCount 1 "no-browser same-version run does not open a browser"
  } finally {
    $env:LOCALAPPDATA = $oldLocalAppData
  }

  Write-Output "PASS RoTool GitHub updater safety and release fixture ($script:AssertionCount assertions)"
} finally {
  if (Test-Path -LiteralPath $fixtureRoot -PathType Container) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
