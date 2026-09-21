<?php

namespace App\Http\Controllers;

use App\Models\OutreachCampaign;
use App\Models\OutreachLead;
use Illuminate\Http\Response;

class OutreachUnsubscribeController extends Controller
{
    public function __invoke(string $token): Response
    {
        $lead = OutreachLead::query()->where('unsubscribe_token', $token)->firstOrFail();
        $lead->forceFill(['status' => 'unsubscribed'])->save();
        $campaignIds = $lead->campaignContacts()
            ->whereIn('status', ['queued', 'active', 'sending', 'paused'])
            ->pluck('campaign_id');
        $lead->campaignContacts()
            ->whereIn('status', ['queued', 'active', 'sending', 'paused'])
            ->update(['status' => 'unsubscribed', 'next_send_at' => null, 'stopped_at' => now()]);
        OutreachCampaign::query()->whereIn('id', $campaignIds)->get()->each->completeIfFinished();

        return response('<!doctype html><html><body style="font-family:system-ui;padding:48px"><h1>You are unsubscribed.</h1><p>You will not receive additional outreach emails from Eigen Learning.</p></body></html>');
    }
}
