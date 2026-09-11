<?php

use App\Models\Course;
use App\Models\CourseReview;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\User;
use App\Notifications\CourseReviewAssigned;
use App\Notifications\CourseReviewDecisionMade;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function reviewableCourse(Organization $organization, User $author): array
{
    $course = Course::create([
        'organization_id' => $organization->id,
        'created_by_id' => $author->id,
        'title' => 'Lockout Safety',
        'slug' => 'lockout-safety',
        'content_type' => 'course',
        'description' => 'Safe lockout procedures.',
        'learning_objectives' => ['Identify each lockout step'],
        'estimated_minutes' => 12,
        'passing_score' => 80,
        'status' => 'draft',
    ]);
    $lesson = Lesson::create([
        'course_id' => $course->id,
        'title' => 'Prepare for lockout',
        'slug' => 'prepare-for-lockout',
        'position' => 1,
        'status' => 'draft',
        'content' => [[
            'id' => 'step-one',
            'type' => 'text',
            'text' => 'Notify affected employees before shutdown.',
        ]],
    ]);

    return [$course, $lesson];
}

test('an administrator can send a frozen course revision to a manager for review', function () {
    Notification::fake();
    $organization = Organization::factory()->create();
    $author = User::factory()->organizationAdmin($organization)->create();
    $reviewer = User::factory()->manager($organization)->create();
    [$course, $lesson] = reviewableCourse($organization, $author);

    $this->actingAs($author)
        ->post(route('organizations.courses.reviews.store', [$organization, $course]), [
            'reviewer_id' => $reviewer->id,
            'due_at' => now()->addWeek()->toDateString(),
            'note' => 'Please verify the shutdown sequence.',
        ])
        ->assertRedirect();

    $review = CourseReview::query()->firstOrFail();

    expect($review->revision_number)->toBe(1)
        ->and($review->status)->toBe(CourseReview::STATUS_IN_REVIEW)
        ->and(data_get($review->snapshot, 'course.title'))->toBe('Lockout Safety')
        ->and(data_get($review->snapshot, 'lessons.0.content.0.id'))->toBe('step-one')
        ->and($review->content_hash)->toHaveLength(64);

    Notification::assertSentTo($reviewer, CourseReviewAssigned::class);

    $this->actingAs($reviewer)
        ->get(route('organizations.course-reviews.show', [$organization, $review]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organizations/courses/review')
            ->where('review.id', $review->id)
            ->where('review.content_matches', true)
            ->where('can_decide', true));

    $this->actingAs($reviewer)
        ->post(route('organizations.course-reviews.comments.store', [$organization, $review]), [
            'lesson_id' => $lesson->id,
            'block_id' => 'step-one',
            'body' => 'Clarify who is responsible for this notification.',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('course_review_comments', [
        'course_review_id' => $review->id,
        'lesson_id' => $lesson->id,
        'block_id' => 'step-one',
    ]);
});

test('an assigned reviewer can approve the exact revision and enable publishing', function () {
    Notification::fake();
    $organization = Organization::factory()->create();
    $author = User::factory()->organizationAdmin($organization)->create();
    $reviewer = User::factory()->manager($organization)->create();
    [$course, $lesson] = reviewableCourse($organization, $author);

    $this->actingAs($author)->post(
        route('organizations.courses.reviews.store', [$organization, $course]),
        ['reviewer_id' => $reviewer->id],
    );
    $review = CourseReview::query()->firstOrFail();

    $this->actingAs($author)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id],
        ])
        ->assertSessionHasErrors('published_lesson_ids');

    $this->actingAs($reviewer)
        ->patch(route('organizations.course-reviews.decision.update', [$organization, $review]), [
            'decision' => CourseReview::STATUS_APPROVED,
            'note' => 'The procedure is ready.',
        ])
        ->assertRedirect();

    Notification::assertSentTo($author, CourseReviewDecisionMade::class);

    $this->actingAs($author)
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id],
        ])
        ->assertRedirect();

    expect($review->fresh()->status)->toBe(CourseReview::STATUS_APPROVED)
        ->and($course->fresh()->status)->toBe('published')
        ->and($lesson->fresh()->status)->toBe('published');
});

test('course changes after approval require a new review before publishing', function () {
    Notification::fake();
    $organization = Organization::factory()->create();
    $author = User::factory()->organizationAdmin($organization)->create();
    $reviewer = User::factory()->manager($organization)->create();
    [$course, $lesson] = reviewableCourse($organization, $author);

    $this->actingAs($author)->post(
        route('organizations.courses.reviews.store', [$organization, $course]),
        ['reviewer_id' => $reviewer->id],
    );
    $review = CourseReview::query()->firstOrFail();

    $this->actingAs($reviewer)->patch(
        route('organizations.course-reviews.decision.update', [$organization, $review]),
        ['decision' => CourseReview::STATUS_APPROVED],
    );

    $lesson->update([
        'content' => [[
            'id' => 'step-one',
            'type' => 'text',
            'text' => 'This changed after approval.',
        ]],
    ]);

    $this->actingAs($author)
        ->from(route('organizations.courses.show', [$organization, $course]))
        ->patch(route('organizations.courses.update', [$organization, $course]), [
            'status' => 'published',
            'published_lesson_ids' => [$lesson->id],
        ])
        ->assertSessionHasErrors([
            'published_lesson_ids' => 'The course changed after review. Send the latest version for review before publishing.',
        ]);

    expect($course->fresh()->status)->toBe('draft');
});

test('review access is limited to the assigned reviewer and organization administrators', function () {
    Notification::fake();
    $organization = Organization::factory()->create();
    $author = User::factory()->organizationAdmin($organization)->create();
    $reviewer = User::factory()->manager($organization)->create();
    $learner = User::factory()->learner($organization)->create();
    $otherManager = User::factory()->manager($organization)->create();
    [$course] = reviewableCourse($organization, $author);

    $this->actingAs($author)->post(
        route('organizations.courses.reviews.store', [$organization, $course]),
        ['reviewer_id' => $reviewer->id],
    );
    $review = CourseReview::query()->firstOrFail();

    $this->actingAs($learner)
        ->get(route('organizations.course-reviews.show', [$organization, $review]))
        ->assertForbidden();

    $this->actingAs($otherManager)
        ->get(route('organizations.course-reviews.show', [$organization, $review]))
        ->assertForbidden();
});

test('requested changes are resubmitted as a new revision without replacing review history', function () {
    Notification::fake();
    $organization = Organization::factory()->create();
    $author = User::factory()->organizationAdmin($organization)->create();
    $reviewer = User::factory()->manager($organization)->create();
    [$course, $lesson] = reviewableCourse($organization, $author);

    $this->actingAs($author)->post(
        route('organizations.courses.reviews.store', [$organization, $course]),
        ['reviewer_id' => $reviewer->id],
    );
    $firstReview = CourseReview::query()->firstOrFail();

    $this->actingAs($reviewer)->patch(
        route('organizations.course-reviews.decision.update', [$organization, $firstReview]),
        [
            'decision' => CourseReview::STATUS_CHANGES_REQUESTED,
            'note' => 'Clarify who performs the shutdown.',
        ],
    );

    $lesson->update([
        'content' => [[
            'id' => 'step-one',
            'type' => 'text',
            'text' => 'The equipment operator performs the shutdown.',
        ]],
    ]);

    $this->actingAs($author)->post(
        route('organizations.courses.reviews.store', [$organization, $course]),
        ['reviewer_id' => $reviewer->id],
    );

    $reviews = CourseReview::query()->oldest('revision_number')->get();

    expect($reviews)->toHaveCount(2)
        ->and($reviews[0]->revision_number)->toBe(1)
        ->and(data_get($reviews[0]->snapshot, 'lessons.0.content.0.text'))
        ->toBe('Notify affected employees before shutdown.')
        ->and($reviews[1]->revision_number)->toBe(2)
        ->and(data_get($reviews[1]->snapshot, 'lessons.0.content.0.text'))
        ->toBe('The equipment operator performs the shutdown.');

    $this->actingAs($author)
        ->get(route('organizations.course-reviews.show', [$organization, $reviews[1]]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('review_history', 2)
            ->where('review_history.0.revision_number', 2)
            ->where('review_history.1.revision_number', 1));
});
