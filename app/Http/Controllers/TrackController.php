<?php

namespace App\Http\Controllers;

use App\Models\PlayLog;
use App\Models\Track;
use App\Models\UserTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TrackController extends Controller
{
    private const ALLOWED = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac'];

    public function index(Request $request): JsonResponse
    {
        $stats = UserTrack::where('user_id', $request->user()->id)->get()->keyBy('track_id');

        $tracks = Track::orderBy('title')->get()->map(function (Track $t) use ($stats) {
            $s = $stats->get($t->id);

            return array_merge($t->toArray(), [
                'favorite' => (bool) $s?->is_favorite,
                'play_count' => (int) ($s?->play_count ?? 0),
                'last_played_at' => $s?->last_played_at?->toIso8601String(),
            ]);
        });

        return response()->json($tracks);
    }

    /** Tandai / hapus tanda favorit. */
    public function favorite(Request $request, Track $track): JsonResponse
    {
        $row = UserTrack::firstOrCreate(['user_id' => $request->user()->id, 'track_id' => $track->id]);
        $row->update(['is_favorite' => ! $row->is_favorite]);

        return response()->json(['favorite' => $row->is_favorite]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files' => 'required|array',
            'files.*' => 'file|max:204800', // 200 MB
        ]);

        $created = [];
        $skipped = [];

        foreach ($request->file('files') as $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            if (! in_array($ext, self::ALLOWED, true)) {
                $skipped[] = $file->getClientOriginalName();
                continue;
            }

            $hash = hash_file('sha256', $file->getRealPath());
            if (Track::where('hash', $hash)->exists()) {
                $skipped[] = $file->getClientOriginalName();
                continue;
            }

            $meta = $this->readMeta($file->getRealPath());
            $path = $file->storeAs('music', Str::uuid().'.'.$ext, 'local');

            $coverPath = null;
            if ($meta['cover']) {
                $coverPath = 'covers/'.Str::uuid().'.'.$meta['cover_ext'];
                Storage::disk('local')->put($coverPath, $meta['cover']);
            }

            $created[] = Track::create([
                'title' => $meta['title'] ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'artist' => $meta['artist'],
                'album' => $meta['album'],
                'duration' => $meta['duration'],
                'genre' => $meta['genre'],
                'track_no' => $meta['track_no'],
                'lyrics' => $meta['lyrics'],
                'path' => $path,
                'mime' => $file->getMimeType(),
                'cover_path' => $coverPath,
                'size' => $file->getSize(),
                'hash' => $hash,
            ]);
        }

        return response()->json(['created' => $created, 'skipped' => $skipped], 201);
    }

    /** Status kuota member yang sedang login. */
    public function me(Request $request): JsonResponse
    {
        return response()->json($this->quota($request->user()));
    }

    /**
     * Dipanggil sebelum lagu diputar. Member free dibatasi N lagu berbeda per hari;
     * memutar ulang lagu yang sama di hari yang sama tidak mengurangi kuota.
     */
    public function play(Request $request, Track $track): JsonResponse
    {
        $user = $request->user();

        if (! $user->isPremium()) {
            $already = PlayLog::where('user_id', $user->id)
                ->where('track_id', $track->id)
                ->whereDate('played_on', today())
                ->exists();

            if (! $already) {
                if ($user->playsToday() >= config('player.free_daily_limit')) {
                    return response()->json([
                        'message' => 'Kuota harian habis. Upgrade ke premium untuk lanjut memutar.',
                        'payment_info' => config('player.payment_info'),
                        'price' => config('player.premium_price'),
                        'member_code' => $user->member_code,
                        ...$this->quota($user),
                    ], 402);
                }

                PlayLog::create([
                    'user_id' => $user->id,
                    'track_id' => $track->id,
                    'played_on' => today(),
                ]);
            }
        }

        // Statistik untuk "Terakhir diputar" dan "Paling sering diputar".
        $stat = UserTrack::firstOrCreate(['user_id' => $user->id, 'track_id' => $track->id]);
        $stat->forceFill([
            'play_count' => $stat->play_count + 1,
            'last_played_at' => now(),
        ])->save();

        return response()->json($this->quota($user->fresh()));
    }

    public function stream(Request $request, Track $track): BinaryFileResponse
    {
        $user = $request->user();

        // Free hanya boleh men-stream lagu yang sudah lolos play() hari ini.
        abort_unless(
            $user->isPremium() || PlayLog::where('user_id', $user->id)
                ->where('track_id', $track->id)
                ->whereDate('played_on', today())
                ->exists(),
            402,
            'Kuota harian habis.'
        );

        // BinaryFileResponse otomatis mendukung HTTP Range (seek).
        return response()->file(Storage::disk('local')->path($track->path), [
            'Content-Type' => $track->mime ?: 'audio/mpeg',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function cover(Track $track): BinaryFileResponse
    {
        abort_unless($track->cover_path, 404);

        return response()->file(Storage::disk('local')->path($track->cover_path), [
            'Cache-Control' => 'private, max-age=604800',
        ]);
    }

    public function update(Request $request, Track $track): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'artist' => 'nullable|string|max:200',
            'album' => 'nullable|string|max:200',
            'genre' => 'nullable|string|max:100',
            'track_no' => 'nullable|integer|min:0|max:65535',
            'lyrics' => 'nullable|string|max:65535',
        ]);

        foreach (['artist', 'album', 'genre', 'lyrics'] as $k) {
            if (array_key_exists($k, $data)) {
                $data[$k] = $data[$k] !== null && trim($data[$k]) !== '' ? trim($data[$k]) : null;
            }
        }
        $data['track_no'] = ! empty($data['track_no']) ? (int) $data['track_no'] : null;

        $track->update($data);

        return response()->json($track->fresh());
    }

    public function destroy(Track $track): JsonResponse
    {
        Storage::disk('local')->delete(array_filter([$track->path, $track->cover_path]));
        $track->delete();

        return response()->json(['ok' => true]);
    }

    private function quota($user): array
    {
        $limit = config('player.free_daily_limit');
        $premium = $user->isPremium();

        return [
            'name' => $user->name,
            'member_code' => $user->member_code,
            'is_admin' => $user->is_admin,
            'premium' => $premium,
            'premium_until' => $user->premium_until?->toDateString(),
            'limit' => $premium ? null : $limit,
            'used' => $user->playsToday(),
            'remaining' => $premium ? null : max(0, $limit - $user->playsToday()),
            'payment_info' => config('player.payment_info'),
            'price' => config('player.premium_price'),
        ];
    }

    private function readMeta(string $file): array
    {
        $out = ['title' => null, 'artist' => null, 'album' => null, 'genre' => null, 'track_no' => null, 'lyrics' => null, 'duration' => 0, 'cover' => null, 'cover_ext' => 'jpg'];

        try {
            $info = (new \getID3)->analyze($file);
            \getid3_lib::CopyTagsToComments($info);

            $out['title'] = $info['comments_html']['title'][0] ?? null;
            $out['artist'] = $info['comments_html']['artist'][0] ?? null;
            $out['album'] = $info['comments_html']['album'][0] ?? null;
            $out['genre'] = $info['comments_html']['genre'][0] ?? null;
            $no = (int) ($info['comments_html']['track_number'][0] ?? 0);
            $out['track_no'] = $no > 0 && $no < 65535 ? $no : null;
            $out['duration'] = (int) round($info['playtime_seconds'] ?? 0);

            // html entity -> teks biasa
            foreach (['title', 'artist', 'album', 'genre'] as $k) {
                if ($out[$k]) {
                    $out[$k] = html_entity_decode($out[$k], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
            }

            $out['lyrics'] = $info['comments']['unsynched_lyrics'][0]
                ?? $info['id3v2']['comments']['unsynchronised_lyric'][0]
                ?? $info['comments']['lyrics'][0]
                ?? null;

            if ($out['lyrics']) {
                $out['lyrics'] = trim(html_entity_decode((string) $out['lyrics'], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }

            if (! empty($info['comments']['picture'][0]['data'])) {
                $pic = $info['comments']['picture'][0];
                $out['cover'] = $pic['data'];
                $out['cover_ext'] = str_contains($pic['image_mime'] ?? '', 'png') ? 'png' : 'jpg';
            }
        } catch (\Throwable $e) {
            // abaikan, pakai nama file sebagai judul
        }

        return $out;
    }
}
