param(
  [string]$BaseUrl = 'http://127.0.0.1:4323',
  [string]$Label = 'current'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectRoot
$perfRoot = Join-Path $projectRoot 'artifacts/performance'
$reportRoot = Join-Path $perfRoot $Label
$tempRoot = Join-Path $perfRoot 'tmp'
New-Item -ItemType Directory -Force -Path $reportRoot, $tempRoot | Out-Null
$env:npm_config_cache = Join-Path $perfRoot 'npm-cache'
$env:TEMP = $tempRoot
$env:TMP = $tempRoot
$env:CHROME_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $env:CHROME_PATH)) {
  $env:CHROME_PATH = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
$routes = @(
  @{ Name = 'home'; Route = '/' },
  @{ Name = 'project'; Route = '/projects/fieldnotes/' },
  @{ Name = 'skills'; Route = '/#skills' }
)
foreach ($entry in $routes) {
  $reportPath = Join-Path $reportRoot ('lighthouse-' + $entry.Name + '.json')
  npm exec --yes --package=lighthouse@13.5.0 -- lighthouse ($BaseUrl + $entry.Route) --quiet --chrome-flags='--headless' --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=$reportPath --save-assets --no-enable-error-reporting
  if ($LASTEXITCODE -ne 0) { throw ('Lighthouse failed: ' + $entry.Name) }
  $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
  [pscustomobject]@{
    Page = $entry.Name
    Performance = $report.categories.performance.score * 100
    Accessibility = $report.categories.accessibility.score * 100
    BestPractices = $report.categories.'best-practices'.score * 100
    SEO = $report.categories.seo.score * 100
    CLS = $report.audits.'cumulative-layout-shift'.numericValue
    LCPms = $report.audits.'largest-contentful-paint'.numericValue
    TBTms = $report.audits.'total-blocking-time'.numericValue
  }
}
