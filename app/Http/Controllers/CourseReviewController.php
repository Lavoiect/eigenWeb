<?php

namespace App\Http\Controllers;

use App\Enums\AccountStatus;
use App\Enums\OrganizationRole;
use App\Models\Course;
use App\Models\CourseReview;
use App\Models\CourseReviewComment;
use App\Models\Organization;
use App\Notifications\CourseReviewAssigned;
use App\Notifications\CourseReviewDecisionMade;
use App\Services\CourseReviewSnapshot;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CourseReviewController extends Controller
{
    public function store(
        Request $request,
        Organization $organization,
        Course $course,
        CourseReviewSnapshot $snapshots,
    ): RedirectResponse {
        $user = $request->user()->loadMissing('organization');
        abort_unless($user->canAuthorTraining($organization), 403);
        $this->ensureCourseInOrganization($course, $organization);

        $validated = $request->validate([
            'reviewer_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->where('organization_id', $organization->getKey())
                    ->where('account_status', AccountStatus::Active->value)
                    ->whereIn('organization_role', [
                        OrganizationRole::OrganizationAdmin->value,
                        OrganizationRole::Manager->value,
                    ])),
                Rule::notIn([$user->getKey()]),
            ],
            'due_at' => ['nullable', 'date', 'after_or_equal:today'],
            'note' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($course->reviews()->where('status', CourseReview::STATUS_IN_REVIEW)->exists()) {
            throw ValidationException::withMessages([
                'reviewer_id' => 'This course already has an active review.',
            ]);
        }

        $snapshot = $snapshots->make($course);
        $review = DB::transaction(function () use ($course, $organization, $user, $validated, $snapshot, $snapshots): CourseReview {
            $nextRevision = (int) ($course->reviews()->max('revision_number') ?? 0) + 1;

            return CourseReview::create([
                'organization_id' => $organization->getKey(),
                'course_id' => $course->getKey(),
                'revision_number' => $nextRevision,
                'submitted_by_id' => $user->getKey(),
                'reviewer_id' => $validated['reviewer_id'],
                'status' => CourseReview::STATUS_IN_REVIEW,
                'snapshot' => $snapshot,
                'content_hash' => $snapshots->hash($snapshot),
                'submitter_note' => $validated['note'] ?? null,
                'due_at' => $validated['due_at'] ?? null,
                'submitted_at' => now(),
            ]);
        });

        $review->loadMissing(['organization', 'submitter', 'reviewer']);
        $review->reviewer?->notify(new CourseReviewAssigned($review));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Course sent for review.',
        ]);

        return redirect()->route('organizations.course-reviews.show', [$organization, $review]);
    }

    public function show(
        Request $request,
        Organization $organization,
        CourseReview $review,
        CourseReviewSnapshot $snapshots,
    ): Response {
        $this->ensureReviewInOrganization($review, $organization);
        $this->authorize('view', $review);
        $review->loadMissing(['course', 'submitter', 'reviewer', 'comments.user']);

        $user = $request->user();
        $contentMatches = $snapshots->hashCourse($review->course) === $review->content_hash;
        $reviewHistory = $review->course->reviews()->with('reviewer')->get();

        return Inertia::render('organizations/courses/review', [
            'organization' => $organization->only(['id', 'name', 'slug']),
            'review' => $this->reviewPayload($review, $contentMatches),
            'comments' => $review->comments->map(fn (CourseReviewComment $comment): array => [
                'id' => $comment->id,
                'lesson_id' => $comment->lesson_id,
                'block_id' => $comment->block_id,
                'body' => $comment->body,
                'resolved_at' => $comment->resolved_at?->toIso8601String(),
                'user' => $comment->user?->only(['id', 'name']),
                'created_at' => $comment->created_at?->toIso8601String(),
            ])->values(),
            'review_history' => $reviewHistory->map(fn (CourseReview $item): array => [
                'id' => $item->id,
                'revision_number' => $item->revision_number,
                'status' => $item->status,
                'status_label' => $item->statusLabel(),
                'submitted_at' => $item->submitted_at?->toIso8601String(),
                'reviewer' => $item->reviewer?->only(['id', 'name']),
                'url' => route('organizations.course-reviews.show', [$organization, $item]),
            ])->values(),
            'can_decide' => $user->can('decide', $review),
            'can_edit_course' => $user->canAuthorTraining($organization),
        ]);
    }

    public function storeComment(
        Request $request,
        Organization $organization,
        CourseReview $review,
    ): RedirectResponse {
        $this->ensureReviewInOrganization($review, $organization);
        $this->authorize('comment', $review);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'lesson_id' => ['nullable', 'integer'],
            'block_id' => ['nullable', 'string', 'max:255'],
        ]);

        $this->validateCommentAnchor(
            $review,
            $validated['lesson_id'] ?? null,
            $validated['block_id'] ?? null,
        );

        $review->comments()->create([
            'user_id' => $request->user()->getKey(),
            'lesson_id' => $validated['lesson_id'] ?? null,
            'block_id' => $validated['block_id'] ?? null,
            'body' => $validated['body'],
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Comment added.',
        ]);

        return back();
    }

    public function decide(
        Request $request,
        Organization $organization,
        CourseReview $review,
    ): RedirectResponse {
        $this->ensureReviewInOrganization($review, $organization);
        $this->authorize('decide', $review);

        if ($review->status !== CourseReview::STATUS_IN_REVIEW) {
            throw ValidationException::withMessages([
                'decision' => 'This review has already been completed.',
            ]);
        }

        $validated = $request->validate([
            'decision' => ['required', Rule::in([
                CourseReview::STATUS_APPROVED,
                CourseReview::STATUS_CHANGES_REQUESTED,
            ])],
            'note' => [
                Rule::requiredIf($request->input('decision') === CourseReview::STATUS_CHANGES_REQUESTED),
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $review->forceFill([
            'status' => $validated['decision'],
            'decision_note' => $validated['note'] ?? null,
            'decided_at' => now(),
        ])->save();

        $review->loadMissing(['organization', 'submitter', 'reviewer']);
        $review->submitter?->notify(new CourseReviewDecisionMade($review));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $review->status === CourseReview::STATUS_APPROVED
                ? 'Course approved.'
                : 'Changes requested.',
        ]);

        return back();
    }

    private function ensureCourseInOrganization(Course $course, Organization $organization): void
    {
        abort_unless($course->organization_id === $organization->getKey(), 404);
    }

    private function ensureReviewInOrganization(CourseReview $review, Organization $organization): void
    {
        abort_unless($review->organization_id === $organization->getKey(), 404);
    }

    private function validateCommentAnchor(CourseReview $review, ?int $lessonId, ?string $blockId): void
    {
        if ($lessonId === null && $blockId === null) {
            return;
        }

        $lesson = collect(data_get($review->snapshot, 'lessons', []))
            ->first(fn (array $lesson): bool => (int) ($lesson['id'] ?? 0) === $lessonId);

        if ($lesson === null) {
            throw ValidationException::withMessages([
                'lesson_id' => 'Choose a lesson from this review revision.',
            ]);
        }

        if ($blockId !== null && ! collect($lesson['content'] ?? [])->contains(
            fn (array $block): bool => (string) ($block['id'] ?? '') === $blockId,
        )) {
            throw ValidationException::withMessages([
                'block_id' => 'Choose a content block from this review revision.',
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function reviewPayload(CourseReview $review, bool $contentMatches): array
    {
        return [
            'id' => $review->id,
            'course_id' => $review->course_id,
            'revision_number' => $review->revision_number,
            'status' => $review->status,
            'status_label' => $review->statusLabel(),
            'snapshot' => $review->snapshot,
            'content_matches' => $contentMatches,
            'submitter_note' => $review->submitter_note,
            'decision_note' => $review->decision_note,
            'due_at' => $review->due_at?->toDateString(),
            'submitted_at' => $review->submitted_at?->toIso8601String(),
            'decided_at' => $review->decided_at?->toIso8601String(),
            'submitter' => $review->submitter?->only(['id', 'name', 'email']),
            'reviewer' => $review->reviewer?->only(['id', 'name', 'email']),
        ];
    }
}
