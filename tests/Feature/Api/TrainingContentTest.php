<?php

use App\Models\Course;
use App\Models\CourseAssignment;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('courses are scoped to the current role', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $manager = User::factory()->manager($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $team = Team::factory()->create([
        'organization_id' => $organization->id,
    ]);

    $manager->managedTeams()->attach($team, [
        'assigned_by_id' => $admin->id,
    ]);
    $learner->teams()->attach($team, [
        'created_by_id' => $admin->id,
    ]);

    $adminOnly = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Admin Only',
        'slug' => 'admin-only',
        'description' => 'Draft training',
        'status' => 'draft',
        'published_at' => null,
    ]);
    $teamCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Team Course',
        'slug' => 'team-course',
        'description' => 'Assigned to a team',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $managerCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Manager Course',
        'slug' => 'manager-course',
        'description' => 'Assigned directly to manager',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $learnerCourse = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Learner Course',
        'slug' => 'learner-course',
        'description' => 'Assigned directly to learner',
        'status' => 'published',
        'published_at' => now(),
    ]);

    Lesson::create([
        'course_id' => $teamCourse->id,
        'title' => 'Lesson 1',
        'slug' => 'lesson-1',
        'body' => 'First lesson',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
    ]);
    Lesson::create([
        'course_id' => $teamCourse->id,
        'title' => 'Lesson 2',
        'slug' => 'lesson-2',
        'body' => 'Second lesson',
        'position' => 2,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $draftLesson = Lesson::create([
        'course_id' => $teamCourse->id,
        'title' => 'Lesson 3 draft',
        'slug' => 'lesson-3-draft',
        'body' => 'Not ready for learners',
        'position' => 3,
        'status' => 'draft',
        'published_at' => null,
    ]);

    CourseAssignment::create([
        'course_id' => $teamCourse->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_team_id' => $team->id,
    ]);
    CourseAssignment::create([
        'course_id' => $managerCourse->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $manager->id,
    ]);
    CourseAssignment::create([
        'course_id' => $learnerCourse->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learner->id,
    ]);

    Sanctum::actingAs($admin, ['mobile-api']);

    $adminCourses = $this->getJson('/api/v1/courses')
        ->assertOk()
        ->json('courses');

    expect(collect($adminCourses)->pluck('title')->all())
        ->toContain('Admin Only', 'Team Course', 'Manager Course', 'Learner Course');
    expect(collect($adminCourses)->firstWhere('title', 'Admin Only')['content_type'])
        ->toBe('course');

    Sanctum::actingAs($manager, ['mobile-api']);

    $managerCourses = $this->getJson('/api/v1/courses')
        ->assertOk()
        ->json('courses');

    expect(collect($managerCourses)->pluck('title')->all())
        ->toContain('Team Course', 'Manager Course')
        ->not->toContain('Admin Only')
        ->not->toContain('Learner Course');
    expect(collect($managerCourses)->firstWhere('title', 'Team Course')['lesson_count'])
        ->toBe(2);

    $this->getJson("/api/v1/courses/{$teamCourse->id}")
        ->assertOk()
        ->assertJsonPath('course.id', $teamCourse->id)
        ->assertJsonCount(2, 'course.lessons');
    $this->getJson("/api/v1/courses/{$teamCourse->id}/lessons/{$draftLesson->id}")
        ->assertForbidden();

    Sanctum::actingAs($learner, ['mobile-api']);

    $learnerCourses = $this->getJson('/api/v1/courses')
        ->assertOk()
        ->json('courses');

    expect(collect($learnerCourses)->pluck('title')->all())
        ->toContain('Team Course', 'Learner Course')
        ->not->toContain('Admin Only')
        ->not->toContain('Manager Course');
});

test('lesson completion updates progress and completion state', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $team = Team::factory()->create([
        'organization_id' => $organization->id,
    ]);

    $learner->teams()->attach($team, [
        'created_by_id' => $admin->id,
    ]);

    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Progress Course',
        'slug' => 'progress-course',
        'description' => 'A course with two lessons',
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);

    $lessonOne = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Lesson 1',
        'slug' => 'lesson-1',
        'body' => 'Lesson 1 body',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $lessonTwo = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Lesson 2',
        'slug' => 'lesson-2',
        'body' => 'Lesson 2 body',
        'position' => 2,
        'status' => 'published',
        'published_at' => now(),
    ]);

    CourseAssignment::create([
        'course_id' => $course->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_team_id' => $team->id,
    ]);

    Sanctum::actingAs($learner, ['mobile-api']);

    $this->postJson("/api/v1/courses/{$course->id}/lessons/{$lessonOne->id}/complete", [
        'score_percent' => 100,
        'scored_questions_count' => 99,
        'correct_questions_count' => 99,
        'question_attempts' => [
            [
                'question_key' => 'lesson-one-question',
                'question_type' => 'true_false',
                'question_prompt' => 'An intentionally missed question.',
                'attempts_count' => 1,
                'missed_attempts_count' => 1,
                'correct_attempts_count' => 0,
                'was_correct' => false,
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Lesson completed.')
        ->assertJsonPath('lesson.is_completed', true)
        ->assertJsonPath('progress.completed_lessons_count', 1)
        ->assertJsonPath('progress.total_lessons_count', 2)
        ->assertJsonPath('progress.progress_percent', 50)
        ->assertJsonPath('progress.score_percent', 0)
        ->assertJsonPath('progress.scored_questions_count', 1)
        ->assertJsonPath('progress.correct_questions_count', 0)
        ->assertJsonPath('progress.passed', false);

    $this->assertDatabaseHas('lesson_completions', [
        'lesson_id' => $lessonOne->id,
        'user_id' => $learner->id,
    ]);

    $this->assertDatabaseHas('course_progress', [
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'completed_lessons_count' => 1,
        'total_lessons_count' => 2,
        'progress_percent' => 50,
    ]);

    $this->postJson("/api/v1/courses/{$course->id}/lessons/{$lessonTwo->id}/complete", [
        'score_percent' => 80,
        'scored_questions_count' => 5,
        'correct_questions_count' => 4,
        'question_attempts' => [
            [
                'question_key' => 'question-1',
                'question_type' => 'multiple_choice',
                'question_prompt' => 'What is the first step?',
                'attempts_count' => 2,
                'missed_attempts_count' => 1,
                'correct_attempts_count' => 1,
                'was_correct' => true,
            ],
            [
                'question_key' => 'question-2',
                'question_type' => 'true_false',
                'question_prompt' => 'This is a safe practice.',
                'attempts_count' => 1,
                'missed_attempts_count' => 0,
                'correct_attempts_count' => 1,
                'was_correct' => true,
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('lesson.is_completed', true)
        ->assertJsonPath('progress.completed_lessons_count', 2)
        ->assertJsonPath('progress.total_lessons_count', 2)
        ->assertJsonPath('progress.progress_percent', 100)
        ->assertJsonPath('progress.score_percent', 67)
        ->assertJsonPath('progress.scored_questions_count', 3)
        ->assertJsonPath('progress.correct_questions_count', 2)
        ->assertJsonPath('progress.passed', false);

    $this->assertDatabaseHas('course_progress', [
        'course_id' => $course->id,
        'user_id' => $learner->id,
        'completed_lessons_count' => 2,
        'total_lessons_count' => 2,
        'progress_percent' => 100,
        'score_percent' => 67,
        'scored_questions_count' => 3,
        'correct_questions_count' => 2,
        'passed' => 0,
    ]);

    $this->assertDatabaseHas('lesson_question_attempts', [
        'organization_id' => $organization->id,
        'course_id' => $course->id,
        'lesson_id' => $lessonTwo->id,
        'user_id' => $learner->id,
        'question_key' => 'question-1',
        'question_type' => 'multiple_choice',
        'attempts_count' => 2,
        'missed_attempts_count' => 1,
        'correct_attempts_count' => 1,
        'was_correct' => 1,
    ]);

    $this->getJson('/api/v1/progress')
        ->assertOk()
        ->assertJsonCount(1, 'progress')
        ->assertJsonPath('progress.0.course_id', $course->id)
        ->assertJsonPath('progress.0.score_percent', 67)
        ->assertJsonPath('progress.0.scored_questions_count', 3)
        ->assertJsonPath('progress.0.correct_questions_count', 2)
        ->assertJsonPath('progress.0.passed', false);

    $this->getJson('/api/v1/assignments')
        ->assertOk()
        ->assertJsonCount(1, 'assignments')
        ->assertJsonPath('assignments.0.course.id', $course->id)
        ->assertJsonPath('assignments.0.course.progress.score_percent', 67);

    $this->getJson("/api/v1/courses/{$course->id}/lessons/{$lessonTwo->id}")
        ->assertOk()
        ->assertJsonPath('lesson.id', $lessonTwo->id);

    $this->getJson("/api/v1/courses/{$course->id}")
        ->assertOk()
        ->assertJsonPath('course.progress.score_percent', 67)
        ->assertJsonPath('course.progress.passed', false);
});

test('only final assessment questions determine the course passing score', function () {
    $organization = Organization::factory()->create();
    $admin = User::factory()->organizationAdmin($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $admin->id,
        'title' => 'Assessment Scoring',
        'slug' => 'assessment-scoring',
        'passing_score' => 80,
        'status' => 'published',
        'published_at' => now(),
    ]);
    $practice = $course->lessons()->create([
        'title' => 'Practice checks',
        'slug' => 'practice-checks',
        'position' => 1,
        'status' => 'published',
        'published_at' => now(),
        'is_final_assessment' => false,
    ]);
    $assessment = $course->lessons()->create([
        'title' => 'Final assessment',
        'slug' => 'final-assessment',
        'position' => 2,
        'status' => 'published',
        'published_at' => now(),
        'is_final_assessment' => true,
    ]);
    CourseAssignment::create([
        'course_id' => $course->id,
        'assigned_by_id' => $admin->id,
        'assigned_to_user_id' => $learner->id,
    ]);

    Sanctum::actingAs($learner, ['mobile-api']);

    $practiceAttempt = [[
        'question_key' => 'practice-question',
        'question_type' => 'true_false',
        'question_prompt' => 'Practice only',
        'was_correct' => false,
    ]];

    $this->postJson("/api/v1/courses/{$course->id}/lessons/{$practice->id}/complete", [
        'score_percent' => 0,
        'scored_questions_count' => 1,
        'correct_questions_count' => 0,
        'passed' => false,
        'question_attempts' => $practiceAttempt,
    ])
        ->assertOk()
        ->assertJsonPath('progress.score_percent', null)
        ->assertJsonPath('progress.scored_questions_count', 0)
        ->assertJsonPath('progress.passed', null);

    $this->postJson("/api/v1/courses/{$course->id}/lessons/{$assessment->id}/complete", [
        'score_percent' => 50,
        'scored_questions_count' => 2,
        'correct_questions_count' => 1,
        'passed' => false,
        'question_attempts' => [
            [
                'question_key' => 'final-question-1',
                'question_type' => 'multiple_choice',
                'question_prompt' => 'Final question one',
                'was_correct' => true,
            ],
            [
                'question_key' => 'final-question-2',
                'question_type' => 'true_false',
                'question_prompt' => 'Final question two',
                'was_correct' => false,
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('progress.score_percent', 50)
        ->assertJsonPath('progress.scored_questions_count', 2)
        ->assertJsonPath('progress.correct_questions_count', 1)
        ->assertJsonPath('progress.passed', false);

    $this->postJson("/api/v1/courses/{$course->id}/lessons/{$practice->id}/complete", [
        'score_percent' => 100,
        'scored_questions_count' => 1,
        'correct_questions_count' => 1,
        'passed' => true,
        'question_attempts' => [[
            ...$practiceAttempt[0],
            'was_correct' => true,
        ]],
    ])
        ->assertOk()
        ->assertJsonPath('progress.score_percent', 50)
        ->assertJsonPath('progress.scored_questions_count', 2)
        ->assertJsonPath('progress.correct_questions_count', 1)
        ->assertJsonPath('progress.passed', false);

    $this->getJson("/api/v1/courses/{$course->id}")
        ->assertOk()
        ->assertJsonPath('course.lessons.1.is_final_assessment', true);
});
