<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Playlist extends Model
{
    protected $fillable = ['user_id', 'name'];

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class, 'playlist_track')
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function payload(): array
    {
        $this->load('tracks:id');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'track_ids' => $this->tracks->pluck('id')->values()->all(),
        ];
    }
}

