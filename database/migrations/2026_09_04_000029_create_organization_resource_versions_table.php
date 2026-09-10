<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_resource_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('organization_resource_id')->constrained('organization_resources')->cascadeOnDelete();
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('disk', 32);
            $table->string('path');
            $table->string('url');
            $table->string('original_name');
            $table->string('mime_type', 191)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->timestamps();

            $table->unique(['organization_resource_id', 'version_number'], 'orv_resource_version_unique');
            $table->index(['organization_resource_id', 'created_at'], 'orv_resource_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_resource_versions');
    }
};
