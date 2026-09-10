<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lesson_question_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lesson_completion_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('organization_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('course_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('lesson_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->string('question_key');
            $table->string('question_type', 50);
            $table->text('question_prompt')->nullable();
            $table->unsignedSmallInteger('attempts_count')->default(1);
            $table->unsignedSmallInteger('missed_attempts_count')->default(0);
            $table->unsignedSmallInteger('correct_attempts_count')->default(0);
            $table->boolean('was_correct')->default(false);
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'completed_at']);
            $table->index(['course_id', 'lesson_id']);
            $table->index(['lesson_id', 'question_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_question_attempts');
    }
};
