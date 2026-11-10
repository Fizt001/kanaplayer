<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false);
            $table->timestamp('premium_until')->nullable();
        });

        Schema::create('play_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('track_id')->constrained()->cascadeOnDelete();
            $table->date('played_on');
            $table->timestamps();
            $table->unique(['user_id', 'track_id', 'played_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('play_logs');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_admin', 'premium_until']);
        });
    }
};

