<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_assignments', function (Blueprint $table): void {
            $table->foreignId('assigned_to_location_id')
                ->nullable()
                ->after('assigned_to_job_title_id')
                ->constrained('locations')
                ->nullOnDelete();
            $table->boolean('is_required')->default(true)->after('due_at');
            $table->unsignedSmallInteger('recurs_every_days')->nullable()->after('is_required');
            $table->unsignedInteger('reminder_count')->default(0)->after('recurs_every_days');
            $table->timestamp('last_reminded_at')->nullable()->after('reminder_count');

            $table->index(['course_id', 'assigned_to_location_id']);
        });
    }

    public function down(): void
    {
        Schema::table('course_assignments', function (Blueprint $table): void {
            $table->dropIndex(['course_id', 'assigned_to_location_id']);
            $table->dropConstrainedForeignId('assigned_to_location_id');
            $table->dropColumn([
                'is_required',
                'recurs_every_days',
                'reminder_count',
                'last_reminded_at',
            ]);
        });
    }
};
