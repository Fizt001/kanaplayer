<?php
// Membuat ikon PWA: php scripts/make-icons.php

function icon(int $size, bool $maskable): GdImage
{
    $im = imagecreatetruecolor($size, $size);
    imagealphablending($im, true);
    $bg = imagecolorallocate($im, 124, 92, 255);
    $white = imagecolorallocate($im, 255, 255, 255);

    // Maskable: isi penuh (area aman 80%). Biasa: sudut membulat.
    imagefilledrectangle($im, 0, 0, $size, $size, $bg);
    if (! $maskable) {
        $t = imagecolorallocatealpha($im, 0, 0, 0, 127);
        imagesavealpha($im, true);
        imagefill($im, 0, 0, $t);
        $r = (int) ($size * 0.22);
        imagefilledrectangle($im, $r, 0, $size - $r, $size, $bg);
        imagefilledrectangle($im, 0, $r, $size, $size - $r, $bg);
        foreach ([[$r, $r], [$size - $r, $r], [$r, $size - $r], [$size - $r, $size - $r]] as [$x, $y]) {
            imagefilledellipse($im, $x, $y, $r * 2, $r * 2, $bg);
        }
    }

    // Not musik: kepala not + tangkai + bendera.
    $u = $size * ($maskable ? 0.8 : 1) / 100;
    $o = $size * ($maskable ? 0.1 : 0);
    $cx = fn ($v) => (int) ($o + $v * $u);
    imagefilledellipse($im, $cx(40), $cx(70), (int) (26 * $u), (int) (20 * $u), $white);
    imagefilledrectangle($im, $cx(48), $cx(26), $cx(54), $cx(70), $white);
    imagefilledpolygon($im, [$cx(54), $cx(26), $cx(72), $cx(36), $cx(72), $cx(48), $cx(54), $cx(40)], $white);

    return $im;
}

$dir = __DIR__.'/../public/icons';
@mkdir($dir, 0755, true);
foreach ([['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]] as [$f, $s, $m]) {
    imagepng(icon($s, $m), "$dir/$f");
    echo "OK $f\n";
}

