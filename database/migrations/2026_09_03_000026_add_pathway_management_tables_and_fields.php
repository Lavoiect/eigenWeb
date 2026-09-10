<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pathways', function (Blueprint $table): void {
            $table->boolean('sequential_completion')->default(false)->after('description');
            $table->unsignedSmallInteger('expected_completion_days')->nullable()->after('sequential_completion');
        });

        Schema::create('pathway_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pathway_id')->constrained()->cascadeOnDelete();
            $table->string('item_type');
            $table->foreignId('course_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(true);
            $table->timestamps();

            $table->unique('course_id');
            $table->unique('lesson_id');
            $table->index(['pathway_id', 'sort_order']);
        });

        Schema::create('pathway_milestones', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pathway_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['pathway_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pathway_milestones');
        Schema::dropIfExists('pathway_items');

        Schema::table('pathways', function (Blueprint $table): void {
            $table->dropColumn(['sequential_completion', 'expected_completion_days']);
        });
    }
};
