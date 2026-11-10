<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q'));

        $members = User::query()
            ->when($q !== '', function ($query) use ($q) {
                // Cari berdasarkan ID member (MBR00012 / 12), nama, atau email.
                $id = (int) preg_replace('/\D/', '', $q);
                $query->where(function ($w) use ($q, $id) {
                    $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%");
                    if ($id > 0 && preg_match('/^(mbr)?\d+$/i', $q)) {
                        $w->orWhere('id', $id);
                    }
                });
            })
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('admin.index', compact('members', 'q'));
    }

    public function activate(Request $request, User $user)
    {
        $data = $request->validate(['days' => 'required|integer|min:1|max:3650']);

        // Perpanjang dari sisa masa aktif bila masih premium.
        $start = $user->premium_until && $user->premium_until->isFuture() ? $user->premium_until : now();
        $user->forceFill(['premium_until' => $start->copy()->addDays($data['days'])])->save();

        return back()->with('status', "{$user->member_code} ({$user->name}) premium sampai {$user->premium_until->format('d M Y')}.");
    }

    public function revoke(User $user)
    {
        $user->forceFill(['premium_until' => null])->save();

        return back()->with('status', "Premium {$user->member_code} dicabut.");
    }
}

