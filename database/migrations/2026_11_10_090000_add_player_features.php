<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            $table->string('genre')->nullable();
            $table->unsignedSmallInteger('track_no')->nullable();
        });

        // Statistik & favorit per member per lagu.
        Schema::create('user_tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_favorite')->default(false);
            $table->unsignedInteger('play_count')->default(0);
            $table->timestamp('last_played_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'track_id']);
        });

        Schema::create('playlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('playlist_track', function (Blueprint $table) {
            $table->id();
            $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique(['playlist_id', 'track_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playlist_track');
        Schema::dropIfExists('playlists');
        Schema::dropIfExists('user_tracks');
        Schema::table('tracks', function (Blueprint $table) {
            $table->dropColumn(['genre', 'track_no']);
        });
    }
};

