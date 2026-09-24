# NOTE (MagicTrainer): originally the ARCHIVIST KB refresher. Output lands in .\kb-refresh-output\ - move the files into knowledge\mtg-rules\ (replace superseded ones) after a run.
# refresh-knowledge-pack.ps1
# ARCHIVIST MTG KB refresher - Goob Entertainment Co.
# Re-downloads the Comprehensive Rules, MTR, banned list, JAR; re-splits the CR;
# stamps everything with current dates. Output lands in .\kb-refresh-output\
# ready to upload to the Claude Project (delete superseded files there first).
#
# Usage:  .\refresh-knowledge-pack.ps1
# Deps:   PowerShell 5+; no external modules. (MTR stays PDF; upload the PDF -
#         Claude Projects extract PDF text fine.)

$ErrorActionPreference = "Stop"
$out = Join-Path $PSScriptRoot "kb-refresh-output"
$rules = Join-Path $out "01_RULES"; $tourn = Join-Path $out "02_TOURNAMENT"; $fmts = Join-Path $out "03_FORMATS"
New-Item -ItemType Directory -Force -Path $rules, $tourn, $fmts | Out-Null
$today = Get-Date -Format "yyyy-MM-dd"

Write-Host "== ARCHIVIST KB refresh $today ==" -ForegroundColor Cyan

# ---- 1. Find current CR TXT link on the official rules page ----
Write-Host "[1/4] Comprehensive Rules..."
$rulesPage = (Invoke-WebRequest "https://magic.wizards.com/en/rules" -UseBasicParsing).Content
if ($rulesPage -match 'href="(https://media\.wizards\.com/[^"]*MagicCompRules[^"]*\.txt)"') {
    $crUrl = $matches[1] -replace ' ', '%20'
} else { throw "CR TXT link not found on rules page - page layout may have changed. Check magic.wizards.com/en/rules manually." }

# effective date from filename e.g. MagicCompRules 20260619.txt
$eff = $today
if ($crUrl -match '(\d{4})(\d{2})(\d{2})\.txt') { $eff = "$($matches[1])-$($matches[2])-$($matches[3])" }
$crFull = Join-Path $rules "CR_${eff}_comprehensive-rules_FULL.txt"
Invoke-WebRequest $crUrl -OutFile $crFull -UseBasicParsing
Write-Host "    CR effective $eff  ($([math]::Round((Get-Item $crFull).Length/1KB)) KB)"

# ---- 2. Split CR into section files ----
Write-Host "[2/4] Splitting CR into sections..."
$text = (Get-Content $crFull -Raw -Encoding UTF8) -replace "`r`n", "`n"
$sections = @(
    @("1. Game Concepts",                 "CR-S1_game-concepts"),
    @("2. Parts of a Card",               "CR-S2_parts-of-a-card"),
    @("3. Card Types",                    "CR-S3_card-types"),
    @("4. Zones",                         "CR-S4_zones"),
    @("5. Turn Structure",                "CR-S5_turn-structure"),
    @("6. Spells, Abilities, and Effects","CR-S6_spells-abilities-effects"),
    @("7. Additional Rules",              "CR-S7_additional-rules"),
    @("8. Multiplayer Rules",             "CR-S8_multiplayer-rules"),
    @("9. Casual Variants",               "CR-S9_casual-variants"),
    @("Glossary",                         "CR-GLOSSARY"),
    @("Credits",                          $null)
)
$positions = @()
foreach ($s in $sections) {
    $rx = "(?m)^" + [regex]::Escape($s[0]) + "\s*$"
    $ms = [regex]::Matches($text, $rx)
    if ($ms.Count -eq 0) { Write-Warning "Section header missing: $($s[0])"; continue }
    $pos = if ($ms.Count -gt 1) { $ms[1].Index } else { $ms[0].Index }  # skip ToC occurrence
    $positions += ,@($pos, $s[0], $s[1])
}
$positions = $positions | Sort-Object { $_[0] }
for ($i = 0; $i -lt $positions.Count; $i++) {
    if ($null -eq $positions[$i][2]) { continue }
    $start = $positions[$i][0]
    $end = if ($i + 1 -lt $positions.Count) { $positions[$i+1][0] } else { $text.Length }
    $chunk = $text.Substring($start, $end - $start).Trim()
    $hdr = "[Magic: The Gathering Comprehensive Rules - effective $eff]`n[Section: $($positions[$i][1])]`n`n"
    $file = Join-Path $rules "$($positions[$i][2])_$eff.txt"
    Set-Content -Path $file -Value ($hdr + $chunk) -Encoding UTF8
    Write-Host "    $([IO.Path]::GetFileName($file))"
}

# ---- 3. MTR (latest link scraped from WPN docs page) ----
Write-Host "[3/4] Magic Tournament Rules..."
try {
    $wpn = (Invoke-WebRequest "https://wpn.wizards.com/en/rules-documents" -UseBasicParsing).Content
    if ($wpn -match 'href="(https://media\.wizards\.com/[^"]*MTG_MTR[^"]*\.pdf)"') {
        $mtrUrl = $matches[1]
        $mtrName = if ($mtrUrl -match 'MTR_(\d{4})_(\w{3})(\d+)') { "MTR_$($matches[1])-$($matches[2])-$($matches[3])_tournament-rules.pdf" } else { "MTR_retr-${today}_tournament-rules.pdf" }
        Invoke-WebRequest $mtrUrl -OutFile (Join-Path $tourn $mtrName) -UseBasicParsing
        Write-Host "    $mtrName"
    } else { Write-Warning "MTR link not found on WPN page - grab manually from wpn.wizards.com/en/rules-documents" }
} catch { Write-Warning "WPN fetch failed: $_" }

# ---- 4. Banned & Restricted (HTML -> readable text) ----
Write-Host "[4/4] Banned & Restricted list..."
$br = (Invoke-WebRequest "https://magic.wizards.com/en/banned-restricted-list" -UseBasicParsing).Content
# crude but effective HTML->text: strip scripts/styles/tags, decode entities
$br = [regex]::Replace($br, '(?s)<(script|style)[^>]*>.*?</\1>', '')
$br = [regex]::Replace($br, '<[^>]+>', "`n")
Add-Type -AssemblyName System.Web
$br = [System.Web.HttpUtility]::HtmlDecode($br)
$br = [regex]::Replace($br, "(`n\s*){3,}", "`n`n")
# keep from the banned-list heading onward, drop footer
$startIdx = $br.IndexOf("BANNED AND RESTRICTED", [System.StringComparison]::OrdinalIgnoreCase)
if ($startIdx -ge 0) { $br = $br.Substring($startIdx) }
$footIdx = $br.IndexOf("Find a store", [System.StringComparison]::OrdinalIgnoreCase)
if ($footIdx -gt 0) { $br = $br.Substring(0, $footIdx) }
$brFile = Join-Path $fmts "FMT-ALL_banned-restricted-list_$today.md"
Set-Content -Path $brFile -Value ("<!-- Retrieved $today from magic.wizards.com/en/banned-restricted-list -->`n`n" + $br.Trim()) -Encoding UTF8
Write-Host "    $([IO.Path]::GetFileName($brFile))"

Write-Host ""
Write-Host "DONE. Upload contents of $out to the Claude Project" -ForegroundColor Green
Write-Host "(delete the superseded dated files in project knowledge first)," -ForegroundColor Green
Write-Host "then update the dates in KB-MANIFEST_read-first.md and re-upload it too." -ForegroundColor Green
