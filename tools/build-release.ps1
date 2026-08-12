[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\dist"),
  [string]$Repository = "Kais80r/RoTool-Extension",
  [string]$ExpectedTag = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$packageDefinition = Join-Path $root "updater\package-files.json"
$packageFiles = @((Get-Content -Raw -LiteralPath $packageDefinition | ConvertFrom-Json))
$manifest = Get-Content -Raw -LiteralPath (Join-Path $root "manifest.json") | ConvertFrom-Json
$version = [string]$manifest.version

if ($manifest.name -ne "RoTool" -or [int]$manifest.manifest_version -ne 3) {
  throw "Release manifest must describe RoTool Manifest V3."
}
if ($version -notmatch '^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,3}$') {
  throw "Manifest version is not a valid browser extension version: $version"
}
if (-not [string]::IsNullOrWhiteSpace($ExpectedTag) -and $ExpectedTag -ne "v$version") {
  throw "Release tag $ExpectedTag does not match manifest version v$version."
}
if ($Repository -ne "OWNER/REPOSITORY") {
  $repositoryParts = @($Repository.Split("/"))
  if (
    $repositoryParts.Count -ne 2 -or
    $repositoryParts[0] -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$' -or
    $repositoryParts[1] -notmatch '^[A-Za-z0-9_.-]+$' -or
    $repositoryParts[1] -in @(".", "..")
  ) {
    throw "Repository must use OWNER/REPOSITORY."
  }
}

$seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($relative in $packageFiles) {
  if ($relative -isnot [string]) { throw "Package paths must be text." }
  $relative = $relative.Replace("\", "/")
  if (
    [string]::IsNullOrWhiteSpace($relative) -or
    $relative.StartsWith("/") -or
    $relative.Contains(":") -or
    $relative.Split("/") -contains ".." -or
    -not $seen.Add($relative)
  ) {
    throw "Unsafe or duplicate package path: $relative"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {
    throw "Release input is missing: $relative"
  }
}
if ($packageFiles.Count -ne 18) {
  throw "The RoTool runtime package must contain exactly 18 managed files."
}

if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
  [void](New-Item -ItemType Directory -Path $OutputDirectory -Force)
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$extensionArchive = Join-Path $OutputDirectory "RoTool-extension.zip"
$setupArchive = Join-Path $OutputDirectory "RoTool-setup.zip"
$extensionChecksum = "$extensionArchive.sha256"
$setupChecksum = "$setupArchive.sha256"
foreach ($output in @($extensionArchive, $setupArchive, $extensionChecksum, $setupChecksum)) {
  if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Force
  }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fixedTimestamp = [DateTimeOffset]::new(2020, 1, 1, 0, 0, 0, [TimeSpan]::Zero)

function Add-FileToArchive {
  param(
    [Parameter(Mandatory = $true)][IO.Compression.ZipArchive]$Archive,
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$EntryName
  )

  $entry = $Archive.CreateEntry($EntryName.Replace("\", "/"), [IO.Compression.CompressionLevel]::Optimal)
  $entry.LastWriteTime = $fixedTimestamp
  $inputStream = [IO.File]::OpenRead($Source)
  $outputStream = $entry.Open()
  try {
    $inputStream.CopyTo($outputStream)
  } finally {
    $outputStream.Dispose()
    $inputStream.Dispose()
  }
}

function New-RoToolArchive {
  param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][object[]]$Entries
  )

  $stream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    foreach ($item in ($Entries | Sort-Object Entry)) {
      Add-FileToArchive -Archive $archive -Source $item.Source -EntryName $item.Entry
    }
  } finally {
    $archive.Dispose()
    $stream.Dispose()
  }
}

$runtimeEntries = @($packageFiles | ForEach-Object {
  [PSCustomObject]@{
    Source = Join-Path $root $_
    Entry = $_.Replace("\", "/")
  }
})
New-RoToolArchive -Destination $extensionArchive -Entries $runtimeEntries

$setupScratch = Join-Path $OutputDirectory ".rotool-setup-$([Guid]::NewGuid().ToString('N'))"
[void](New-Item -ItemType Directory -Path $setupScratch)
try {
  $generatedConfig = Join-Path $setupScratch "updater.config.json"
  $configJson = [ordered]@{ repository = $Repository; browser = "edge" } | ConvertTo-Json
  [IO.File]::WriteAllText($generatedConfig, $configJson + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))

  $updaterEntries = @(
    [PSCustomObject]@{ Source = (Join-Path $root "updater\Update-RoTool.ps1"); Entry = "updater/Update-RoTool.ps1" },
    [PSCustomObject]@{ Source = (Join-Path $root "updater\Update RoTool.cmd"); Entry = "updater/Update RoTool.cmd" },
    [PSCustomObject]@{ Source = (Join-Path $root "updater\README.md"); Entry = "updater/README.md" },
    [PSCustomObject]@{ Source = $packageDefinition; Entry = "updater/package-files.json" },
    [PSCustomObject]@{ Source = $generatedConfig; Entry = "updater/updater.config.json" }
  )
  New-RoToolArchive -Destination $setupArchive -Entries @($runtimeEntries + $updaterEntries)
} finally {
  if (Test-Path -LiteralPath $setupScratch -PathType Container) {
    Remove-Item -LiteralPath $setupScratch -Recurse -Force
  }
}

function Write-ChecksumFile {
  param([string]$File, [string]$Destination)
  $name = Split-Path -Leaf $File
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $File).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText($Destination, "$hash  $name`n", (New-Object Text.UTF8Encoding($false)))
}

Write-ChecksumFile -File $extensionArchive -Destination $extensionChecksum
Write-ChecksumFile -File $setupArchive -Destination $setupChecksum

$archive = [IO.Compression.ZipFile]::OpenRead($extensionArchive)
try {
  $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
  if ($entryNames.Count -ne $packageFiles.Count) {
    throw "Built extension archive has an unexpected entry count."
  }
  foreach ($relative in $packageFiles) {
    if ($entryNames -cnotcontains $relative.Replace("\", "/")) {
      throw "Built extension archive is missing $relative."
    }
  }
} finally {
  $archive.Dispose()
}

[PSCustomObject]@{
  Version = $version
  Repository = $Repository
  ExtensionArchive = $extensionArchive
  SetupArchive = $setupArchive
  ExtensionSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $extensionArchive).Hash
  SetupSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $setupArchive).Hash
}
