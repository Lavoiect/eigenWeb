<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_resources', function (Blueprint $table): void {
            $table->string('resource_type', 32)->default('file')->after('course_id');
            $table->json('quick_guide_content')->nullable()->after('description');
            $table->string('video_url')->nullable()->after('quick_guide_content');
            $table->string('external_url')->nullable()->after('video_url');
            $table->boolean('audience_everyone')->default(true)->after('organization_role');
            $table->json('job_title_ids')->nullable()->after('audience_everyone');
            $table->json('team_ids')->nullable()->after('job_title_ids');
            $table->json('location_ids')->nullable()->after('team_ids');
            $table->json('course_ids')->nullable()->after('location_ids');
            $table->date('effective_date')->nullable()->after('revision_date');
            $table->date('review_date')->nullable()->after('effective_date');
            $table->date('expiration_date')->nullable()->after('review_date');
            $table->timestamp('published_at')->nullable()->after('expiration_date');
            $table->unsignedInteger('view_count')->default(0)->after('current_version');

            $table->index(['organization_id', 'resource_type'], 'org_resources_type_idx');
            $table->index(['organization_id', 'review_date'], 'org_resources_review_idx');
        });
    }

    public function down(): void
    {
        Schema::table('organization_resources', function (Blueprint $table): void {
            $table->dropIndex('org_resources_type_idx');
            $table->dropIndex('org_resources_review_idx');
            $table->dropColumn([
                'resource_type',
                'quick_guide_content',
                'video_url',
                'external_url',
                'audience_everyone',
                'job_title_ids',
                'team_ids',
                'location_ids',
                'course_ids',
                'effective_date',
                'review_date',
                'expiration_date',
                'published_at',
                'view_count',
            ]);
        });
    }
};
