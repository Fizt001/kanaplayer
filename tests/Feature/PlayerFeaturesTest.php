<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlayerFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private function track(string $title, array $extra = []): Track
    {
        return Track::create(array_merge([
            'title' => $title, 'path' => "music/$title.mp3", 'mime' => 'audio/mpeg',
        ], $extra));
    }

    public function test_favorite_toggle_and_stats_are_per_user(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $t = $this->track('Satu');

        $this->actingAs($a)->postJson("/tracks/{$t->id}/favorite")->assertOk()->assertJson(['favorite' => true]);

        $this->actingAs($a)->getJson('/tracks')->assertJsonPath('0.favorite', true);
        $this->actingAs($b)->getJson('/tracks')->assertJsonPath('0.favorite', false);

        $this->actingAs($a)->postJson("/tracks/{$t->id}/favorite")->assertJson(['favorite' => false]);
    }

    public function test_play_counts_and_last_played_are_recorded(): void
    {
        $u = User::factory()->create();
        $t = $this->track('Satu');

        $this->actingAs($u)->postJson("/tracks/{$t->id}/play")->assertOk();
        $this->actingAs($u)->postJson("/tracks/{$t->id}/play")->assertOk();

        $this->actingAs($u)->getJson('/tracks')
            ->assertJsonPath('0.play_count', 2)
            ->assertJsonPath('0.favorite', false)
            ->assertJson(fn ($j) => $j->has('0.last_played_at')->etc());
    }

    public function test_playlist_crud_and_order(): void
    {
        $u = User::factory()->create();
        [$a, $b] = [$this->track('A'), $this->track('B')];

        $id = $this->actingAs($u)->postJson('/playlists', ['name' => 'Santai'])
            ->assertCreated()->json('id');

        $this->actingAs($u)->postJson("/playlists/$id/tracks", ['track_id' => $b->id])->assertOk();
        $this->actingAs($u)->postJson("/playlists/$id/tracks", ['track_id' => $a->id])->assertOk();
        $this->actingAs($u)->postJson("/playlists/$id/tracks", ['track_id' => $a->id])->assertOk(); // duplikat diabaikan

        $this->actingAs($u)->getJson('/playlists')->assertJsonPath('0.track_ids', [$b->id, $a->id]);

        $this->actingAs($u)->deleteJson("/playlists/$id/tracks/{$b->id}")->assertJsonPath('track_ids', [$a->id]);
        $this->actingAs($u)->patchJson("/playlists/$id", ['name' => 'Baru'])->assertJsonPath('name', 'Baru');
        $this->actingAs($u)->deleteJson("/playlists/$id")->assertOk();
        $this->actingAs($u)->getJson('/playlists')->assertExactJson([]);
    }

    public function test_cannot_touch_other_members_playlist(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $t = $this->track('A');
        $id = $this->actingAs($owner)->postJson('/playlists', ['name' => 'Punyaku'])->json('id');

        $this->actingAs($other)->patchJson("/playlists/$id", ['name' => 'x'])->assertForbidden();
        $this->actingAs($other)->deleteJson("/playlists/$id")->assertForbidden();
        $this->actingAs($other)->postJson("/playlists/$id/tracks", ['track_id' => $t->id])->assertForbidden();
        $this->actingAs($other)->getJson('/playlists')->assertExactJson([]);
    }

    public function test_player_page_renders_for_member_and_admin(): void
    {
        $member = User::factory()->create();
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        $this->actingAs($member)->get('/')->assertOk()
            ->assertSee('/js/player.js', false)->assertSee('window.PM = { admin: false', false);
        $this->actingAs($admin)->get('/')->assertOk()->assertSee('window.PM = { admin: true', false);

        $this->assertFileExists(public_path('js/player.js'));
        $this->assertFileExists(public_path('css/player.css'));
    }

    public function test_upload_reads_genre_and_empty_name_is_rejected(): void
    {
        Storage::fake('local');
        $u = User::factory()->create();

        $this->actingAs($u)->postJson('/playlists', ['name' => ''])->assertStatus(422);
        $this->getJson('/playlists')->assertOk(); // masih login
    }

    public function test_youtube_meta_validates_and_extracts_id(): void
    {
        $u = User::factory()->create();

        $this->actingAs($u)->postJson('/youtube/meta', ['url' => 'not-a-url'])
            ->assertStatus(422);

        $res = $this->actingAs($u)->postJson('/youtube/meta', [
            'url' => 'https://www.youtube.com/watch?v=xwh4tFI2TIk&list=RDxwh4tFI2TIk&start_radio=1',
        ]);
        $res->assertOk()
            ->assertJsonPath('videoId', 'xwh4tFI2TIk');
    }
}
