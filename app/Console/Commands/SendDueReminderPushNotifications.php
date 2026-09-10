<?php

namespace App\Console\Commands;

use App\Models\CourseProgress;
use App\Models\CourseAssignment;
use App\Models\User;
use App\Services\ExpoPushService;
use App\Services\NotificationRecipientResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class SendDueReminderPushNotifications extends Command
{
    protected $signature = 'notifications:send-due-reminders';

    protected $description = 'Send push notifications for upcoming due training reminders.';

    public function handle(
        ExpoPushService $pushService,
        NotificationRecipientResolver $recipientResolver,
    ): int {
        $now = Carbon::now();
        $windowEnd = $now->copy()->addDays(3);

        CourseAssignment::query()
            ->with([
                'course',
                'assignedToUser',
                'assignedToTeam.members',
                'assignedToTeam.managers',
                'assignedToJobTitle.users',
                'assignedToLocation.users',
            ])
            ->whereNotNull('due_at')
            ->whereBetween('due_at', [$now, $windowEnd])
            ->where(function ($query) use ($now): void {
                $query->whereNull('last_reminded_at')
                    ->orWhere('last_reminded_at', '<', $now->copy()->subDay());
            })
            ->chunkById(50, function (Collection $assignments) use ($pushService, $recipientResolver, $now): void {
                /** @var Collection<int, CourseAssignment> $assignments */
                foreach ($assignments as $assignment) {
                    $recipients = $recipientResolver->forAssignment($assignment)
                        ->filter(fn (User $user): bool => $this->shouldNotifyUser($user, $assignment))
                        ->values();

                    if ($recipients->isEmpty()) {
                        continue;
                    }

                    $pushService->sendToUsers(
                        $recipients,
                        'Training due soon',
                        sprintf('%s is %s.', $assignment->course->title, $this->dueLabel($assignment->due_at)),
                        [
                            'type' => 'upcoming_due_date',
                            'url' => sprintf('/training?courseId=%s', $assignment->course_id),
                            'courseId' => (string) $assignment->course_id,
                            'assignmentId' => (string) $assignment->id,
                        ],
                    );

                    $assignment->forceFill([
                        'reminder_count' => ((int) ($assignment->reminder_count ?? 0)) + 1,
                        'last_reminded_at' => $now,
                    ])->save();
                }
            });

        $this->info('Due-date reminders processed.');

        return self::SUCCESS;
    }

    private function shouldNotifyUser(User $user, CourseAssignment $assignment): bool
    {
        return ! CourseProgress::query()
            ->where('user_id', $user->getKey())
            ->where('course_id', $assignment->course_id)
            ->where('status', 'completed')
            ->exists();
    }

    private function dueLabel(?Carbon $dueAt): string
    {
        if ($dueAt === null) {
            return 'due soon';
        }

        $days = Carbon::now()->startOfDay()->diffInDays($dueAt->copy()->startOfDay(), false);

        if ($days <= 0) {
            return 'due today';
        }

        if ($days === 1) {
            return 'due tomorrow';
        }

        return sprintf('due in %d days', $days);
    }
}
