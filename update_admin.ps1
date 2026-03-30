$path = "public/admin.html"
$lines = Get-Content $path
$head = $lines[0..10]
$tail = $lines[605..($lines.Count-1)]
$newContent = $head + '<link rel="stylesheet" href="admin-layout.css">' + $tail
$newContent | Set-Content $path -Encoding UTF8
