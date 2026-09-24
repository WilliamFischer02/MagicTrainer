<#
.SYNOPSIS  Launch Claude Code in the MagicTrainer repo with the startup prompt, ready for unattended work.
.PARAMETER Mode   'first' (default: feeds AGENT_STARTUP_PROMPT.md), 'resume' (continues last session), 'goal' (non-interactive /goal run of the current phase).
.PARAMETER Auto   Start in auto permission mode (default on; pass -Auto:$false for manual).
#>
[CmdletBinding()]
param([ValidateSet("first","resume","goal")][string]$Mode = "first", [bool]$Auto = $true)
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { throw "claude not on PATH - run scripts\setup-magictrainer.ps1 first" }
$perm = if ($Auto) { "auto" } else { "default" }
switch ($Mode) {
  "first"  { $prompt = Get-Content (Join-Path $repo "AGENT_STARTUP_PROMPT.md") -Raw; claude --permission-mode $perm $prompt }
  "resume" { claude --permission-mode $perm --continue }
  "goal"   { claude --permission-mode $perm -p "/goal Every unchecked item in the CURRENT phase of docs/ROADMAP.md is implemented, tested (npm test and npm run typecheck pass), committed, and docs/HANDOFF.md is refreshed; questions for William are logged in docs/QUESTIONS_FOR_WILLIAM.md instead of asked. Stop after 40 turns." --output-format stream-json --verbose }
}
