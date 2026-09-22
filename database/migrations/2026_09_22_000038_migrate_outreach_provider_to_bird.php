<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('outreach_email_accounts')
            ->where('provider', 'mailgun')
            ->update(['provider' => 'bird']);
    }

    public function down(): void
    {
        DB::table('outreach_email_accounts')
            ->where('provider', 'bird')
            ->update(['provider' => 'mailgun']);
    }
};
