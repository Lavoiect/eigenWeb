<?php

namespace App\Console\Commands;

use App\Jobs\SendOutreachEmail;
use App\Models\OutreachCampaignContact;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class ProcessOutreachCampaigns extends Command
{
    protected $signature = 'outreach:process-due';

    protected $description = 'Queue due cold-email campaign messages.';

    public function handle(): int
    {
        OutreachCampaignContact::query()
            ->where('status', 'sending')
            ->where('updated_at', '<', now()->subMinutes(20))
            ->update(['status' => 'active']);

        $queued = 0;

        OutreachCampaignContact::query()
            ->with('campaign')
            ->where('status', 'active')
            ->whereNotNull('next_send_at')
            ->where('next_send_at', '<=', now())
            ->whereHas('campaign', fn ($query) => $query->where('status', 'active'))
            ->orderBy('next_send_at')
            ->limit(250)
            ->get()
            ->each(function (OutreachCampaignContact $contact) use (&$queued): void {
                $campaign = $contact->campaign;
                $localNow = Carbon::now($campaign->timezone);
                $sendingDays = $campaign->sending_days ?: [1, 2, 3, 4, 5];
                $withinDay = in_array($localNow->dayOfWeekIso, $sendingDays, true);
                $withinHours = $localNow->format('H:i:s') >= $campaign->sending_start
                    && $localNow->format('H:i:s') <= $campaign->sending_end;

                if (! $withinDay || ! $withinHours) {
                    $beforeWindow = $withinDay && $localNow->format('H:i:s') < $campaign->sending_start;
                    $next = $localNow->copy()
                        ->when(! $beforeWindow, fn (Carbon $date) => $date->addDay())
                        ->setTimeFromTimeString($campaign->sending_start);

                    while (! in_array($next->dayOfWeekIso, $sendingDays, true)) {
                        $next->addDay();
                    }

                    $contact->forceFill(['next_send_at' => $next->utc()])->save();

                    return;
                }

                $claimed = OutreachCampaignContact::query()
                    ->whereKey($contact->getKey())
                    ->where('status', 'active')
                    ->update(['status' => 'sending']);

                if ($claimed === 1) {
                    SendOutreachEmail::dispatch($contact->getKey());
                    $queued++;
                }
            });

        $this->info("Queued {$queued} outreach messages.");

        return self::SUCCESS;
    }
}
