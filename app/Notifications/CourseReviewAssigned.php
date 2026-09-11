<?php

namespace App\Notifications;

use App\Models\CourseReview;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CourseReviewAssigned extends Notification
{
    use Queueable;

    public function __construct(public CourseReview $review) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $courseTitle = data_get($this->review->snapshot, 'course.title', 'Course');

        return (new MailMessage)
            ->subject("Review requested: {$courseTitle}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->review->submitter?->name} sent {$courseTitle} to you for review.")
            ->when(
                filled($this->review->submitter_note),
                fn (MailMessage $message) => $message->line($this->review->submitter_note),
            )
            ->action('Review course', route('organizations.course-reviews.show', [
                $this->review->organization_id,
                $this->review,
            ]))
            ->line('You can comment, request changes, or approve this revision.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'course_review_id' => $this->review->id,
            'course_id' => $this->review->course_id,
            'status' => $this->review->status,
        ];
    }
}
