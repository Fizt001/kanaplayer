<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LibraryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_upload_and_duplicates_and_bad_formats_are_skipped(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();

        $res = $this->actingAs($admin)->postJson('/tracks', [
            'files' => [
                UploadedFile::fake()->createWithContent('lagu satu.mp3', 'abc-isi-audio'),
                UploadedFile::fake()->createWithContent('salinan.mp3', 'abc-isi-audio'), // duplikat isi
                UploadedFile::fake()->createWithContent('catatan.txt', 'bukan audio'),
            ],
        ])->assertCreated();

        $res->assertJsonCount(1, 'created')->assertJsonCount(2, 'skipped');
        $this->assertSame(1, Track::count());
        $this->assertSame('lagu satu', Track::first()->title);
        Storage::disk('local')->assertExists(Track::first()->path);
    }

    public function test_pages_link_the_pwa_manifest_and_register_service_worker(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertSee('/manifest.webmanifest', false)
            ->assertSee("serviceWorker.register('/sw.js')", false);
    }

    public function test_pwa_assets_exist_and_manifest_is_valid(): void
    {
        foreach (['sw.js', 'offline.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'] as $f) {
            $this->assertFileExists(public_path($f));
        }

        $m = json_decode(file_get_contents(public_path('manifest.webmanifest')), true);
        $this->assertSame('standalone', $m['display']);
        foreach ($m['icons'] as $icon) {
            $this->assertFileExists(public_path(ltrim($icon['src'], '/')));
        }
    }
}

