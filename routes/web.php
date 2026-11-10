<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PlaylistController;
use App\Http\Controllers\TrackController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
});

// Semua yang di bawah ini wajib login (tanpa daftar tidak bisa masuk).
Route::middleware('auth')->group(function () {
    Route::get('/', fn () => view('player'))->name('home');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/tracks', [TrackController::class, 'index']);
    Route::get('/me', [TrackController::class, 'me']);
    Route::post('/tracks/{track}/play', [TrackController::class, 'play']);
    Route::get('/tracks/{track}/stream', [TrackController::class, 'stream'])->name('tracks.stream');
    Route::get('/tracks/{track}/cover', [TrackController::class, 'cover'])->name('tracks.cover');
    Route::post('/tracks/{track}/favorite', [TrackController::class, 'favorite']);

    Route::get('/playlists', [PlaylistController::class, 'index']);
    Route::post('/playlists', [PlaylistController::class, 'store']);
    Route::patch('/playlists/{playlist}', [PlaylistController::class, 'update']);
    Route::delete('/playlists/{playlist}', [PlaylistController::class, 'destroy']);
    Route::post('/playlists/{playlist}/tracks', [PlaylistController::class, 'addTrack']);
    Route::delete('/playlists/{playlist}/tracks/{track}', [PlaylistController::class, 'removeTrack']);

    // Hanya admin: kelola pustaka dan member.
    Route::middleware('admin')->group(function () {
        Route::post('/tracks', [TrackController::class, 'store']);
        Route::delete('/tracks/{track}', [TrackController::class, 'destroy']);

        Route::get('/admin', [AdminController::class, 'index'])->name('admin');
        Route::post('/admin/members/{user}/activate', [AdminController::class, 'activate'])->name('admin.activate');
        Route::post('/admin/members/{user}/revoke', [AdminController::class, 'revoke'])->name('admin.revoke');
    });
});
