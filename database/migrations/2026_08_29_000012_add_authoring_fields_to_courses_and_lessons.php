<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table): void {
            $table->string('subject')->nullable()->after('slug');
            $table->unsignedInteger('estimated_minutes')->nullable()->after('description');
            $table->unsignedTinyInteger('passing_score')->nullable()->after('estimated_minutes');
        });

        Schema::table('lessons', function (Blueprint $table): void {
            $table->json('content')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table): void {
            $table->dropColumn(['subject', 'estimated_minutes', 'passing_score']);
        });

        Schema::table('lessons', function (Blueprint $table): void {
            $table->dropColumn('content');
        });
    }
};
