<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class YoutubeController extends Controller
{
    /**
     * Normalize a YouTube URL to a clean single-video URL.
     * Strips playlist, radio, and other extra parameters.
     * Handles: watch?v=, youtu.be/, shorts/, music.youtube.com/watch?v=
     */
    private function normalizeYoutubeUrl(string $url): string
    {
        $parsed = parse_url($url);
        $host   = strtolower($parsed['host'] ?? '');
        $path   = $parsed['path'] ?? '/';

        // Parse query string into array
        parse_str($parsed['query'] ?? '', $params);

        // youtu.be/VIDEO_ID → extract video ID from path
        if (str_contains($host, 'youtu.be')) {
            $videoId = ltrim($path, '/');
            if ($videoId) {
                return 'https://www.youtube.com/watch?v=' . $videoId;
            }
            return $url; // fallback
        }

        // /shorts/VIDEO_ID
        if (preg_match('#^/shorts/([a-zA-Z0-9_-]+)#', $path, $m)) {
            return 'https://www.youtube.com/watch?v=' . $m[1];
        }

        // youtube.com/watch?v=... → keep only v= param
        if (isset($params['v']) && $params['v']) {
            return 'https://www.youtube.com/watch?v=' . $params['v'];
        }

        // music.youtube.com/watch?v=...
        if (isset($params['v'])) {
            return 'https://www.youtube.com/watch?v=' . $params['v'];
        }

        return $url; // unchanged as fallback
    }

    /**
     * POST /youtube/meta
     * Instant metadata extraction via YouTube oEmbed API without downloading or converting.
     */
    public function meta(Request $request)
    {
        $request->validate(['url' => ['required', 'string', 'max:500']]);
        $rawUrl = trim($request->input('url'));

        if (!preg_match('/^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?)/i', $rawUrl)) {
            return response()->json(['error' => 'URL harus berupa link YouTube yang valid.'], 422);
        }

        $cleanUrl = $this->normalizeYoutubeUrl($rawUrl);

        // Extract video ID
        parse_str(parse_url($cleanUrl, PHP_URL_QUERY) ?? '', $params);
        $videoId = $params['v'] ?? null;
        if (!$videoId && preg_match('#youtu\.be/([a-zA-Z0-9_-]+)#', $rawUrl, $m)) {
            $videoId = $m[1];
        }
        if (!$videoId && preg_match('#/shorts/([a-zA-Z0-9_-]+)#', $rawUrl, $m)) {
            $videoId = $m[1];
        }

        if (!$videoId) {
            return response()->json(['error' => 'ID video YouTube tidak ditemukan dalam tautan.'], 422);
        }

        // Fetch oEmbed
        $oembedUrl = 'https://www.youtube.com/oembed?url=' . urlencode('https://www.youtube.com/watch?v=' . $videoId) . '&format=json';
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 8,
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ],
        ]);

        $json = @file_get_contents($oembedUrl, false, $ctx);
        $title = 'YouTube Audio';
        $author = 'YouTube';

        if ($json) {
            $data = json_decode($json, true);
            if (isset($data['title'])) {
                $title = $data['title'];
            }
            if (isset($data['author_name'])) {
                $author = $data['author_name'];
            }
        }

        return response()->json([
            'videoId'   => $videoId,
            'title'     => $title,
            'author'    => $author,
            'thumbnail' => "https://i.ytimg.com/vi/{$videoId}/hqdefault.jpg",
        ]);
    }

    /**
     * GET /youtube/stream-direct/{videoId}
     * Direct audio proxy stream to HTML5 <audio> tag.
     * Enables true mobile background playback (screen locked, app switched).
     */
    public function streamDirect(Request $request, string $videoId)
    {
        if (!preg_match('/^[a-zA-Z0-9_-]{6,15}$/', $videoId)) {
            abort(404);
        }

        $streamUrl = Cache::remember('yt_stream_' . $videoId, now()->addHours(3), function () use ($videoId) {
            $cmd = '/usr/local/bin/yt-dlp -g -f ' . escapeshellarg('ba[ext=m4a]/ba/b')
                . ' --socket-timeout 10 --quiet --no-warnings '
                . escapeshellarg('https://www.youtube.com/watch?v=' . $videoId);
            exec($cmd, $lines, $code);
            return $lines[0] ?? null;
        });

        if (!$streamUrl) {
            abort(404, 'Audio stream tidak ditemukan.');
        }

        $range = $request->header('Range');

        return response()->stream(function () use ($streamUrl, $range) {
            $ch = curl_init($streamUrl);
            $headers = [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept: */*',
            ];
            if ($range) {
                $headers[] = 'Range: ' . $range;
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_BUFFERSIZE, 128 * 1024);
            curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $headerLine) {
                $trimmed = trim($headerLine);
                if (stripos($trimmed, 'Content-Type:') === 0 ||
                    stripos($trimmed, 'Content-Range:') === 0 ||
                    stripos($trimmed, 'Content-Length:') === 0 ||
                    stripos($trimmed, 'Accept-Ranges:') === 0) {
                    header($trimmed);
                }
                return strlen($headerLine);
            });
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) {
                echo $chunk;
                if (ob_get_level() > 0) ob_flush();
                flush();
                return strlen($chunk);
            });
            curl_exec($ch);
            curl_close($ch);
        }, $range ? 206 : 200, [
            'Content-Type' => 'audio/mp4',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-cache',
        ]);
    }

    /**
     * POST /youtube/info
     * Validate YouTube URL, extract metadata, download audio, return token + metadata.
     */
    public function info(Request $request)
    {
        set_time_limit(300);

        $request->validate(['url' => ['required', 'string', 'max:500']]);
        $url = trim($request->input('url'));

        // Validate YouTube URL pattern (supports watch, shorts, youtu.be, music)
        if (!preg_match('/^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?)/i', $url)) {
            return response()->json(['error' => 'URL harus berupa link YouTube yang valid (youtube.com atau youtu.be).'], 422);
        }

        // Normalize URL: strip playlist/radio/mix params, keep only video ID
        // e.g. youtube.com/watch?v=ID&list=RDxxx&start_radio=1 → youtube.com/watch?v=ID
        $url = $this->normalizeYoutubeUrl($url);

        $tmpDir = storage_path('app/yt_tmp');
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }

        $token   = Str::random(32);
        $tmpBase = $tmpDir . '/' . $token;
        $ytdlp   = '/usr/local/bin/yt-dlp';

        // Check yt-dlp exists
        if (!file_exists($ytdlp)) {
            return response()->json(['error' => 'Layanan YouTube belum siap di server. Hubungi administrator.'], 503);
        }

        // Step 1: Get metadata (JSON dump) — no --flat-playlist to avoid playlist-mode interference
        $metaCmd = $ytdlp
            . ' --dump-json --no-playlist --quiet --no-warnings'
            . ' --socket-timeout 30'
            . ' ' . escapeshellarg($url)
            . ' 2>&1';

        exec($metaCmd, $metaLines, $exitCode);
        $metaOutput = implode('', $metaLines);
        $meta       = json_decode($metaOutput, true);

        if (!$meta || !isset($meta['title'])) {
            // Try once more without --no-playlist in case it's a single video with playlist context
            $metaCmd2 = $ytdlp
                . ' --dump-json --playlist-items 1 --quiet --no-warnings'
                . ' --socket-timeout 30'
                . ' ' . escapeshellarg($url)
                . ' 2>&1';
            exec($metaCmd2, $metaLines2, $exitCode2);
            $meta = json_decode(implode('', $metaLines2), true);
        }

        if (!$meta || !isset($meta['title'])) {
            return response()->json([
                'error' => 'Tidak bisa membaca info video. Pastikan link valid, publik, dan bukan live stream yang sedang berlangsung.',
            ], 422);
        }

        $duration = (int)($meta['duration'] ?? 0);

        // Reject only true live streams (duration = 0 and is_live flag)
        if ($duration === 0 && !empty($meta['is_live'])) {
            return response()->json(['error' => 'Live stream tidak bisa diunduh. Gunakan video yang sudah selesai.'], 422);
        }

        // Step 2: Download audio as m4a
        $dlCmd = $ytdlp
            . ' --no-playlist -x --audio-format m4a --audio-quality 128K'
            . ' -o ' . escapeshellarg($tmpBase . '.%(ext)s')
            . ' --quiet --no-warnings'
            . ' --socket-timeout 120'
            . ' ' . escapeshellarg($url)
            . ' 2>&1';

        exec($dlCmd, $dlOutput, $dlExit);

        // Find the downloaded file (might be .m4a or .aac etc)
        $audioFile = $tmpBase . '.m4a';
        if (!file_exists($audioFile)) {
            $files     = glob($tmpBase . '.*');
            $audioFile = ($files && count($files) > 0) ? $files[0] : null;
        }

        if (!$audioFile || !file_exists($audioFile)) {
            return response()->json([
                'error' => 'Gagal mengunduh audio. Mungkin video dibatasi, private, atau tidak tersedia di wilayah server.',
            ], 422);
        }

        // Step 3: Determine thumbnail URL (use YouTube CDN directly, no download)
        $videoId      = $meta['id'] ?? null;
        $thumbnailUrl = null;
        if ($videoId) {
            foreach (['maxresdefault', 'hqdefault', 'mqdefault', 'default'] as $quality) {
                $t       = "https://i.ytimg.com/vi/{$videoId}/{$quality}.jpg";
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
