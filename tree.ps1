# export-tree.ps1
param(
  [string]$Root = ".",
  [string[]]$ExcludeDirs = @('node_modules','.git','dist','build','.next','coverage','.vscode','.idea','.turbo','logs','tmp','temp'),
  [int]$MaxDepth = 0,                 # 0 = unlimited
  [switch]$IncludeFiles = $true,      # include files too
  [switch]$ShowSizes = $false,        # show file sizes
  [string]$OutFile = ".\ARCHITECTURE_TREE.txt"
)

# ASCII glyphs to avoid Unicode issues
$G = @{ V='|  '; T='|-- '; L='`-- '; S='   ' }

function Format-Size([Nullable[Int64]]$bytes) {
  if (-not $ShowSizes -or -not $bytes.HasValue) { return "" }
  $b = [Int64]$bytes
  if ($b -ge 1GB) { return " (" + [math]::Round($b/1GB,2) + " GB)" }
  if ($b -ge 1MB) { return " (" + [math]::Round($b/1MB,2) + " MB)" }
  if ($b -ge 1KB) { return " (" + [math]::Round($b/1KB,2) + " KB)" }
  return " (" + $b + " B)"
}

function Safe-Children([string]$path) {
  try {
    $c = Get-ChildItem -LiteralPath $path -Force -ErrorAction Stop
    if (-not $c) { return @() }
    return $c
  } catch {
    return @()  # swallow access errors and continue
  }
}

function Write-Tree {
  param(
    [System.IO.DirectoryInfo]$Dir,
    [string]$Prefix = "",
    [int]$Depth = 0
  )

  if ($MaxDepth -gt 0 -and $Depth -ge $MaxDepth) { return }

  $children = Safe-Children $Dir.FullName

  # Filter: exclude dirs by name; include files only if requested
  $filtered = foreach ($item in $children) {
    if ($null -eq $item) { continue }
    if ($item.PSIsContainer) {
      if ($ExcludeDirs -contains $item.Name) { continue }
      $item
    } else {
      if ($IncludeFiles) { $item }
    }
  }

  # Always force arrays to avoid op_Addition issues
  $dirs  = @($filtered | Where-Object PSIsContainer | Sort-Object Name)
  $files = @($filtered | Where-Object { -not $_.PSIsContainer } | Sort-Object Name)
  $all   = @()
  if ($dirs)  { $all += $dirs }
  if ($files) { $all += $files }

  for ($i = 0; $i -lt $all.Count; $i++) {
    $item = $all[$i]
    if ($null -eq $item) { continue }

    $isLast = ($i -eq $all.Count - 1)
    $twig = if ($isLast) { $G.L } else { $G.T }

    if ($item.PSIsContainer) {
      ($Prefix + $twig + $item.Name + "/") | Out-File $OutFile -Append -Encoding UTF8
      $nextPrefix = $Prefix + $( if ($isLast) { $G.S } else { $G.V } )
      Write-Tree -Dir $item -Prefix $nextPrefix -Depth ($Depth + 1)
    } else {
      # Use FileInfo.Length directly (no Get-Item)
      [Nullable[Int64]]$size = $null
      try { $size = $item.Length } catch { $size = $null }
      ($Prefix + $twig + $item.Name + (Format-Size $size)) | Out-File $OutFile -Append -Encoding UTF8
    }
  }
}

# Header
"" | Out-File $OutFile -Encoding UTF8
"ARCHITECTURE TREE: $(Resolve-Path $Root)" | Out-File $OutFile -Append -Encoding UTF8
"Generated: $(Get-Date -Format s)"          | Out-File $OutFile -Append -Encoding UTF8
"ExcludeDirs: $([string]::Join(', ',$ExcludeDirs))" | Out-File $OutFile -Append -Encoding UTF8
"IncludeFiles: $IncludeFiles  ShowSizes: $ShowSizes  MaxDepth: $MaxDepth" | Out-File $OutFile -Append -Encoding UTF8
"" | Out-File $OutFile -Append -Encoding UTF8

# Root + recurse
(Get-Item $Root).Name + "/" | Out-File $OutFile -Append -Encoding UTF8
Write-Tree -Dir (Get-Item $Root)

"Saved: $OutFile" | Out-File $OutFile -Append -Encoding UTF8
Write-Host "Saved: $OutFile"
