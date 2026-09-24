<#
.SYNOPSIS  Download bulk MTG datasets into data/ (gitignored). Idempotent; writes data/manifest.json.
.PARAMETER Dest  Data directory (default: ../data relative to this script).
.PARAMETER All   Also fetch Scryfall default-cards (~75 MB gz, every printing) - needed for collection->printing mapping.
#>
[CmdletBinding()]
param([string]$Dest = (Join-Path $PSScriptRoot "..\data"), [switch]$All)
$ErrorActionPreference = "Stop"
$ua = "MagicTrainer/0.1 (github.com/WilliamFischer02/MagicTrainer)"
$hdr = @{ "User-Agent" = $ua; "Accept" = "application/json" }
New-Item -ItemType Directory -Force -Path "$Dest\scryfall","$Dest\spellbook","$Dest\mtgjson" | Out-Null
$manifest = @{ retrieved = (Get-Date -Format s); files = @() }
function Get($url, $out) {
  Write-Host "  -> $out" -ForegroundColor DarkCyan
  Invoke-WebRequest -Uri $url -OutFile $out -Headers $hdr -UseBasicParsing
  $script:manifest.files += @{ url = $url; path = $out; bytes = (Get-Item $out).Length }
}
Write-Host "[1/3] Scryfall bulk data (JSONL.gz)" -ForegroundColor Cyan
$bulk = Invoke-RestMethod "https://api.scryfall.com/bulk-data" -Headers $hdr
$want = @("oracle_cards","rulings","oracle_tags"); if ($All) { $want += "default_cards" }
foreach ($b in $bulk.data) {
  if ($want -contains $b.type) {
    $uri = if ($b.jsonl_download_uri) { $b.jsonl_download_uri } else { $b.download_uri }
    $ext = if ($uri -like "*.jsonl.gz") { "jsonl.gz" } else { "json" }
    Get $uri "$Dest\scryfall\$($b.type).$ext"
    Start-Sleep -Milliseconds 150   # stay far under 10 req/s
  }
}
Write-Host "[2/3] Commander Spellbook variants" -ForegroundColor Cyan
Get "https://json.commanderspellbook.com/variants.json.gz" "$Dest\spellbook\variants.json.gz"
Write-Host "[3/3] MTGJSON (precon decklists, keywords, card types)" -ForegroundColor Cyan
Get "https://mtgjson.com/api/v5/AllDeckFiles.zip" "$Dest\mtgjson\AllDeckFiles.zip"
Get "https://mtgjson.com/api/v5/Keywords.json" "$Dest\mtgjson\Keywords.json"
Get "https://mtgjson.com/api/v5/CardTypes.json" "$Dest\mtgjson\CardTypes.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content "$Dest\manifest.json" -Encoding UTF8
Write-Host "Done. Manifest: $Dest\manifest.json" -ForegroundColor Green
