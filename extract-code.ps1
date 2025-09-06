# Backend-Only Code Extractor for CWIC Platform
# This script extracts only backend service code

param(
    [string]$OutputFile = "cwic-backend-code.txt"
)

# Clear the output file
"" | Out-File -FilePath $OutputFile -Encoding UTF8

# Function to write section header
function Write-SectionHeader {
    param([string]$Title)
    
    "`n" + "=" * 120 | Add-Content -Path $OutputFile -Encoding UTF8
    "  $Title" | Add-Content -Path $OutputFile -Encoding UTF8
    "=" * 120 | Add-Content -Path $OutputFile -Encoding UTF8
    "" | Add-Content -Path $OutputFile -Encoding UTF8
}

# Function to write file header
function Write-FileHeader {
    param([string]$FilePath)
    
    "`n" + "-" * 80 | Add-Content -Path $OutputFile -Encoding UTF8
    "FILE: $FilePath" | Add-Content -Path $OutputFile -Encoding UTF8
    "-" * 80 | Add-Content -Path $OutputFile -Encoding UTF8
}

# Function to add file content safely
function Add-FileContent {
    param([string]$FilePath)
    
    try {
        if (Test-Path $FilePath -PathType Leaf) {
            $fileSize = (Get-Item $FilePath).Length
            
            # Skip binary files and very large files (>1MB)
            if ($fileSize -gt 1MB) {
                "# File too large (>1MB) - skipped" | Add-Content -Path $OutputFile -Encoding UTF8
                return
            }
            
            # Try to read as text
            try {
                $content = Get-Content $FilePath -Raw -ErrorAction Stop
                if ($content) {
                    $content | Add-Content -Path $OutputFile -Encoding UTF8
                } else {
                    "# Empty file" | Add-Content -Path $OutputFile -Encoding UTF8
                }
            }
            catch {
                "# Binary file or encoding issue - skipped" | Add-Content -Path $OutputFile -Encoding UTF8
            }
        }
    }
    catch {
        "# Error reading file: $($_.Exception.Message)" | Add-Content -Path $OutputFile -Encoding UTF8
    }
    
    "" | Add-Content -Path $OutputFile -Encoding UTF8
}

# Define file extensions to include
$codeExtensions = @(
    "*.ts", "*.js", "*.json", 
    "*.env*", "*.md", "*.txt",
    "Dockerfile*", "*.yml", "*.yaml"
)

# Define directories to exclude
$excludeDirs = @(
    "node_modules", ".git", "dist", "build", 
    "coverage", ".nyc_output", "logs", "tmp", "temp"
)

Write-Host "Extracting backend code for CWIC Platform..."
Write-Host "Output file: $OutputFile"

# Write header
Write-SectionHeader "CWIC PLATFORM - BACKEND SERVICES CODE"
"Generated on: $(Get-Date)" | Add-Content -Path $OutputFile -Encoding UTF8
"Backend services only - excluding frontend" | Add-Content -Path $OutputFile -Encoding UTF8
"" | Add-Content -Path $OutputFile -Encoding UTF8

# 1. ROOT CONFIGURATION (relevant to backend)
Write-SectionHeader "ROOT CONFIGURATION FILES"

$rootFiles = @(
    "docker-compose.yml", 
    ".env", ".env.example",
    "package.json"
)

foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Write-FileHeader $file
        Add-FileContent $file
    }
}

# 2. BACKEND SERVICES
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
        $serviceName = ($service -split "/")[-1].ToUpper()
        Write-SectionHeader "BACKEND SERVICE: $serviceName"
        
        Get-ChildItem -Path $service -Recurse -File |
        Where-Object { 
            $include = $false
            foreach ($ext in $codeExtensions) {
                if ($_.Name -like $ext) { $include = $true; break }
            }
            $exclude = $false
            foreach ($dir in $excludeDirs) {
                if ($_.FullName -like "*\$dir\*") { $exclude = $true; break }
            }
            $include -and -not $exclude
        } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
            Write-FileHeader $relativePath
            Add-FileContent $_.FullName
        }
    }
}

# 3. DATABASE SCRIPTS
Write-SectionHeader "DATABASE SCRIPTS"

if (Test-Path "database") {
    Get-ChildItem -Path "database" -Recurse -File -Include "*.sql", "*.js", "*.ts", "*.json" |
    Sort-Object FullName |
    ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        Write-FileHeader $relativePath
        Add-FileContent $_.FullName
    }
}

# 4. BACKEND-RELATED INFRASTRUCTURE
Write-SectionHeader "BACKEND INFRASTRUCTURE"

$backendInfraPaths = @("scripts", "database", "infrastructure")
foreach ($path in $backendInfraPaths) {
    if (Test-Path $path) {
        Get-ChildItem -Path $path -Recurse -File |
        Where-Object { 
            $include = $false
            foreach ($ext in $codeExtensions) {
                if ($_.Name -like $ext) { $include = $true; break }
            }
            $include
        } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
            Write-FileHeader $relativePath
            Add-FileContent $_.FullName
        }
    }
}

# 5. BACKEND DIRECTORY STRUCTURE
Write-SectionHeader "BACKEND DIRECTORY STRUCTURE"

"BACKEND SERVICES STRUCTURE:" | Add-Content -Path $OutputFile -Encoding UTF8
Get-ChildItem -Path "backend" -Recurse -Directory | 
Where-Object { 
    $exclude = $false
    foreach ($dir in $excludeDirs) {
        if ($_.FullName -like "*\$dir*") { $exclude = $true; break }
    }
    -not $exclude
} |
Sort-Object FullName |
ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
    "  [DIR] $relativePath" | Add-Content -Path $OutputFile -Encoding UTF8
}

"" | Add-Content -Path $OutputFile -Encoding UTF8
"BACKEND FILE TYPES INCLUDED:" | Add-Content -Path $OutputFile -Encoding UTF8
$codeExtensions | ForEach-Object { "  - $_" | Add-Content -Path $OutputFile -Encoding UTF8 }

"" | Add-Content -Path $OutputFile -Encoding UTF8
"EXCLUDED DIRECTORIES:" | Add-Content -Path $OutputFile -Encoding UTF8
$excludeDirs | ForEach-Object { "  - $_" | Add-Content -Path $OutputFile -Encoding UTF8 }

Write-Host ""
Write-Host "Backend code extraction completed!"
Write-Host "Output file: $OutputFile"
Write-Host "File size: $((Get-Item $OutputFile).Length / 1KB) KB"

# Count lines of code
$totalLines = (Get-Content $OutputFile | Measure-Object -Line).Lines
Write-Host "Total lines: $totalLines"

Write-Host ""
Write-Host "Backend-only code saved to '$OutputFile' for review."