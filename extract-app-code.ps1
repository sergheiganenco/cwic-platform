# Application Code Only Extractor
# Extracts only business logic and application code, excluding system files

param(
    [string]$OutputFile = "cwic-app-code-only.txt",
    [switch]$BackendOnly = $false
)

# Clear the output file
"" | Out-File -FilePath $OutputFile -Encoding UTF8

# Function to write section header
function Write-SectionHeader {
    param([string]$Title)
    
    "`n" + "=" * 100 | Add-Content -Path $OutputFile -Encoding UTF8
    "  $Title" | Add-Content -Path $OutputFile -Encoding UTF8
    "=" * 100 | Add-Content -Path $OutputFile -Encoding UTF8
    "" | Add-Content -Path $OutputFile -Encoding UTF8
}

# Function to write file header
function Write-FileHeader {
    param([string]$FilePath)
    
    "`n" + "-" * 60 | Add-Content -Path $OutputFile -Encoding UTF8
    "FILE: $FilePath" | Add-Content -Path $OutputFile -Encoding UTF8
    "-" * 60 | Add-Content -Path $OutputFile -Encoding UTF8
}

# Function to add file content safely
function Add-FileContent {
    param([string]$FilePath)
    
    try {
        if (Test-Path $FilePath -PathType Leaf) {
            $fileSize = (Get-Item $FilePath).Length
            
            # Skip very large files
            if ($fileSize -gt 500KB) {
                "# File too large (>500KB) - skipped" | Add-Content -Path $OutputFile -Encoding UTF8
                return
            }
            
            try {
                $content = Get-Content $FilePath -Raw -ErrorAction Stop
                if ($content) {
                    $content | Add-Content -Path $OutputFile -Encoding UTF8
                } else {
                    "# Empty file" | Add-Content -Path $OutputFile -Encoding UTF8
                }
            }
            catch {
                "# Encoding issue - skipped" | Add-Content -Path $OutputFile -Encoding UTF8
            }
        }
    }
    catch {
        "# Error reading file: $($_.Exception.Message)" | Add-Content -Path $OutputFile -Encoding UTF8
    }
    
    "" | Add-Content -Path $OutputFile -Encoding UTF8
}

# APPLICATION-SPECIFIC FILE EXTENSIONS ONLY
$appExtensions = @(
    "*.ts", "*.tsx", "*.js", "*.jsx"  # Source code only
)

# SYSTEM/TOOLING FILES TO EXCLUDE
$excludeFiles = @(
    "package.json", "package-lock.json", "yarn.lock",
    "tsconfig.json", "vite.config.*", "vitest.config.*",
    "tailwind.config.*", "postcss.config.*", 
    "eslint.config.*", ".eslintrc.*",
    "prettier.config.*", ".prettierrc*",
    "jest.config.*", "babel.config.*",
    "webpack.config.*", "rollup.config.*",
    "Dockerfile*", "docker-compose.*",
    ".env*", ".gitignore", ".gitattributes",
    "README.md", "CHANGELOG.md", "LICENSE",
    "*.lock", "*.log"
)

# DIRECTORIES TO COMPLETELY EXCLUDE
$excludeDirs = @(
    "node_modules", ".git", "dist", "build", ".next",
    "coverage", ".nyc_output", "logs", "tmp", "temp",
    ".vscode", ".idea", "public", "assets", "static"
)

# FILES THAT ARE DEFINITELY SYSTEM/CONFIG (exclude by name patterns)
$systemFilePatterns = @(
    "*config*", "*Config*", "*.config.*",
    "setup*", "Setup*", "*setup*",
    "index.html", "favicon.*", "robots.txt",
    "manifest.json", "sw.js", "service-worker.js"
)

Write-Host "Extracting application code only (excluding system files)..."
Write-Host "Output file: $OutputFile"

# Write header
if ($BackendOnly) {
    Write-SectionHeader "CWIC PLATFORM - BACKEND APPLICATION CODE ONLY"
} else {
    Write-SectionHeader "CWIC PLATFORM - APPLICATION CODE ONLY"
}
"Generated on: $(Get-Date)" | Add-Content -Path $OutputFile -Encoding UTF8
"Includes: Business logic, API routes, components, services, models" | Add-Content -Path $OutputFile -Encoding UTF8
"Excludes: Config files, build tools, dependencies, assets" | Add-Content -Path $OutputFile -Encoding UTF8
"" | Add-Content -Path $OutputFile -Encoding UTF8

# Function to check if file should be excluded
function Should-ExcludeFile {
    param([string]$fileName, [string]$filePath)
    
    # Check against exclude file patterns
    foreach ($pattern in $excludeFiles) {
        if ($fileName -like $pattern) { return $true }
    }
    
    # Check against system file patterns
    foreach ($pattern in $systemFilePatterns) {
        if ($fileName -like $pattern) { return $true }
    }
    
    # Exclude test files
    if ($fileName -like "*test*" -or $fileName -like "*.test.*" -or $fileName -like "*.spec.*") {
        return $true
    }
    
    # Exclude mock files
    if ($fileName -like "*mock*" -or $fileName -like "*.mock.*") {
        return $true
    }
    
    return $false
}

# BACKEND SERVICES
$backendServices = @(
    "backend/api-gateway",
    "backend/auth-service", 
    "backend/data-service",
    "backend/ai-service",
    "backend/pipeline-service",
    "backend/notification-service",
    "backend/integration-service"
)

foreach ($service in $backendServices) {
    if (Test-Path $service) {
        $serviceName = ($service -split "/")[-1].Replace("-", " ").ToUpper()
        Write-SectionHeader "$serviceName - APPLICATION CODE"
        
        # Focus on src directory for application code
        $srcPath = Join-Path $service "src"
        if (Test-Path $srcPath) {
            Get-ChildItem -Path $srcPath -Recurse -File |
            Where-Object { 
                # Must be an application file extension
                $hasAppExt = $false
                foreach ($ext in $appExtensions) {
                    if ($_.Name -like $ext) { $hasAppExt = $true; break }
                }
                
                # Must not be in excluded directories
                $inExcludedDir = $false
                foreach ($dir in $excludeDirs) {
                    if ($_.FullName -like "*\$dir\*") { $inExcludedDir = $true; break }
                }
                
                # Must not be a system file
                $isSystemFile = Should-ExcludeFile $_.Name $_.FullName
                
                $hasAppExt -and -not $inExcludedDir -and -not $isSystemFile
            } |
            Sort-Object FullName |
            ForEach-Object {
                $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
                Write-FileHeader $relativePath
                Add-FileContent $_.FullName
            }
        }
    }
}

# FRONTEND APPLICATION CODE (if not backend-only)
if (-not $BackendOnly) {
    Write-SectionHeader "FRONTEND - APPLICATION CODE"
    
    $frontendSrcPath = "frontend/src"
    if (Test-Path $frontendSrcPath) {
        Get-ChildItem -Path $frontendSrcPath -Recurse -File |
        Where-Object { 
            # Must be an application file extension
            $hasAppExt = $false
            foreach ($ext in $appExtensions) {
                if ($_.Name -like $ext) { $hasAppExt = $true; break }
            }
            
            # Must not be in excluded directories
            $inExcludedDir = $false
            foreach ($dir in $excludeDirs) {
                if ($_.FullName -like "*\$dir\*") { $inExcludedDir = $true; break }
            }
            
            # Must not be a system file
            $isSystemFile = Should-ExcludeFile $_.Name $_.FullName
            
            $hasAppExt -and -not $inExcludedDir -and -not $isSystemFile
        } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
            Write-FileHeader $relativePath
            Add-FileContent $_.FullName
        }
    }
}

# SUMMARY
Write-SectionHeader "CODE EXTRACTION SUMMARY"

"INCLUDED FILE TYPES:" | Add-Content -Path $OutputFile -Encoding UTF8
$appExtensions | ForEach-Object { "  - $_" | Add-Content -Path $OutputFile -Encoding UTF8 }

"" | Add-Content -Path $OutputFile -Encoding UTF8
"EXCLUDED SYSTEM FILES:" | Add-Content -Path $OutputFile -Encoding UTF8
$excludeFiles | ForEach-Object { "  - $_" | Add-Content -Path $OutputFile -Encoding UTF8 }

"" | Add-Content -Path $OutputFile -Encoding UTF8
"EXCLUDED DIRECTORIES:" | Add-Content -Path $OutputFile -Encoding UTF8
$excludeDirs | ForEach-Object { "  - $_" | Add-Content -Path $OutputFile -Encoding UTF8 }

Write-Host ""
Write-Host "Application code extraction completed!"
Write-Host "Output file: $OutputFile"
Write-Host "File size: $((Get-Item $OutputFile).Length / 1KB) KB"

$totalLines = (Get-Content $OutputFile | Measure-Object -Line).Lines
Write-Host "Total lines: $totalLines"

Write-Host ""
Write-Host "Pure application code saved to '$OutputFile'"