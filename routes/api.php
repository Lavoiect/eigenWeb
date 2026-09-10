<?php

use App\Http\Controllers\Api\V1\AssignmentController;
use App\Http\Controllers\Api\V1\AuthPasswordResetLinkController;
use App\Http\Controllers\Api\V1\AuthTokenController;
use App\Http\Controllers\Api\V1\CourseController;
use App\Http\Controllers\Api\V1\LessonController;
use App\Http\Controllers\Api\V1\MePushTokenController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\MePasswordController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\OrganizationCourseAssignmentController;
use App\Http\Controllers\Api\V1\OrganizationCourseController;
use App\Http\Controllers\Api\V1\OrganizationCourseLessonController;
use App\Http\Controllers\Api\V1\ResourceController;
use App\Http\Controllers\Api\V1\ProgressController;
use App\Http\Controllers\Api\V1\TeamController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/token', [AuthTokenController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('api.v1.auth.token.store');
    Route::post('auth/password-reset-link', [AuthPasswordResetLinkController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('api.v1.auth.password-reset-link.store');

    Route::middleware(['auth:sanctum', 'password.changed'])->group(function () {
        Route::get('me', [MeController::class, 'show'])
            ->name('api.v1.me.show');
        Route::put('me/password', [MePasswordController::class, 'update'])
            ->name('api.v1.me.password.update');
        Route::post('me/push-token', [MePushTokenController::class, 'store'])
            ->name('api.v1.me.push-token.store');

        Route::get('assignments', [AssignmentController::class, 'index'])
            ->name('api.v1.assignments.index');

        Route::get('progress', [ProgressController::class, 'index'])
            ->name('api.v1.progress.index');

        Route::get('resources', [ResourceController::class, 'index'])
            ->name('api.v1.resources.index');

        Route::get('courses', [CourseController::class, 'index'])
            ->name('api.v1.courses.index');
        Route::get('courses/{course}', [CourseController::class, 'show'])
            ->name('api.v1.courses.show');
        Route::get('courses/{course}/lessons/{lesson}', [LessonController::class, 'show'])
            ->name('api.v1.lessons.show');
        Route::post('courses/{course}/lessons/{lesson}/complete', [LessonController::class, 'complete'])
            ->name('api.v1.lessons.complete');

        Route::prefix('organization')->group(function () {
            Route::get('/', [OrganizationController::class, 'show'])
                ->name('api.v1.organization.show');
            Route::get('users', [OrganizationController::class, 'users'])
                ->name('api.v1.organization.users.index');
            Route::get('teams', [OrganizationController::class, 'teams'])
                ->name('api.v1.organization.teams.index');
            Route::get('invitations', [OrganizationController::class, 'invitations'])
                ->name('api.v1.organization.invitations.index');

            Route::prefix('courses')->group(function () {
                Route::get('/', [OrganizationCourseController::class, 'index'])
                    ->name('api.v1.organization.courses.index');
                Route::post('/', [OrganizationCourseController::class, 'store'])
                    ->name('api.v1.organization.courses.store');
                Route::get('{course}', [OrganizationCourseController::class, 'show'])
                    ->name('api.v1.organization.courses.show');
                Route::patch('{course}', [OrganizationCourseController::class, 'update'])
                    ->name('api.v1.organization.courses.update');
                Route::delete('{course}', [OrganizationCourseController::class, 'destroy'])
                    ->name('api.v1.organization.courses.destroy');

                Route::post('{course}/lessons', [OrganizationCourseLessonController::class, 'store'])
                    ->name('api.v1.organization.courses.lessons.store');
                Route::patch('{course}/lessons/{lesson}', [OrganizationCourseLessonController::class, 'update'])
                    ->name('api.v1.organization.courses.lessons.update');
                Route::delete('{course}/lessons/{lesson}', [OrganizationCourseLessonController::class, 'destroy'])
                    ->name('api.v1.organization.courses.lessons.destroy');

                Route::post('{course}/assignments', [OrganizationCourseAssignmentController::class, 'store'])
                    ->name('api.v1.organization.courses.assignments.store');
                Route::delete('{course}/assignments/{assignment}', [OrganizationCourseAssignmentController::class, 'destroy'])
                    ->name('api.v1.organization.courses.assignments.destroy');
            });
        });

        Route::delete('auth/token', [AuthTokenController::class, 'destroy'])
            ->name('api.v1.auth.token.destroy');

        Route::get('teams', [TeamController::class, 'index'])
            ->name('api.v1.teams.index');
        Route::get('teams/{team}', [TeamController::class, 'show'])
            ->name('api.v1.teams.show');
    });
});
