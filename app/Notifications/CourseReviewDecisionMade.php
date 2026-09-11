<?php

namespace App\Notifications;

use App\Models\CourseReview;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CourseReviewDecisionMade extends Notification
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
            ->subject("Course review updated: {$courseTitle}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->review->reviewer?->name} marked revision {$this->review->revision_number} as {$this->review->statusLabel()}.")
            ->when(
                filled($this->review->decision_note),
                fn (MailMessage $message) => $message->line($this->review->decision_note),
            )
            ->action('View review', route('organizations.course-reviews.show', [
                $this->review->organization_id,
                $this->review,
            ]));
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
