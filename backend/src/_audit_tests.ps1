$root = (Get-Location).Path
$dirs = @('modules', 'core')
$results = @()
foreach ($d in $dirs) {
  $dirPath = Join-Path $root $d
  if (-not (Test-Path $dirPath)) { continue }
  Get-ChildItem -Path $dirPath -Recurse -Filter *.ts -File |
    Where-Object { $_.FullName -notmatch '\.test\.ts$' -and $_.FullName -notmatch '\\migrations\\' -and $_.FullName -notmatch '\\presets\\' -and $_.FullName -notmatch '\.d\.ts$' } |
    ForEach-Object {
      $base = $_.FullName -replace '\.ts$',''
      $testFile = $base + '.test.ts'
      $hasTest = Test-Path $testFile
      if (-not $hasTest) {
        $results += [PSCustomObject]@{ Path = $_.FullName.Substring($root.Length + 1) }
      }
    }
}
Write-Host ("Total files without tests: " + $results.Count)
Write-Host ""
Write-Host "=== Services files without tests (critical) ==="
$results | Where-Object { $_.Path -match '\\services\\' -and $_.Path -match '\.ts$' } | Sort-Object Path | ForEach-Object { Write-Host $_.Path }
Write-Host ""
Write-Host "=== All files without tests ==="
$results | Sort-Object Path | ForEach-Object { Write-Host $_.Path }
