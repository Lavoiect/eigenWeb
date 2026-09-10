<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_progress', function (Blueprint $table): void {
            $table->unsignedTinyInteger('score_percent')->nullable()->after('progress_percent');
            $table->unsignedInteger('scored_questions_count')->default(0)->after('score_percent');
            $table->unsignedInteger('correct_questions_count')->default(0)->after('scored_questions_count');
            $table->boolean('passed')->nullable()->after('correct_questions_count');
        });
    }

    public function down(): void
    {
        Schema::table('course_progress', function (Blueprint $table): void {
            $table->dropColumn([
                'score_percent',
                'scored_questions_count',
                'correct_questions_count',
                'passed',
            ]);
        });
    }
};
