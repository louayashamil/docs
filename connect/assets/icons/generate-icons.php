<?php
/**
 * NADAR Connect - PNG Icon Generator
 * Uses GD library to generate PWA icons in all required sizes.
 * Run once: php generate-icons.php
 */

$sizes = [72, 96, 128, 144, 152, 192, 384, 512];
$outputDir = __DIR__;

foreach ($sizes as $size) {
    $img = imagecreatetruecolor($size, $size);

    // Enable anti-aliasing
    imageantialias($img, true);

    // Transparent background
    imagesavealpha($img, true);
    $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
    imagefill($img, 0, 0, $transparent);

    // Colors
    $blue = imagecolorallocate($img, 21, 101, 192);   // #1565C0
    $white = imagecolorallocate($img, 255, 255, 255);
    $lightBlue = imagecolorallocate($img, 25, 118, 210); // #1976D2

    // Draw blue circle background
    $cx = (int)($size / 2);
    $cy = (int)($size / 2);
    $radius = (int)($size / 2 - 2);
    imagefilledellipse($img, $cx, $cy, $radius * 2, $radius * 2, $blue);

    // Draw inner ring
    $innerRadius = (int)($radius * 0.94);
    imageellipse($img, $cx, $cy, $innerRadius * 2, $innerRadius * 2, $lightBlue);

    // Draw "N" text
    $fontSize = (int)($size * 0.45);
    $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

    if (file_exists($fontPath)) {
        // Use TrueType font if available
        $bbox = imagettfbbox($fontSize, 0, $fontPath, 'N');
        $textWidth = $bbox[2] - $bbox[0];
        $textHeight = $bbox[1] - $bbox[7];
        $textX = $cx - (int)($textWidth / 2);
        $textY = $cy + (int)($textHeight / 2);
        imagettftext($img, $fontSize, 0, $textX, $textY, $white, $fontPath, 'N');
    } else {
        // Fallback: use built-in font scaled with imagestring
        $font = 5; // largest built-in font
        $textWidth = imagefontwidth($font);
        $textHeight = imagefontheight($font);
        imagestring($img, $font, $cx - (int)($textWidth / 2), $cy - (int)($textHeight / 2), 'N', $white);
    }

    // Draw small medical cross (top-right area)
    $crossX = (int)($size * 0.74);
    $crossY = (int)($size * 0.23);
    $crossSize = max(2, (int)($size * 0.04));
    $crossLen = max(4, (int)($size * 0.08));

    imagefilledrectangle($img,
        $crossX - $crossSize, $crossY - $crossLen,
        $crossX + $crossSize, $crossY + $crossLen, $white);
    imagefilledrectangle($img,
        $crossX - $crossLen, $crossY - $crossSize,
        $crossX + $crossLen, $crossY + $crossSize, $white);

    // Save PNG
    $filename = sprintf('%s/icon-%dx%d.png', $outputDir, $size, $size);
    imagepng($img, $filename, 9);
    imagedestroy($img);

    echo "Generated: icon-{$size}x{$size}.png\n";
}

echo "\nAll icons generated successfully.\n";
echo "Place these in your PWA manifest's icons array.\n";
