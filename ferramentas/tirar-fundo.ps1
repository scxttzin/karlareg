# Deixa transparente o fundo de uma imagem, usando a cor do canto superior
# esquerdo como referencia. Serve para recortar figurinhas de print.
#
# Uso:
#   pwsh -File ferramentas/tirar-fundo.ps1 -Entrada recorte.png -Saida assets/fotos/gatinhos.png
#
# -Tolerancia: quanto maior, mais tons proximos do fundo somem (0 a 255).

param(
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Saida,
  [int]$Tolerancia = 42
)

Add-Type -AssemblyName System.Drawing

$caminhoEntrada = (Resolve-Path $Entrada).Path
$origem = [System.Drawing.Bitmap]::FromFile($caminhoEntrada)
$largura = $origem.Width
$altura = $origem.Height

# a cor do canto e tomada como sendo o fundo
$fundo = $origem.GetPixel(0, 0)
Write-Host ("fundo detectado: R{0} G{1} B{2}" -f $fundo.R, $fundo.G, $fundo.B)

$destino = New-Object System.Drawing.Bitmap($largura, $altura, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$apagados = 0
for ($y = 0; $y -lt $altura; $y++) {
  for ($x = 0; $x -lt $largura; $x++) {
    $p = $origem.GetPixel($x, $y)
    $dist = [Math]::Max([Math]::Abs($p.R - $fundo.R),
            [Math]::Max([Math]::Abs($p.G - $fundo.G), [Math]::Abs($p.B - $fundo.B)))
    if ($dist -le $Tolerancia) {
      $destino.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      $apagados++
    } else {
      $destino.SetPixel($x, $y, $p)
    }
  }
}

$pastaSaida = Split-Path -Parent $Saida
if ($pastaSaida -and -not (Test-Path $pastaSaida)) {
  New-Item -ItemType Directory -Force -Path $pastaSaida | Out-Null
}
$caminhoSaida = if ([System.IO.Path]::IsPathRooted($Saida)) {
  [System.IO.Path]::GetFullPath($Saida)
} else {
  [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Saida))
}
$destino.Save($caminhoSaida, [System.Drawing.Imaging.ImageFormat]::Png)

$origem.Dispose()
$destino.Dispose()

$total = $largura * $altura
Write-Host ("pronto: {0} ({1}x{2}), {3} de {4} pixels viraram transparentes" -f $caminhoSaida, $largura, $altura, $apagados, $total)
