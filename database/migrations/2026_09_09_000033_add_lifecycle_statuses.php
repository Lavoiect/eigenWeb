<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('status', 24)->default('active')->after('slug');
            $table->timestamp('suspended_at')->nullable()->after('status');
            $table->index('status');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->string('account_status', 24)->default('active')->after('platform_role');
            $table->timestamp('activated_at')->nullable()->after('account_status');
            $table->index(['organization_id', 'account_status'], 'users_org_account_status_idx');
        });

        DB::table('users')
            ->whereNull('activated_at')
            ->whereNotNull('email_verified_at')
            ->update(['activated_at' => DB::raw('email_verified_at')]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_org_account_status_idx');
            $table->dropColumn(['account_status', 'activated_at']);
        });

        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'suspended_at']);
        });
    }
};
