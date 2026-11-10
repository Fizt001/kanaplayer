<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'premium_until' => 'datetime',
        ];
    }

    public function playLogs(): HasMany
    {
        return $this->hasMany(PlayLog::class);
    }

    /** ID member yang dibagikan ke admin, mis. MBR00012. */
    public function getMemberCodeAttribute(): string
    {
        return sprintf('MBR%05d', $this->id);
    }

    public function isPremium(): bool
    {
        return $this->is_admin || ($this->premium_until && $this->premium_until->isFuture());
    }

    public function playsToday(): int
    {
        return $this->playLogs()->whereDate('played_on', today())->count();
    }
}
