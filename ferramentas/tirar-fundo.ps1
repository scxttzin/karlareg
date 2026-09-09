# Recorta figurinhas de print: deixa o fundo transparente e apara as sobras.
#
# O fundo e apagado por alagamento a partir das bordas, e nao por troca de cor
# no desenho inteiro. A diferenca importa: a barriga do gato tambem e branca,
# e uma troca global comeria ela junto com o fundo.
#
# Uso:
#   pwsh -File ferramentas/tirar-fundo.ps1 -Entrada gato.jpg -Saida assets/fotos/gato.png
#   pwsh -File ferramentas/tirar-fundo.ps1 -Entrada folha.jpg -Saida tira.png -Recorte "370,6,310,58"
#
# -Tolerancia: quanto maior, mais tons vizinhos do fundo somem (0 a 255).
# -SemAparar:  mantem as margens transparentes em vez de apara-las.

param(
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Saida,
  [int]$Tolerancia = 40,
  [string]$Recorte,
  [switch]$SemAparar
)

Add-Type -AssemblyName System.Drawing

function Caminho-Absoluto([string]$p) {
  if ([System.IO.Path]::IsPathRooted($p)) { [System.IO.Path]::GetFullPath($p) }
  else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $p)) }
}

$original = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Entrada).Path)

# recorte opcional, antes de qualquer coisa
if ($Recorte) {
  $n = $Recorte -split '\s*,\s*'
  $ret = New-Object System.Drawing.Rectangle([int]$n[0], [int]$n[1], [int]$n[2], [int]$n[3])
  $pedaco = $original.Clone($ret, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $original.Dispose()
  $original = $pedaco
}

$L = $original.Width
$A = $original.Height

# passa tudo para ARGB, para poder mexer no canal alfa
$img = New-Object System.Drawing.Bitmap($L, $A, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($img)
$g.DrawImage($original, 0, 0, $L, $A)
$g.Dispose()
$original.Dispose()

$ret = New-Object System.Drawing.Rectangle(0, 0, $L, $A)
$dados = $img.LockBits($ret, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
                       [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$passo = $dados.Stride
$bytes = New-Object byte[] ($passo * $A)
[System.Runtime.InteropServices.Marshal]::Copy($dados.Scan0, $bytes, 0, $bytes.Length)

# BGRA: o canto de cima e tomado como sendo a cor do fundo
$fundoB = $bytes[0]; $fundoG = $bytes[1]; $fundoR = $bytes[2]
Write-Host ("fundo detectado: R{0} G{1} B{2}  ({3}x{4})" -f $fundoR, $fundoG, $fundoB, $L, $A)

$visto = New-Object 'bool[]' ($L * $A)
$fila = New-Object System.Collections.Generic.Stack[int]

function Parecido([int]$i) {
  $d = $i * 4
  $dr = [Math]::Abs($bytes[$d + 2] - $fundoR)
  $dg = [Math]::Abs($bytes[$d + 1] - $fundoG)
  $db = [Math]::Abs($bytes[$d] - $fundoB)
  return ($dr -le $Tolerancia -and $dg -le $Tolerancia -and $db -le $Tolerancia)
}

# semeia a partir de toda a moldura
for ($x = 0; $x -lt $L; $x++) {
  foreach ($y in @(0, ($A - 1))) { $fila.Push($y * $L + $x) }
}
for ($y = 0; $y -lt $A; $y++) {
  foreach ($x in @(0, ($L - 1))) { $fila.Push($y * $L + $x) }
}

$apagados = 0
while ($fila.Count -gt 0) {
  $i = $fila.Pop()
  if ($visto[$i]) { continue }
  $visto[$i] = $true
  if (-not (Parecido $i)) { continue }

  $bytes[$i * 4 + 3] = 0
  $apagados++

  $x = $i % $L
  $y = [Math]::Floor($i / $L)
  if ($x -gt 0)      { $fila.Push($i - 1) }
  if ($x -lt $L - 1) { $fila.Push($i + 1) }
  if ($y -gt 0)      { $fila.Push($i - $L) }
  if ($y -lt $A - 1) { $fila.Push($i + $L) }
}

[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $dados.Scan0, $bytes.Length)
$img.UnlockBits($dados)

# apara a moldura transparente, para a figurinha ficar justa
$saidaImg = $img
if (-not $SemAparar) {
  $x0 = $L; $y0 = $A; $x1 = -1; $y1 = -1
  for ($y = 0; $y -lt $A; $y++) {
    for ($x = 0; $x -lt $L; $x++) {
      if ($bytes[($y * $L + $x) * 4 + 3] -ne 0) {
        if ($x -lt $x0) { $x0 = $x }
        if ($x -gt $x1) { $x1 = $x }
        if ($y -lt $y0) { $y0 = $y }
        if ($y -gt $y1) { $y1 = $y }
      }
    }
  }
  if ($x1 -ge $x0 -and $y1 -ge $y0) {
    $corte = New-Object System.Drawing.Rectangle($x0, $y0, ($x1 - $x0 + 1), ($y1 - $y0 + 1))
    $saidaImg = $img.Clone($corte, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    Write-Host ("aparado para {0}x{1}" -f $saidaImg.Width, $saidaImg.Height)
  }
}

$destino = Caminho-Absoluto $Saida
$pasta = Split-Path -Parent $destino
if ($pasta -and -not (Test-Path $pasta)) { New-Item -ItemType Directory -Force -Path $pasta | Out-Null }
$saidaImg.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)

if ($saidaImg -ne $img) { $saidaImg.Dispose() }
$img.Dispose()

Write-Host ("pronto: {0} — {1} pixels de fundo viraram transparentes" -f $destino, $apagados)
