<#
.SYNOPSIS
  MagicTrainer dev-box bootstrap (Windows 10/11). Run from an ADMIN PowerShell.
  Installs Git, Node LTS, Rust (rustup), MSVC C++ Build Tools, WebView2, Claude Code;
  clones/updates the repo; installs JS deps; runs tests; fetches bulk MTG data (optional);
  writes the Claude launch shortcut. Idempotent - safe to re-run.

.PARAMETER RepoUrl   Git remote (default: William's GitHub repo).
.PARAMETER Dest      Local clone path (default: %USERPROFILE%\Code\MagicTrainer).
.PARAMETER SkipData  Skip the multi-hundred-MB bulk data download.
.PARAMETER SkipBuildTools  Skip MSVC Build Tools install (if you already have Visual Studio C++).

.EXAMPLE
  Set-ExecutionPolicy -Scope Process Bypass -Force; .\setup-magictrainer.ps1
#>
[CmdletBinding()]
param(
  [string]$RepoUrl = "https://github.com/WilliamFischer02/MagicTrainer.git",
  [string]$Dest = (Join-Path $env:USERPROFILE "Code\MagicTrainer"),
  [switch]$SkipData,
  [switch]$SkipBuildTools
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "   OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "   !!  $m" -ForegroundColor Yellow }
function Has($cmd) { $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }
function Winget($id, $extra = @()) {
  if (-not (Has winget)) { throw "winget not found. Install 'App Installer' from the Microsoft Store, then re-run." }
  $args = @("install","--id",$id,"-e","--accept-source-agreements","--accept-package-agreements","--silent") + $extra
  & winget @args | Out-Host
  RefreshPath
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this script from an elevated (Administrator) PowerShell - Build Tools and WebView2 need it." }
Write-Host "MagicTrainer setup - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Magenta

# ---- 1. Git ----
Step "Git for Windows (gives Claude Code its Bash tool)"
if (Has git) { Ok (git --version) } else { Winget "Git.Git"; Ok "installed" }

# ---- 2. Node LTS ----
Step "Node.js LTS"
if (Has node) { Ok "node $(node -v) / npm $(npm -v)" } else { Winget "OpenJS.NodeJS.LTS"; Ok "installed" }

# ---- 3. MSVC Build Tools (Tauri prerequisite) ----
Step "Microsoft C++ Build Tools (Desktop development with C++)"
if ($SkipBuildTools) { Warn "skipped by flag" }
else {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  $haveCpp = (Test-Path $vswhere) -and ((& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath) -ne $null)
  if ($haveCpp) { Ok "C++ toolchain present" }
  else {
    Winget "Microsoft.VisualStudio.2022.BuildTools" @("--override","--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended")
    Ok "Build Tools installed (a reboot may be required before first cargo build)"
  }
}

# ---- 4. WebView2 runtime ----
Step "Microsoft Edge WebView2 Runtime"
$wv2 = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
if ($wv2) { Ok "present ($($wv2.pv))" } else { Winget "Microsoft.EdgeWebView2Runtime"; Ok "installed" }

# ---- 5. Rust ----
Step "Rust (rustup, stable-msvc)"
if (Has cargo) { Ok (cargo --version) } else { Winget "Rustlang.Rustup"; RefreshPath; & rustup default stable-x86_64-pc-windows-msvc | Out-Host; Ok "installed" }

# ---- 6. Claude Code ----
Step "Claude Code"
if (Has claude) { Ok (claude --version) }
else {
  try { Winget "Anthropic.ClaudeCode"; Ok "installed via winget" }
  catch { Warn "winget failed; using native installer"; irm https://claude.ai/install.ps1 | iex; RefreshPath; Ok "installed via install.ps1" }
}
Warn "Note: winget installs of Claude Code don't auto-update - run 'winget upgrade Anthropic.ClaudeCode' periodically."

# ---- 7. Repo ----
Step "Repository -> $Dest"
if (Test-Path (Join-Path $Dest ".git")) { Push-Location $Dest; git pull --ff-only | Out-Host; Pop-Location; Ok "updated" }
elseif (Test-Path (Join-Path $Dest "CLAUDE.md")) { Ok "found unpacked repo (not yet a git repo)"; Push-Location $Dest; if (-not (Test-Path .git)) { git init -b main | Out-Host; git add -A; git commit -qm "chore: initial MagicTrainer bootstrap" ; git remote add origin $RepoUrl 2>$null }; Pop-Location }
else { New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null; git clone $RepoUrl $Dest | Out-Host; Ok "cloned" }

# ---- 8. JS deps + tests ----
Step "npm install + tests (app/)"
Push-Location (Join-Path $Dest "app")
npm install --no-audit --no-fund | Out-Host
npm test | Out-Host
Pop-Location
Ok "core tests green"

# ---- 9. Bulk data ----
Step "Bulk MTG data (Scryfall / Commander Spellbook / MTGJSON)"
if ($SkipData) { Warn "skipped - run scripts\fetch-data.ps1 later" }
else { & (Join-Path $Dest "scripts\fetch-data.ps1") -Dest (Join-Path $Dest "data") }

# ---- 10. Launch shortcut ----
Step "Launch helper"
$launch = Join-Path $Dest "scripts\launch-agent.ps1"
Ok "Start the agent with:  powershell -ExecutionPolicy Bypass -File `"$launch`""
Write-Host "`nDone. First run of the agent: it will read AGENT_STARTUP_PROMPT.md and verify 'npm run tauri dev' builds." -ForegroundColor Magenta
Write-Host "If Build Tools were just installed, reboot before the first 'cargo build'." -ForegroundColor Yellow
