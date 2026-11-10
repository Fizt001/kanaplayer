<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Track extends Model
{
    protected $fillable = [
        'title', 'artist', 'album', 'duration', 'path',
        'mime', 'cover_path', 'size', 'hash', 'genre', 'track_no', 'lyrics',
    ];

    protected $appends = ['stream_url', 'cover_url'];

    public function getStreamUrlAttribute(): string
    {
        return route('tracks.stream', $this->id);
    }

    public function getCoverUrlAttribute(): ?string
    {
        return $this->cover_path ? route('tracks.cover', $this->id) : null;
    }
}
