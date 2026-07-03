$root = (Get-Location).Path
Get-ChildItem -Path $root -Recurse -Filter *.ts -File |
  Where-Object { $_.FullName -notmatch '\.test\.ts$' -and $_.FullName -notmatch '\\migrations\\' -and $_.FullName -notmatch '\\presets\\' } |
  ForEach-Object {
    $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    [PSCustomObject]@{ Lines = $lines; Path = $_.FullName.Substring($root.Length + 1) }
  } |
  Sort-Object Lines -Descending |
  Select-Object -First 10 |
  Format-Table -AutoSize
