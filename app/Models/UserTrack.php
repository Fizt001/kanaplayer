<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserTrack extends Model
{
    protected $fillable = ['user_id', 'track_id', 'is_favorite', 'play_count', 'last_played_at'];

    protected $casts = [
        'is_favorite' => 'boolean',
        'last_played_at' => 'datetime',
    ];
}

