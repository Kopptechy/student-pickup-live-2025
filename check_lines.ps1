$path = "public/admin.html"
$lines = Get-Content $path
$idx = -1
for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '<!-- Add/Edit Student Modal -->') { $idx = $i; break } }

if ($idx -ne -1) {
    Write-Host "Found at $idx"
    Write-Host "Lines before:"
    $start = $idx - 5
    if ($start -lt 0) { $start = 0 }
    $lines[$start..($idx + 2)] | ForEach-Object { Write-Host $_ }
}
else {
    Write-Host "Not found"
}
