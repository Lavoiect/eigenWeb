<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to_team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->timestamp('due_at')->nullable();
            $table->timestamps();

            $table->index(['course_id', 'assigned_to_user_id']);
            $table->index(['course_id', 'assigned_to_team_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_assignments');
    }
};
