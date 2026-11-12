<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class YoutubeController extends Controller
{
    /**
     * POST /youtube/info
     * Validate YouTube URL, extract metadata, download audio, return token + metadata.
     */
    public function info(Request $request)
    {
        set_time_limit(180);

        $request->validate(['url' => ['required', 'string', 'max:500']]);
        $url = trim($request->input('url'));

        // Validate YouTube URL pattern
        if (!preg_match('/^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?)/i', $url)) {
            return response()->json(['error' => 'URL harus berupa link YouTube yang valid (youtube.com atau youtu.be).'], 422);
        }

        $tmpDir = storage_path('app/yt_tmp');
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }

        $token = Str::random(32);
        $tmpBase = $tmpDir . '/' . $token;
        $ytdlp = '/usr/local/bin/yt-dlp';

        // Check yt-dlp exists
        if (!file_exists($ytdlp)) {
            return response()->json(['error' => 'Layanan YouTube belum siap di server. Hubungi administrator.'], 503);
        }

        // Step 1: Get metadata (JSON dump)
        $metaCmd = $ytdlp
            . ' --dump-json --no-playlist --flat-playlist --quiet --no-warnings'
            . ' --socket-timeout 30'
            . ' ' . escapeshellarg($url)
            . ' 2>&1';

        exec($metaCmd, $metaLines, $exitCode);
        $metaOutput = implode('', $metaLines);
        $meta = json_decode($metaOutput, true);

        if (!$meta || !isset($meta['title'])) {
            return response()->json([
                'error' => 'Tidak bisa membaca info video. Pastikan link valid, publik, dan bukan live stream yang sedang berlangsung.',
            ], 422);
        }

        // Check duration (reject streams > 2 hours or no duration)
        $duration = (int)($meta['duration'] ?? 0);
        if ($duration > 7200) {
            return response()->json(['error' => 'Video terlalu panjang (maks. 2 jam). Gunakan video musik yang lebih pendek.'], 422);
        }

        // Step 2: Download audio as m4a
        $dlCmd = $ytdlp
            . ' --no-playlist -x --audio-format m4a --audio-quality 128K'
            . ' -o ' . escapeshellarg($tmpBase . '.%(ext)s')
            . ' --quiet --no-warnings'
            . ' --socket-timeout 60'
            . ' ' . escapeshellarg($url)
            . ' 2>&1';

        exec($dlCmd, $dlOutput, $dlExit);

        // Find the downloaded file
        $audioFile = $tmpBase . '.m4a';
        if (!file_exists($audioFile)) {
            $files = glob($tmpBase . '.*');
            $audioFile = ($files && count($files) > 0) ? $files[0] : null;
        }

        if (!$audioFile || !file_exists($audioFile)) {
            return response()->json([
                'error' => 'Gagal mengunduh audio. Mungkin video dibatasi, private, atau tidak tersedia di wilayah server.',
            ], 422);
        }

        // Step 3: Determine thumbnail URL (use YouTube CDN directly, no download)
        $videoId = $meta['id'] ?? null;
        $thumbnailUrl = null;
        if ($videoId) {
            foreach (['maxresdefault', 'hqdefault', 'mqdefault', 'default'] as $quality) {
                $t = "https://i.ytimg.com/vi/{$videoId}/{$quality}.jpg";
                $headers = @get_headers($t);
                if ($headers && str_contains($headers[0], '200')) {
                    $thumbnailUrl = $t;
                    break;
                }
            }
        }

        // Step 4: Cache token data for 15 minutes
        $data = [
            'file'      => $audioFile,
            'title'     => $meta['title'],
            'artist'    => $meta['uploader'] ?? $meta['channel'] ?? 'YouTube',
            'duration'  => $duration,
            'cover_url' => $thumbnailUrl,
            'size'      => filesize($audioFile),
        ];

        Cache::put('yt_' . $token, $data, now()->addMinutes(15));

        return response()->json([
            'token'     => $token,
            'title'     => $data['title'],
            'artist'    => $data['artist'],
            'duration'  => $data['duration'],
            'cover_url' => $data['cover_url'],
            'size'      => $data['size'],
        ]);
    }

    /**
     * GET /youtube/stream/{token}
     * Stream audio once then delete the temp file.
     */
    public function stream(string $token)
    {
        // Strict token format check
        if (!preg_match('/^[a-zA-Z0-9]{32}$/', $token)) {
            abort(404);
        }

        $data = Cache::get('yt_' . $token);

        if (!$data || !isset($data['file']) || !file_exists($data['file'])) {
            abort(404);
        }

        // Invalidate token immediately (one-time use)
        Cache::forget('yt_' . $token);

        return response()
            ->file($data['file'], [
                'Content-Type'        => 'audio/mp4',
                'Content-Disposition' => 'inline',
            ])
            ->deleteFileAfterSend(true);
    }
}
