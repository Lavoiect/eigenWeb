<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class AccountActivation extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $url = url(route('password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], false));

        return (new MailMessage)
            ->subject('Activate your Eigen account')
            ->greeting('Your Eigen account is ready')
            ->line('Set your password to activate your organization administrator account.')
            ->action('Set password and activate account', $url)
            ->line('If you were not expecting this account, no action is required.');
    }
}
