<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_resources', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('featured')->default(false);
            $table->string('organization_role', 64)->nullable();
            $table->date('revision_date')->nullable();
            $table->string('status', 24)->default('active');
            $table->timestamp('archived_at')->nullable();
            $table->unsignedInteger('current_version')->default(1);
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'featured']);
            $table->index(['organization_id', 'category']);
            $table->index(['organization_id', 'organization_role']);
        });
    }

    public function down(): void
    {
        // A prior failed migrate can leave the child table behind in MySQL, so drop it first.
        Schema::dropIfExists('organization_resource_versions');
        Schema::dropIfExists('organization_resources');
    }
};
