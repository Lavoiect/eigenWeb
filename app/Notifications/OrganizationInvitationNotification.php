<?php

namespace App\Notifications;

use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrganizationInvitationNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly OrganizationInvitation $invitation) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $organization = $this->invitation->organization;
        $role = $this->invitation->organization_role->label();

        return (new MailMessage)
            ->subject("You're invited to {$organization->name} on Eigen")
            ->greeting("You're invited to join {$organization->name}")
            ->line("You have been invited as {$role}.")
            ->action('Accept invitation', route('invitations.show', ['invite' => $this->invitation->token]))
            ->line('This invitation expires in 14 days.');
    }
}
