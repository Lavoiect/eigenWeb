<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\CourseProgress;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use App\Models\LessonQuestionAttempt;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

test('organization admins can view reporting dashboards', function () {
    Carbon::setTestNow(Carbon::parse('2026-08-31 12:00:00'));

    $organization = Organization::factory()->create([
        'name' => 'Northwind Training',
    ]);
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learnerOne = User::factory()->learner($organization)->create([
        'name' => 'Maya Johnson',
    ]);
    $learnerTwo = User::factory()->learner($organization)->create([
        'name' => 'Luis Garcia',
    ]);

    $courseOne = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Operations Training',
        'slug' => 'operations-training',
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
        'description' => 'Safety essentials.',
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

    Lesson::create([
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
        'assigned_to_user_id' => $learnerOne->id,
        'due_at' => now()->subDay(),
    ]);
    CourseAssignment::create([
        'course_id' => $courseTwo->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learnerTwo->id,
        'due_at' => now()->subDay(),
    ]);

    CourseProgress::create([
        'course_id' => $courseOne->id,
        'user_id' => $learnerOne->id,
        'status' => 'completed',
        'completed_lessons_count' => 1,
        'total_lessons_count' => 1,
        'progress_percent' => 100,
        'score_percent' => 92,
        'scored_questions_count' => 10,
        'correct_questions_count' => 9,
        'passed' => true,
        'last_completed_lesson_id' => $lessonOne->id,
        'completed_at' => now()->subDay(),
    ]);

    LessonCompletion::create([
        'lesson_id' => $lessonOne->id,
        'user_id' => $learnerOne->id,
        'completed_at' => now()->subDay(),
    ]);

    LessonQuestionAttempt::create([
        'lesson_completion_id' => LessonCompletion::query()
            ->where('lesson_id', $lessonOne->id)
            ->where('user_id', $learnerOne->id)
            ->value('id'),
        'organization_id' => $organization->id,
        'course_id' => $courseOne->id,
        'lesson_id' => $lessonOne->id,
        'user_id' => $learnerOne->id,
        'question_key' => 'question-1',
        'question_type' => 'multiple_choice',
        'question_prompt' => 'What is the first step?',
        'attempts_count' => 6,
        'missed_attempts_count' => 3,
        'correct_attempts_count' => 3,
        'was_correct' => true,
        'completed_at' => now()->subDay(),
    ]);

    LessonQuestionAttempt::create([
        'lesson_completion_id' => LessonCompletion::query()
            ->where('lesson_id', $lessonOne->id)
            ->where('user_id', $learnerOne->id)
            ->value('id'),
        'organization_id' => $organization->id,
        'course_id' => $courseOne->id,
        'lesson_id' => $lessonOne->id,
        'user_id' => $learnerOne->id,
        'question_key' => 'small-sample-question',
        'question_type' => 'true_false',
        'question_prompt' => 'Is one response enough to establish a trend?',
        'attempts_count' => 1,
        'missed_attempts_count' => 1,
        'correct_attempts_count' => 0,
        'was_correct' => false,
        'completed_at' => now()->subDay(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.reports.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/reports/index')
            ->where('organization.id', $organization->id)
            ->where('reporting.summary.total_employees', 3)
            ->where('reporting.summary.assigned_learners', 2)
            ->where('reporting.summary.active_learners', 1)
            ->where('reporting.summary.completion_rate', 50)
            ->where('reporting.summary.overdue_training', 1)
            ->where('reporting.summary.average_assessment_score', 92)
            ->where('reporting.summary.employees_requiring_intervention', 1)
            ->where('reporting.summary.training_gap_summary', 1)
            ->where('reporting.date_range.display_label', 'Aug 2, 2026 - Aug 31, 2026')
            ->has('reporting.completion_by_course', 2)
            ->has('reporting.completion_by_job_title', 1)
            ->has('reporting.completion_by_team', 0)
            ->has('reporting.completion_by_location', 1)
            ->where('reporting.assignment_status.completed', 1)
            ->where('reporting.assignment_status.overdue', 1)
            ->where('reporting.assessment_summary.scored_assessments', 1)
            ->where('reporting.knowledge_gap_threshold', 5)
            ->where('reporting.insufficient_question_groups', 1)
            ->has('reporting.missed_questions', 1)
            ->where('reporting.missed_questions.0.failure_rate', 50)
            ->where('reporting.missed_questions.0.procedure_label', 'Operations Training')
            ->where('reporting.missed_questions.0.refresher_target_type', 'user')
            ->where('reporting.missed_questions.0.refresher_target_id', $learnerOne->id)
            ->where('reporting.missed_questions.0.refresher_target_label', $learnerOne->name)
            ->where(
                'reporting.missed_questions.0.refresher_action_url',
                route('organizations.courses.show', [
                    'organization' => $organization,
                    'course' => $courseOne,
                    'lesson' => $lessonOne->id,
                    'gap' => 'question-1',
                    'assignment_focus' => 1,
                    'assignment_target_type' => 'user',
                    'assignment_target_id' => $learnerOne->id,
                    'assignment_due_at' => now()->addDays(7)->toDateString(),
                ]),
            )
            ->where('reporting.employee_rows', fn ($rows): bool => collect($rows)->firstWhere('id', $admin->id)['completion_rate'] === null)
            ->has('reporting.definitions', 9),
        );

    Carbon::setTestNow();
});

test('organization admins can export reporting csv', function () {
    $organization = Organization::factory()->create([
        'name' => 'Northwind Training',
    ]);
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();

    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Operations Training',
        'slug' => 'operations-training',
        'description' => 'Primary field operations course.',
        'estimated_minutes' => 30,
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);

    CourseAssignment::create([
        'course_id' => $course->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learner->id,
        'due_at' => now()->addDay(),
    ]);

    CourseProgress::create([
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'status' => 'completed',
        'completed_lessons_count' => 0,
        'total_lessons_count' => 0,
        'progress_percent' => 100,
        'score_percent' => 90,
        'scored_questions_count' => 5,
        'correct_questions_count' => 5,
        'passed' => true,
        'completed_at' => now(),
    ]);

    $response = $this->actingAs($admin)
        ->get(route('organizations.reports.export', [$organization, 'range' => '30d']));

    $response->assertOk()
        ->assertDownload(Str::slug($organization->name).'-current-view-30d.csv');

    $content = $response->streamedContent();

    expect($content)
        ->toContain('completion_by_course')
        ->toContain('Operations Training');

    $assessmentExport = $this->actingAs($admin)
        ->get(route('organizations.reports.export', [
            $organization,
            'range' => '30d',
            'report' => 'assessments',
        ]));

    $assessmentExport
        ->assertOk()
        ->assertDownload(Str::slug($organization->name).'-assessments-30d.csv');

    expect($assessmentExport->streamedContent())
        ->toContain('assessment_scores')
        ->toContain('Operations Training');
});

test('reporting excludes deactivated employees by default and can include them explicitly', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    User::factory()->learner($organization)->create();
    User::factory()->learner($organization)->create([
        'deactivated_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('organizations.reports.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('reporting.summary.total_employees', 2)
            ->where('reporting.filters.employee_status', 'active')
            ->has('reporting.active_filter_labels', 0),
        );

    $this->actingAs($admin)
        ->get(route('organizations.reports.index', [$organization, 'employee_status' => 'all']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('reporting.summary.total_employees', 3)
            ->where('reporting.filters.employee_status', 'all')
            ->where('reporting.active_filter_labels.0', 'All employees'),
        );
});

test('managers cannot access organization reporting', function () {
    $organization = Organization::factory()->create();
    $manager = User::factory()->manager($organization)->create();

    $this->actingAs($manager)
        ->get(route('organizations.reports.index', $organization))
        ->assertForbidden();
});
