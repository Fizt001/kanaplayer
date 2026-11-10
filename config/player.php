<?php

return [
    // Jumlah lagu berbeda yang boleh diputar per hari oleh member free.
    'free_daily_limit' => (int) env('FREE_DAILY_LIMIT', 5),

    // Pendaftar dengan email ini otomatis menjadi admin (pengelola musik).
    'admin_email' => env('ADMIN_EMAIL'),

    // Info pembayaran yang ditampilkan saat kuota habis.
    'payment_info' => env('PAYMENT_INFO', 'Transfer ke rekening admin lalu kirim ID member Anda.'),
    'premium_price' => env('PREMIUM_PRICE', ''),
];

