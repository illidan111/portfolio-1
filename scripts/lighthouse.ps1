param(
  [string]$BaseUrl = 'http://127.0.0.1:4323',
  [string]$Label = 'current',
  [string]$NodePath = $env:PORTFOLIO_NODE,
  [string]$NpmCliPath = ''
)
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
if ($Label -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Label must contain only letters, numbers, underscores, or hyphens.' }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot
if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
$nodeVersion = (& $NodePath --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v22\.(\d+)\.' -or [int]$Matches[1] -lt 12) { throw "Use -NodePath with Node 22.12+ in the 22.x series; received $nodeVersion" }
if (-not $NpmCliPath) { $NpmCliPath = Join-Path (Split-Path (Get-Command npm -ErrorAction Stop).Source) 'node_modules/npm/bin/npm-cli.js' }
if (-not (Test-Path -LiteralPath $NpmCliPath)) { throw 'Provide -NpmCliPath pointing to an installed npm-cli.js.' }
$env:PATH = (Split-Path -Parent $NodePath) + [IO.Path]::PathSeparator + $env:PATH
$perfRoot = Join-Path $projectRoot 'artifacts/performance'
$reportRoot = Join-Path $perfRoot $Label
$tempRoot = Join-Path $perfRoot 'tmp'
New-Item -ItemType Directory -Force -Path $reportRoot, $tempRoot | Out-Null
$env:npm_config_cache = Join-Path $perfRoot 'npm-cache'
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:TMPDIR = $tempRoot
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $env:CHROME_PATH)) {
  $env:CHROME_PATH = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
$routes = @(
  @{ Name = 'home-game'; Route = '/?mode=game' },
  @{ Name = 'project-game'; Route = '/projects/astana-explorer/?mode=game' },
  @{ Name = 'skills-game'; Route = '/?mode=game#skills' },
  @{ Name = 'home-classic'; Route = '/?mode=classic' }
)
$results = @()
foreach ($entry in $routes) {
  $reportPath = Join-Path $reportRoot ('lighthouse-' + $entry.Name + '.json')
  & $NodePath $NpmCliPath exec --yes --package=lighthouse@13.5.0 -- lighthouse ($BaseUrl + $entry.Route) --quiet --chrome-flags='--headless' --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=$reportPath --save-assets --no-enable-error-reporting
  if ($LASTEXITCODE -ne 0) { throw ('Lighthouse failed: ' + $entry.Name) }
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  $scores = @($report.categories.performance.score, $report.categories.accessibility.score, $report.categories.'best-practices'.score, $report.categories.seo.score)
  $valid = $null -eq $report.runtimeError -and $null -ne $report.audits.'cumulative-layout-shift'.numericValue -and $null -ne $report.audits.'largest-contentful-paint'.numericValue
  foreach ($score in $scores) { if ($null -eq $score -or $score -lt 0.95) { $valid = $false } }
  $result = [pscustomobject]@{
    Page = $entry.Name
    URL = $report.finalDisplayedUrl
    Passed = $valid -and $report.audits.'cumulative-layout-shift'.numericValue -lt 0.05 -and $report.audits.'largest-contentful-paint'.numericValue -lt 2500
    Performance = $report.categories.performance.score * 100
    Accessibility = $report.categories.accessibility.score * 100
    BestPractices = $report.categories.'best-practices'.score * 100
    SEO = $report.categories.seo.score * 100
    CLS = $report.audits.'cumulative-layout-shift'.numericValue
    LCPms = $report.audits.'largest-contentful-paint'.numericValue
    TBTms = $report.audits.'total-blocking-time'.numericValue
    RuntimeError = $report.runtimeError
    RunWarnings = $report.runWarnings
  }
  $results += $result
  $result
}
$summary = [pscustomobject]@{ Timestamp = [DateTime]::UtcNow.ToString('o'); Node = $nodeVersion; BaseURL = $BaseUrl; Passed = ($results | Where-Object { -not $_.Passed }).Count -eq 0; Reports = $results }
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportRoot 'lighthouse-summary.json') -Encoding utf8
if (-not $summary.Passed) { throw 'Lighthouse gate failed; all available reports and summary have been preserved.' }
