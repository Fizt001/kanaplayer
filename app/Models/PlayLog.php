<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayLog extends Model
{
    protected $fillable = ['user_id', 'track_id', 'played_on'];

    protected $casts = ['played_on' => 'date'];
}

