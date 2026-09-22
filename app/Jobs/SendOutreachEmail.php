<?php

namespace App\Jobs;

use App\Models\OutreachCampaignContact;
use App\Models\OutreachMessage;
use App\Services\OutreachMailgunService;
use App\Services\OutreachPersonalization;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Carbon;
use Throwable;

class SendOutreachEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int,int> */
    public array $backoff = [60, 300, 900];

    public function __construct(
        public int $campaignContactId,
        public bool $force = false,
    ) {}

    /** @return array<int,object> */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('outreach-contact-'.$this->campaignContactId))
                ->releaseAfter(30)
                ->expireAfter(120),
        ];
    }

    public function handle(OutreachMailgunService $mailgun, OutreachPersonalization $personalization): void
    {
        $contact = OutreachCampaignContact::query()
            ->with(['campaign.emailAccount', 'campaign.steps', 'lead'])
            ->find($this->campaignContactId);

        if ($contact === null || $contact->status !== 'sending' || $contact->campaign->status !== 'active') {
            return;
        }

        $campaign = $contact->campaign;
        $account = $campaign->emailAccount;
        $lead = $contact->lead;

        if ($account === null || ! $account->isConnected() || ! $lead->canReceiveEmail()) {
            $contact->forceFill(['status' => 'stopped', 'next_send_at' => null, 'stopped_at' => now()])->save();

            return;
        }

        $dayStart = Carbon::now($campaign->timezone)->startOfDay()->utc();
        $campaignSentToday = OutreachMessage::query()
            ->where('campaign_id', $campaign->getKey())
            ->where('direction', 'outbound')
            ->where('status', 'sent')
            ->where('sent_at', '>=', $dayStart)
            ->count();
        $accountSentToday = OutreachMessage::query()
            ->where('email_account_id', $account->getKey())
            ->where('direction', 'outbound')
            ->where('status', 'sent')
            ->where('sent_at', '>=', $dayStart)
            ->count();

        if (! $this->force && ($campaignSentToday >= $campaign->daily_limit || $accountSentToday >= $account->daily_limit)) {
            $contact->forceFill([
                'status' => 'active',
                'next_send_at' => Carbon::now($campaign->timezone)->addDay()->setTimeFromTimeString($campaign->sending_start)->utc(),
            ])->save();

            return;
        }

        $step = $campaign->steps->get($contact->current_step);

        if ($step === null) {
            $contact->forceFill(['status' => 'completed', 'next_send_at' => null])->save();

            return;
        }

        $subject = $personalization->render($step->subject, $lead);
        $body = $personalization->render($step->body, $lead);
        $body .= "\n\n---\nIf you would rather not receive these emails, unsubscribe: ".url('/outreach/unsubscribe/'.$lead->unsubscribe_token);

        try {
            $providerMessage = $mailgun->send($account, $contact, $lead->email, $subject, $body);
            $sentAt = now();

            OutreachMessage::create([
                'email_account_id' => $account->getKey(),
                'campaign_id' => $campaign->getKey(),
                'campaign_contact_id' => $contact->getKey(),
                'lead_id' => $lead->getKey(),
                'campaign_step_id' => $step->getKey(),
                'direction' => 'outbound',
                'provider_message_id' => $providerMessage['id'],
                'provider_thread_id' => $providerMessage['threadId'],
                'subject' => $subject,
                'body' => $body,
                'status' => 'sent',
                'sent_at' => $sentAt,
            ]);

            $lead->forceFill([
                'status' => $lead->status === 'new' ? 'active' : $lead->status,
                'last_contacted_at' => $sentAt,
            ])->save();
            $nextStep = $campaign->steps->get($contact->current_step + 1);
            $contact->forceFill([
                'current_step' => $contact->current_step + 1,
                'status' => $nextStep ? 'active' : 'completed',
                'next_send_at' => $nextStep ? $sentAt->copy()->addDays($nextStep->delay_days) : null,
                'last_sent_at' => $sentAt,
            ])->save();

            $campaign->completeIfFinished();
        } catch (Throwable $exception) {
            OutreachMessage::create([
                'email_account_id' => $account->getKey(),
                'campaign_id' => $campaign->getKey(),
                'campaign_contact_id' => $contact->getKey(),
                'lead_id' => $lead->getKey(),
                'campaign_step_id' => $step->getKey(),
                'direction' => 'outbound',
                'subject' => $subject,
                'body' => $body,
                'status' => 'failed',
                'error' => $exception->getMessage(),
            ]);
            $contact->forceFill(['status' => 'active', 'next_send_at' => now()->addMinutes(15)])->save();

            throw $exception;
        }
    }
}
