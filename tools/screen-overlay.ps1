# Shows the active chaos effects on top of the Elden Ring window (player's own screen).
#  - transparent, always on top, click-through: mouse/keyboard go straight to the game
#  - sits at the game window's top-left, under the HP/FP/stamina bars, and follows the window (windowed / borderless only, not exclusive fullscreen)
#  - excluded from screen capture, so OBS display capture does not show it twice
#    (viewers keep seeing the OBS browser-source overlay as before)
# Usage: npm run screen      (adapter must be running: npm start)
# Close: Ctrl+C in this terminal, or close the terminal.
param(
  [int]$Port = $(if ($env:ADAPTER_PORT) { [int]$env:ADAPTER_PORT } else { 8008 }),
  [string]$GameTitle = 'ELDEN RING',
  [int]$FontSize = 20,
  [switch]$ShowInCapture   # for testing: let screenshots/OBS see the window
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ChaosWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();

  public static IntPtr Find(string prefix) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(256);
      GetWindowText(h, sb, 256);
      if (sb.ToString().StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  // client area of the game window in screen pixels: x, y, width, height
  public static int[] Client(IntPtr h) {
    RECT r; if (!GetClientRect(h, out r)) return null;
    POINT p = new POINT(); if (!ClientToScreen(h, ref p)) return null;
    return new int[] { p.X, p.Y, r.Right - r.Left, r.Bottom - r.Top };
  }

  public static void ClickThrough(IntPtr h, bool hideFromCapture) {
    const int GWL_EXSTYLE = -20;
    const int WS_EX_TRANSPARENT = 0x20, WS_EX_LAYERED = 0x80000, WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x8000000;
    SetWindowLong(h, GWL_EXSTYLE, GetWindowLong(h, GWL_EXSTYLE) | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);
    if (hideFromCapture) SetWindowDisplayAffinity(h, 0x11); // WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+)
  }
}
'@

$url = "http://127.0.0.1:$Port/state"

$win = New-Object System.Windows.Window
$win.WindowStyle = 'None'
$win.AllowsTransparency = $true
$win.Background = [System.Windows.Media.Brushes]::Transparent
$win.Topmost = $true
$win.ShowInTaskbar = $false
$win.ShowActivated = $false
$win.ResizeMode = 'NoResize'
$win.Width = 520
$win.Height = 400
$win.Left = -10000
$win.Top = 0

$panel = New-Object System.Windows.Controls.StackPanel
$panel.HorizontalAlignment = 'Left'
$panel.Margin = '16,0,0,0'
$win.Content = $panel

$shadow = New-Object System.Windows.Media.Effects.DropShadowEffect
$shadow.BlurRadius = 4; $shadow.ShadowDepth = 1; $shadow.Opacity = 1; $shadow.Color = [System.Windows.Media.Colors]::Black
$gold = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(0xF5, 0xD3, 0x6B))
$white = [System.Windows.Media.Brushes]::White

function New-Line([string]$text, $brush, [int]$size) {
  $t = New-Object System.Windows.Controls.TextBlock
  $t.Text = $text
  $t.Foreground = $brush
  $t.FontFamily = 'Malgun Gothic'
  $t.FontWeight = 'Bold'
  $t.FontSize = $size
  $t.TextAlignment = 'Left'
  $t.HorizontalAlignment = 'Left'
  $t.Effect = $shadow
  $t.Margin = '0,1,0,1'
  [void]$panel.Children.Add($t)
}

$win.Add_SourceInitialized({
  $h = (New-Object System.Windows.Interop.WindowInteropHelper $win).Handle
  [ChaosWin]::ClickThrough($h, -not $ShowInCapture)
})

$state = @{ last = ''; game = [IntPtr]::Zero; tick = 0 }
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(500)
$timer.Add_Tick({
 try {
  # follow the game window (look it up again every few seconds in case it restarted)
  $state.tick = $state.tick + 1
  if ($state.game -eq [IntPtr]::Zero -or ($state.tick % 10) -eq 0) { $state.game = [ChaosWin]::Find($GameTitle) }
  $g = $state.game
  if ($g -eq [IntPtr]::Zero -or [ChaosWin]::IsIconic($g)) { $win.Left = -10000; return }
  $c = [ChaosWin]::Client($g)
  if (-not $c) { return }
  $dpi = [System.Windows.PresentationSource]::FromVisual($win)
  $sx = 1.0; $sy = 1.0
  if ($dpi) { $sx = $dpi.CompositionTarget.TransformToDevice.M11; $sy = $dpi.CompositionTarget.TransformToDevice.M22 }
  # HP/FP/stamina bars take roughly the top 13% of the game screen; start just below them
  $win.Left = $c[0] / $sx
  $win.Top = ($c[1] + $c[3] * 0.15) / $sy
  $win.Topmost = $false; $win.Topmost = $true

  try {
    $s = Invoke-RestMethod -Uri $url -TimeoutSec 1
  } catch {
    $s = $null
  }
  $panel.Children.Clear()
  if (-not $s) { return }
  foreach ($a in $s.active) { New-Line ("{0}  {1}s" -f $a.text, $a.left) $white $FontSize }
  if ($s.footer) { New-Line $s.footer $gold ($FontSize - 4) }
 } catch { Write-Host "tick error: $_" }
})

$win.Add_Loaded({ $timer.Start() })
Write-Host "screen overlay: following '$GameTitle' window, data from $url  (Ctrl+C to quit)"
[void]$win.ShowDialog()
