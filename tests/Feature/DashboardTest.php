<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $organization = Organization::factory()->create();
    $user = User::factory()->learner($organization)->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->missing('overview.demo_mode')
            ->where('overview.metrics.total_employees', 1)
            ->where('overview.metrics.active_learners', 0)
            ->where('overview.metrics.completion_rate', 0)
            ->where('overview.metrics.overdue_assignments', 0)
            ->where('overview.metrics.average_assessment_score', null)
            ->where('overview.metrics.training_requiring_attention', 0)
            ->where('overview.training_progress.completed', 0)
            ->where('overview.training_progress.in_progress', 0)
            ->where('overview.training_progress.overdue', 0)
            ->where('overview.training_progress.not_started', 0)
            ->has('overview.attention_items', 0)
            ->has('overview.recent_activity', 0)
            ->has('overview.team_comparison', 0),
        );
});

test('learners can see the transcript shortcut on the dashboard', function () {
    $organization = Organization::factory()->create();
    $learner = User::factory()->learner($organization)->create();

    $this->actingAs($learner)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('auth.abilities.can_view_own_training', true),
        );
});

test('organization admins can see the dashboard overview metrics', function () {
    Carbon::setTestNow(Carbon::parse('2026-08-31 12:00:00'));

    $organization = Organization::factory()->create([
        'name' => 'Northwind Training',
    ]);
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $learnerOne = User::factory()->learner($organization)->create([
        'name' => 'Maya Johnson',
        'email' => 'maya@example.com',
    ]);
    $learnerTwo = User::factory()->learner($organization)->create([
        'name' => 'Luis Garcia',
        'email' => 'luis@example.com',
    ]);
    $learnerThree = User::factory()->learner($organization)->create([
        'name' => 'Jordan Lee',
        'email' => 'jordan@example.com',
    ]);

    $teamA = Team::create([
        'organization_id' => $organization->id,
        'name' => 'Field Operations',
        'description' => 'Frontline field team',
    ]);
    $teamB = Team::create([
        'organization_id' => $organization->id,
        'name' => 'Warehouse',
        'description' => 'Warehouse shift team',
    ]);

    $manager->managedTeams()->attach($teamA, [
        'assigned_by_id' => $admin->id,
    ]);
    $learnerOne->teams()->attach($teamA, [
        'created_by_id' => $admin->id,
    ]);
    $learnerTwo->teams()->attach($teamA, [
        'created_by_id' => $admin->id,
    ]);
    $learnerThree->teams()->attach($teamB, [
        'created_by_id' => $admin->id,
    ]);

    $courseOne = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Operations Training',
        'slug' => 'operations-training',
        'subject' => 'Operations',
        'description' => 'Primary field operations course.',
        'estimated_minutes' => 30,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now()->subWeeks(2),
    ]);
    $courseTwo = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Warehouse Safety',
        'slug' => 'warehouse-safety',
        'subject' => 'Safety',
        'description' => 'Warehouse safety essentials.',
        'estimated_minutes' => 25,
        'passing_score' => 75,
        'status' => 'published',
        'published_at' => now()->subWeeks(2),
    ]);

    $lessonOne = Lesson::create([
        'course_id' => $courseOne->id,
        'title' => 'Field setup',
        'slug' => 'field-setup',
        'body' => 'Field setup lesson.',
        'position' => 1,
        'duration_minutes' => 10,
        'status' => 'published',
        'published_at' => now()->subWeeks(2),
    ]);
    $lessonTwo = Lesson::create([
        'course_id' => $courseOne->id,
        'title' => 'Tools and process',
        'slug' => 'tools-and-process',
        'body' => 'Tools and process lesson.',
        'position' => 2,
        'duration_minutes' => 10,
        'status' => 'published',
        'published_at' => now()->subWeeks(2),
    ]);
    $lessonThree = Lesson::create([
        'course_id' => $courseTwo->id,
        'title' => 'Warehouse hazards',
        'slug' => 'warehouse-hazards',
        'body' => 'Warehouse hazards lesson.',
        'position' => 1,
        'duration_minutes' => 12,
        'status' => 'published',
        'published_at' => now()->subWeeks(2),
    ]);

    CourseAssignment::create([
        'course_id' => $courseOne->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_team_id' => $teamA->id,
        'due_at' => now()->subDay(),
    ]);
    CourseAssignment::create([
        'course_id' => $courseOne->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learnerOne->id,
        'due_at' => now()->subDays(2),
    ]);
    CourseAssignment::create([
        'course_id' => $courseTwo->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learnerThree->id,
        'due_at' => now()->addWeek(),
    ]);

    CourseProgress::create([
        'course_id' => $courseOne->id,
        'user_id' => $learnerOne->id,
        'status' => 'completed',
        'completed_lessons_count' => 2,
        'total_lessons_count' => 2,
        'progress_percent' => 100,
        'score_percent' => 92,
        'scored_questions_count' => 10,
        'correct_questions_count' => 9,
        'passed' => true,
        'last_completed_lesson_id' => $lessonTwo->id,
        'completed_at' => now()->subDays(2),
    ]);
    CourseProgress::create([
        'course_id' => $courseOne->id,
        'user_id' => $learnerTwo->id,
        'status' => 'in_progress',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 2,
        'progress_percent' => 50,
        'score_percent' => 67,
        'scored_questions_count' => 10,
        'correct_questions_count' => 7,
        'passed' => false,
        'last_completed_lesson_id' => $lessonOne->id,
    ]);
    CourseProgress::create([
        'course_id' => $courseTwo->id,
        'user_id' => $learnerThree->id,
        'status' => 'completed',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 1,
        'progress_percent' => 100,
        'score_percent' => 81,
        'scored_questions_count' => 8,
        'correct_questions_count' => 7,
        'passed' => true,
        'last_completed_lesson_id' => $lessonThree->id,
        'completed_at' => now()->subDay(),
    ]);

    LessonCompletion::create([
        'lesson_id' => $lessonOne->id,
        'user_id' => $learnerOne->id,
        'completed_at' => now()->subDays(2),
    ]);
    LessonCompletion::create([
        'lesson_id' => $lessonTwo->id,
        'user_id' => $learnerTwo->id,
        'completed_at' => now()->subDay(),
    ]);
    LessonCompletion::create([
        'lesson_id' => $lessonThree->id,
        'user_id' => $learnerThree->id,
        'completed_at' => now()->subDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('overview.scope_label', 'Northwind Training')
            ->where('overview.date_range.key', '30d')
            ->where('overview.date_range.display_label', 'Aug 2, 2026 - Aug 31, 2026')
            ->where('overview.metrics.total_employees', 5)
            ->where('overview.metrics.active_learners', 3)
            ->where('overview.metrics.completion_rate', 67)
            ->where('overview.metrics.overdue_assignments', 1)
            ->where('overview.metrics.average_assessment_score', 81)
            ->where('overview.metrics.training_requiring_attention', 1)
            ->where('overview.training_progress.completed', 2)
            ->where('overview.training_progress.in_progress', 0)
            ->where('overview.training_progress.overdue', 1)
            ->where('overview.training_progress.not_started', 0)
            ->has('overview.attention_items', 1, fn (Assert $item) => $item
                ->where('title', 'Operations Training')
                ->where('course', 'Operations')
                ->where('affected_learners', 1)
                ->where('overdue_count', 1)
                ->etc(),
            )
            ->has('overview.recent_activity', 5)
            ->has('overview.team_comparison', 2),
        );

    Carbon::setTestNow();
});
