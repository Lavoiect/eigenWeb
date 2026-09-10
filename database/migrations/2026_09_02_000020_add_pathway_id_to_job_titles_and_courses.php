<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_titles', function (Blueprint $table): void {
            $table->foreignId('pathway_id')
                ->nullable()
                ->after('description')
                ->constrained('pathways')
                ->nullOnDelete();

            $table->index(['organization_id', 'pathway_id']);
        });

        Schema::table('courses', function (Blueprint $table): void {
            $table->foreignId('pathway_id')
                ->nullable()
                ->after('created_by_id')
                ->constrained('pathways')
                ->nullOnDelete();

            $table->index(['organization_id', 'pathway_id']);
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('pathway_id');
        });

        Schema::table('job_titles', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('pathway_id');
        });
    }
};
