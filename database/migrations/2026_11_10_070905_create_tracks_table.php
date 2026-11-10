<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('artist')->nullable();
            $table->string('album')->nullable();
            $table->unsignedInteger('duration')->default(0);
            $table->string('path');
            $table->string('mime')->nullable();
            $table->string('cover_path')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('hash', 64)->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracks');
    }
};
