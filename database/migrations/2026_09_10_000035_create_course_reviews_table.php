<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('revision_number');
            $table->foreignId('submitted_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('in_review');
            $table->json('snapshot');
            $table->char('content_hash', 64);
            $table->text('submitter_note')->nullable();
            $table->date('due_at')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('decided_at')->nullable();
            $table->text('decision_note')->nullable();
            $table->timestamps();

            $table->unique(['course_id', 'revision_number'], 'course_reviews_course_revision_uq');
            $table->index(['reviewer_id', 'status'], 'course_reviews_reviewer_status_idx');
            $table->index(['organization_id', 'status'], 'course_reviews_org_status_idx');
        });

        Schema::create('course_review_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('course_review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $table->string('block_id')->nullable();
            $table->text('body');
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['course_review_id', 'lesson_id'], 'course_review_comments_lesson_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_review_comments');
        Schema::dropIfExists('course_reviews');
    }
};
