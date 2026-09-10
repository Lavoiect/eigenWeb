<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_assets', function (Blueprint $table): void {
            $table->unsignedInteger('sort_order')->default(0)->after('kind');
            $table->index(['course_id', 'kind', 'sort_order']);
        });

        $assets = DB::table('course_assets')
            ->select(['id', 'course_id', 'created_at'])
            ->orderBy('course_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('course_id');

        foreach ($assets as $courseAssets) {
            foreach ($courseAssets->values() as $index => $asset) {
                DB::table('course_assets')
                    ->where('id', $asset->id)
                    ->update(['sort_order' => $index + 1]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('course_assets', function (Blueprint $table): void {
            $table->dropIndex(['course_id', 'kind', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
