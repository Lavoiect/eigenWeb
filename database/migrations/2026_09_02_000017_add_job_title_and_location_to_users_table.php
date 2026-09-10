<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('job_title_id')
                ->nullable()
                ->after('organization_role')
                ->constrained('job_titles')
                ->nullOnDelete();

            $table->foreignId('location_id')
                ->nullable()
                ->after('job_title_id')
                ->constrained('locations')
                ->nullOnDelete();

            $table->index(['organization_id', 'job_title_id']);
            $table->index(['organization_id', 'location_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('job_title_id');
            $table->dropConstrainedForeignId('location_id');
        });
    }
};
