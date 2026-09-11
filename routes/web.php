<?php

use App\Http\Controllers\CourseReviewController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LearnerTranscriptController;
use App\Http\Controllers\OrganizationCourseManagementController;
use App\Http\Controllers\OrganizationInvitationController;
use App\Http\Controllers\OrganizationPathwayController;
use App\Http\Controllers\OrganizationReportingController;
use App\Http\Controllers\OrganizationResourceController;
use App\Http\Controllers\OrganizationUserController;
use App\Http\Controllers\PlatformOrganizationController;
use App\Models\Team;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::get('invitations/{invite:token}', [OrganizationInvitationController::class, 'show'])
    ->name('invitations.show');
Route::post('invitations/{invite:token}/switch-account', [OrganizationInvitationController::class, 'switchAccount'])
    ->name('invitations.switch-account');

Route::middleware(['auth', 'verified', 'password.changed'])->group(function () {
    Route::prefix('platform')
        ->middleware('platform.admin')
        ->group(function () {
            Route::get('organizations', [PlatformOrganizationController::class, 'index'])
                ->name('platform.organizations.index');
            Route::post('organizations', [PlatformOrganizationController::class, 'store'])
                ->name('platform.organizations.store');
            Route::post('organizations/{organization}/manage', [PlatformOrganizationController::class, 'manage'])
                ->name('platform.organizations.manage');
            Route::patch('organizations/{organization}/status', [PlatformOrganizationController::class, 'updateStatus'])
                ->name('platform.organizations.status.update');
            Route::post('organizations/{organization}/administrators', [PlatformOrganizationController::class, 'storeAdministrator'])
                ->name('platform.organizations.administrators.store');
            Route::post('organizations/{organization}/administrators/{user}/resend-activation', [PlatformOrganizationController::class, 'resendActivation'])
                ->name('platform.organizations.administrators.resend-activation');
            Route::delete('organization-context', [PlatformOrganizationController::class, 'exit'])
                ->name('platform.organization-context.destroy');
        });

    Route::get('dashboard', [DashboardController::class, 'show'])->name('dashboard');
    Route::get('transcript', [LearnerTranscriptController::class, 'index'])
        ->name('learning.transcript');

    Route::prefix('organizations/{organization}')
        ->middleware('organization.admin')
        ->group(function () {
            Route::get('users', [OrganizationUserController::class, 'index'])
                ->name('organizations.users.index');
            Route::patch('users/bulk', [OrganizationUserController::class, 'bulkUpdate'])
                ->name('organizations.users.bulk-update');
            Route::get('users/{user}', [OrganizationUserController::class, 'show'])
                ->whereNumber('user')
                ->name('organizations.users.show');
            Route::get('users/{user}/transcript', [OrganizationUserController::class, 'transcript'])
                ->whereNumber('user')
                ->name('organizations.users.transcript');
            Route::patch('users/{user}/role', [OrganizationUserController::class, 'updateRole'])
                ->whereNumber('user')
                ->name('organizations.users.update-role');
            Route::put('users/{user}/structure', [OrganizationUserController::class, 'syncStructure'])
                ->whereNumber('user')
                ->name('organizations.users.sync-structure');
            Route::put('users/{user}/teams', [OrganizationUserController::class, 'syncTeams'])
                ->whereNumber('user')
                ->name('organizations.users.sync-teams');
            Route::patch('users/{user}/deactivate', [OrganizationUserController::class, 'deactivate'])
                ->whereNumber('user')
                ->name('organizations.users.deactivate');
            Route::post('teams', [OrganizationUserController::class, 'storeTeam'])
                ->name('organizations.teams.store');
            Route::post('job-titles', [OrganizationUserController::class, 'storeJobTitle'])
                ->name('organizations.job-titles.store');
            Route::put('job-titles/{jobTitle}/pathway', [OrganizationUserController::class, 'syncJobTitlePathway'])
                ->whereNumber('jobTitle')
                ->name('organizations.job-titles.sync-pathway');
            Route::post('pathways', [OrganizationUserController::class, 'storePathway'])
                ->name('organizations.pathways.store');
            Route::get('reports', [OrganizationReportingController::class, 'index'])
                ->name('organizations.reports.index');
            Route::get('reports/export', [OrganizationReportingController::class, 'export'])
                ->name('organizations.reports.export');
            Route::get('resources', [OrganizationResourceController::class, 'index'])
                ->name('organizations.resources.index');
            Route::post('resources', [OrganizationResourceController::class, 'store'])
                ->name('organizations.resources.store');
            Route::patch('resources/{resource}', [OrganizationResourceController::class, 'update'])
                ->whereNumber('resource')
                ->name('organizations.resources.update');
            Route::patch('resources/{resource}/archive', [OrganizationResourceController::class, 'archive'])
                ->whereNumber('resource')
                ->name('organizations.resources.archive');
            Route::get('pathways/{pathway}', [OrganizationPathwayController::class, 'show'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.show');
            Route::patch('pathways/{pathway}', [OrganizationPathwayController::class, 'update'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.update');
            Route::put('pathways/{pathway}/job-titles', [OrganizationPathwayController::class, 'syncJobTitles'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.job-titles.sync');
            Route::post('pathways/{pathway}/items', [OrganizationPathwayController::class, 'storeItem'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.items.store');
            Route::patch('pathways/{pathway}/items/reorder', [OrganizationPathwayController::class, 'reorderItems'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.items.reorder');
            Route::delete('pathways/{pathway}/items/{item}', [OrganizationPathwayController::class, 'destroyItem'])
                ->whereNumber('pathway')
                ->whereNumber('item')
                ->name('organizations.pathways.items.destroy');
            Route::post('pathways/{pathway}/milestones', [OrganizationPathwayController::class, 'storeMilestone'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.milestones.store');
            Route::patch('pathways/{pathway}/milestones/reorder', [OrganizationPathwayController::class, 'reorderMilestones'])
                ->whereNumber('pathway')
                ->name('organizations.pathways.milestones.reorder');
            Route::delete('pathways/{pathway}/milestones/{milestone}', [OrganizationPathwayController::class, 'destroyMilestone'])
                ->whereNumber('pathway')
                ->whereNumber('milestone')
                ->name('organizations.pathways.milestones.destroy');
            Route::post('locations', [OrganizationUserController::class, 'storeLocation'])
                ->name('organizations.locations.store');
            Route::get('users/import-template', [OrganizationUserController::class, 'downloadImportTemplate'])
                ->name('organizations.users.import-template');
            Route::get('users/import-sample', [OrganizationUserController::class, 'downloadImportSample'])
                ->name('organizations.users.import-sample');
            Route::post('users/bulk-invite', [OrganizationUserController::class, 'bulkStore'])
                ->name('organizations.users.bulk-invite');
            Route::post('users/import', [OrganizationUserController::class, 'importCsv'])
                ->name('organizations.users.import');

            Route::get('invitations', [OrganizationInvitationController::class, 'index'])
                ->name('organizations.invitations.index');
            Route::post('invitations', [OrganizationInvitationController::class, 'store'])
                ->name('organizations.invitations.store');
            Route::delete('invitations/{invite}', [OrganizationInvitationController::class, 'destroy'])
                ->name('organizations.invitations.destroy');

            Route::prefix('courses')->group(function () {
                Route::get('/', [OrganizationCourseManagementController::class, 'index'])
                    ->name('organizations.courses.index');
                Route::post('/', [OrganizationCourseManagementController::class, 'store'])
                    ->name('organizations.courses.store');
                Route::get('{course}', [OrganizationCourseManagementController::class, 'show'])
                    ->name('organizations.courses.show');
                Route::patch('{course}', [OrganizationCourseManagementController::class, 'update'])
                    ->name('organizations.courses.update');
                Route::patch('{course}/starter-template', [OrganizationCourseManagementController::class, 'replaceStarterTemplate'])
                    ->name('organizations.courses.starter-template.update');
                Route::post('{course}/duplicate', [OrganizationCourseManagementController::class, 'duplicate'])
                    ->name('organizations.courses.duplicate');
                Route::patch('{course}/archive', [OrganizationCourseManagementController::class, 'archive'])
                    ->name('organizations.courses.archive');
                Route::post('{course}/reviews', [CourseReviewController::class, 'store'])
                    ->name('organizations.courses.reviews.store');
                Route::post('{course}/assignments', [OrganizationCourseManagementController::class, 'storeAssignment'])
                    ->name('organizations.courses.assignments.store');
                Route::patch('{course}/assignments/{assignment}', [OrganizationCourseManagementController::class, 'updateAssignment'])
                    ->whereNumber('assignment')
                    ->name('organizations.courses.assignments.update');
                Route::post('{course}/assignments/{assignment}/remind', [OrganizationCourseManagementController::class, 'remindAssignment'])
                    ->whereNumber('assignment')
                    ->name('organizations.courses.assignments.remind');
                Route::post('{course}/assignments/{assignment}/reassign', [OrganizationCourseManagementController::class, 'reassignFailedTraining'])
                    ->whereNumber('assignment')
                    ->name('organizations.courses.assignments.reassign');
                Route::delete('{course}/assignments/{assignment}', [OrganizationCourseManagementController::class, 'destroyAssignment'])
                    ->whereNumber('assignment')
                    ->name('organizations.courses.assignments.destroy');
                Route::post('{course}/assets', [OrganizationCourseManagementController::class, 'uploadAsset'])
                    ->name('organizations.courses.assets.store');
                Route::patch('{course}/assets/reorder', [OrganizationCourseManagementController::class, 'reorderAssets'])
                    ->name('organizations.courses.assets.reorder');
                Route::patch('{course}/assets/{asset}', [OrganizationCourseManagementController::class, 'replaceAsset'])
                    ->whereNumber('asset')
                    ->name('organizations.courses.assets.update');
                Route::delete('{course}/assets/{asset}', [OrganizationCourseManagementController::class, 'destroyAsset'])
                    ->whereNumber('asset')
                    ->name('organizations.courses.assets.destroy');
                Route::delete('{course}', [OrganizationCourseManagementController::class, 'destroy'])
                    ->name('organizations.courses.destroy');

                Route::post('{course}/lessons', [OrganizationCourseManagementController::class, 'storeLesson'])
                    ->name('organizations.courses.lessons.store');
                Route::post('{course}/lessons/{lesson}/duplicate', [OrganizationCourseManagementController::class, 'duplicateLesson'])
                    ->name('organizations.courses.lessons.duplicate');
                Route::patch('{course}/lessons/reorder', [OrganizationCourseManagementController::class, 'reorderLessons'])
                    ->name('organizations.courses.lessons.reorder');
                Route::patch('{course}/lessons/{lesson}', [OrganizationCourseManagementController::class, 'updateLesson'])
                    ->name('organizations.courses.lessons.update');
                Route::delete('{course}/lessons/{lesson}', [OrganizationCourseManagementController::class, 'destroyLesson'])
                    ->name('organizations.courses.lessons.destroy');
            });
        });

    Route::prefix('organizations/{organization}/course-reviews/{review}')
        ->group(function () {
            Route::get('/', [CourseReviewController::class, 'show'])
                ->name('organizations.course-reviews.show');
            Route::post('comments', [CourseReviewController::class, 'storeComment'])
                ->name('organizations.course-reviews.comments.store');
            Route::patch('decision', [CourseReviewController::class, 'decide'])
                ->name('organizations.course-reviews.decision.update');
        });

    Route::prefix('teams/{team}')
        ->middleware('team.manager')
        ->group(function () {
            Route::get('reports', function (Team $team) {
                return response()->json([
                    'team' => $team->only(['id', 'name']),
                    'area' => 'manager',
                ]);
            })->name('teams.reports.index');
        });
});

require __DIR__.'/settings.php';
