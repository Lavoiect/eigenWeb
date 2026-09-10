<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_assignments', function (Blueprint $table): void {
            $table->foreignId('assigned_to_job_title_id')
                ->nullable()
                ->after('assigned_to_team_id')
                ->constrained('job_titles')
                ->nullOnDelete();

            $table->index(['course_id', 'assigned_to_job_title_id']);
        });
    }

    public function down(): void
    {
        Schema::table('course_assignments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('assigned_to_job_title_id');
        });
    }
};
