<#
.SYNOPSIS
  Capture the MagicTrainer window to a PNG without needing focus (PrintWindow with PW_RENDERFULLCONTENT).
.DESCRIPTION
  Unattended UI verification: `SetForegroundWindow` is denied for background agents, but PrintWindow
  renders a WebView2 window fine. Waits until the process has a visible main window.
.EXAMPLE
  pwsh scripts/screenshot-window.ps1 -Out .\shot.png
  pwsh scripts/screenshot-window.ps1 -Process magictrainer -Out C:\tmp\settings.png -TimeoutSec 60
#>
param(
  [string]$Process = "magictrainer",
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$TimeoutSec = 60
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint nFlags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$hwnd = [IntPtr]::Zero
while ((Get-Date) -lt $deadline) {
  $p = Get-Process -Name $Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p -and [Win32]::IsWindowVisible($p.MainWindowHandle)) {
    # Ignore transient tiny/helper windows (a 16x16 handle shows up while WebView2 initializes).
    $probe = New-Object Win32+RECT
    [void][Win32]::GetWindowRect($p.MainWindowHandle, [ref]$probe)
    if (($probe.Right - $probe.Left) -ge 400 -and ($probe.Bottom - $probe.Top) -ge 300) { $hwnd = $p.MainWindowHandle; break }
  }
  Start-Sleep -Milliseconds 500
}
if ($hwnd -eq [IntPtr]::Zero) { throw "No visible window for process '$Process' within $TimeoutSec s" }

$rect = New-Object Win32+RECT
[void][Win32]::GetWindowRect($hwnd, [ref]$rect)
$w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
if ($w -le 0 -or $h -le 0) { throw "Window has no size ($w x $h)" }

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
try {
  # 2 = PW_RENDERFULLCONTENT (needed for WebView2 / DirectComposition surfaces)
  $ok = [Win32]::PrintWindow($hwnd, $hdc, 2)
} finally { $g.ReleaseHdc($hdc) }
if (-not $ok) { throw "PrintWindow failed" }
$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved $Out ($w x $h)"
