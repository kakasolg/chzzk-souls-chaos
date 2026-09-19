# Persistent key sender. Reads one combination per line from stdin ("F21+1", "numpad1")
# and presses all keys simultaneously via keybd_event, then releases in reverse order.
# Kept as a long-lived child process so each press costs ~ms instead of a PowerShell startup.
Add-Type -Namespace Win32 -Name Kbd -MemberDefinition @"
[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
"@

$vk = @{}
1..24 | ForEach-Object { $vk["F$_"] = 0x6F + $_ }          # F1=0x70 .. F24=0x87
0..9  | ForEach-Object { $vk["$_"] = 0x30 + $_; $vk["NUMPAD$_"] = 0x60 + $_ }
$vk["SPACE"]=0x20; $vk["ENTER"]=0x0D; $vk["SHIFT"]=0x10; $vk["CTRL"]=0x11; $vk["ALT"]=0x12
$KEYUP = 0x0002

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq "") { continue }
  $keys = $line.ToUpper().Split("+") | ForEach-Object { $_.Trim() }
  $codes = @()
  foreach ($k in $keys) {
    if (-not $vk.ContainsKey($k)) { [Console]::Error.WriteLine("unknown key: $k"); $codes = @(); break }
    $codes += $vk[$k]
  }
  if ($codes.Count -eq 0) { continue }
  foreach ($c in $codes) { [Win32.Kbd]::keybd_event([byte]$c, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 15 }
  Start-Sleep -Milliseconds 60
  [array]::Reverse($codes)
  foreach ($c in $codes) { [Win32.Kbd]::keybd_event([byte]$c, 0, $KEYUP, [UIntPtr]::Zero); Start-Sleep -Milliseconds 15 }
  [Console]::Out.WriteLine("ok $line")
}
