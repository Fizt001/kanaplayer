<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Track;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaylistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $lists = Playlist::where('user_id', $request->user()->id)
            ->with('tracks:id')
            ->orderBy('name')
            ->get()
            ->map(fn (Playlist $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'track_ids' => $p->tracks->pluck('id')->values()->all(),
            ]);

        return response()->json($lists);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string|max:80']);

        $playlist = Playlist::create(['user_id' => $request->user()->id, 'name' => trim($data['name'])]);

        return response()->json($playlist->payload(), 201);
    }

    public function update(Request $request, Playlist $playlist): JsonResponse
    {
        $this->own($request, $playlist);
        $data = $request->validate(['name' => 'required|string|max:80']);
        $playlist->update(['name' => trim($data['name'])]);

        return response()->json($playlist->payload());
    }

    public function destroy(Request $request, Playlist $playlist): JsonResponse
    {
        $this->own($request, $playlist);
        $playlist->delete();

        return response()->json(['ok' => true]);
    }

    public function addTrack(Request $request, Playlist $playlist): JsonResponse
    {
        $this->own($request, $playlist);
        $data = $request->validate(['track_id' => 'required|integer|exists:tracks,id']);

        $position = (int) $playlist->tracks()->max('playlist_track.position') + 1;
        $playlist->tracks()->syncWithoutDetaching([$data['track_id'] => ['position' => $position]]);

        return response()->json($playlist->payload());
    }

    public function removeTrack(Request $request, Playlist $playlist, Track $track): JsonResponse
    {
        $this->own($request, $playlist);
        $playlist->tracks()->detach($track->id);

        return response()->json($playlist->payload());
    }

    private function own(Request $request, Playlist $playlist): void
    {
        abort_unless($playlist->user_id === $request->user()->id, 403);
    }
}

