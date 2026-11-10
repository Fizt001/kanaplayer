<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MembershipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function track(int $n): Track
    {
        Storage::disk('local')->put("music/$n.mp3", 'x');

        return Track::create(['title' => "T$n", 'path' => "music/$n.mp3", 'mime' => 'audio/mpeg']);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
        $this->get('/tracks')->assertRedirect('/login');
    }

    public function test_free_member_limited_per_day_and_replay_is_free(): void
    {
        config(['player.free_daily_limit' => 2]);
        $u = User::factory()->create();
        [$a, $b, $c] = [$this->track(1), $this->track(2), $this->track(3)];

        $this->actingAs($u)->postJson("/tracks/{$a->id}/play")->assertOk();
        $this->actingAs($u)->postJson("/tracks/{$a->id}/play")->assertOk(); // replay gratis
        $this->actingAs($u)->postJson("/tracks/{$b->id}/play")->assertOk();
        $this->actingAs($u)->postJson("/tracks/{$c->id}/play")->assertStatus(402);

        // stream lagu yang belum lolos play() ditolak
        $this->actingAs($u)->get("/tracks/{$c->id}/stream")->assertStatus(402);
        $this->actingAs($u)->get("/tracks/{$a->id}/stream")->assertOk();
    }

    public function test_premium_has_no_limit_and_admin_can_activate(): void
    {
        config(['player.free_daily_limit' => 1]);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $u = User::factory()->create();
        [$a, $b] = [$this->track(1), $this->track(2)];

        $this->actingAs($u)->postJson("/tracks/{$a->id}/play")->assertOk();
        $this->actingAs($u)->postJson("/tracks/{$b->id}/play")->assertStatus(402);

        $this->actingAs($admin)->post("/admin/members/{$u->id}/activate", ['days' => 30])->assertRedirect();

        $this->actingAs($u->fresh())->postJson("/tracks/{$b->id}/play")->assertOk();
    }

    public function test_member_cannot_access_admin_or_upload(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u)->get('/admin')->assertForbidden();
        $this->actingAs($u)->postJson('/tracks', [])->assertForbidden();
    }
}
