<?php

namespace App\Http\Controllers;

use App\Models\OutreachCampaignContact;
use App\Models\OutreachMessage;
use App\Services\OutreachMailgunService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OutreachMailgunWebhookController extends Controller
{
    public function inbound(Request $request, OutreachMailgunService $mailgun): JsonResponse
    {
        $timestamp = (string) $request->input('timestamp');
        $token = (string) $request->input('token');
        $signature = (string) $request->input('signature');

        abort_unless($mailgun->webhookIsValid($timestamp, $token, $signature), 403, 'Invalid Mailgun signature.');

        $recipient = mb_strtolower((string) $request->input('recipient'));

        if (! preg_match('/reply\+(\d+)\.([a-f0-9]{24})@/i', $recipient, $matches)) {
            return response()->json(['accepted' => true, 'matched' => false]);
        }

        $contact = OutreachCampaignContact::query()
            ->with(['campaign', 'lead'])
            ->find((int) $matches[1]);

        if ($contact === null || ! hash_equals($mailgun->contactSignature($contact->getKey()), mb_strtolower($matches[2]))) {
            return response()->json(['accepted' => true, 'matched' => false]);
        }

        $messageId = trim((string) $request->input('Message-Id'), '<>') ?: 'mailgun-inbound-'.Str::uuid();

        if (OutreachMessage::query()->where('provider_message_id', $messageId)->exists()) {
            return response()->json(['accepted' => true, 'duplicate' => true]);
        }

        OutreachMessage::create([
            'email_account_id' => $contact->campaign->email_account_id,
            'campaign_id' => $contact->campaign_id,
            'campaign_contact_id' => $contact->getKey(),
            'lead_id' => $contact->lead_id,
            'direction' => 'inbound',
            'provider_message_id' => $messageId,
            'provider_thread_id' => $recipient,
            'subject' => $request->input('subject'),
            'body' => $request->input('stripped-text') ?: $request->input('body-plain'),
            'status' => 'received',
            'received_at' => now(),
        ]);

        $contact->forceFill([
            'status' => 'replied',
            'next_send_at' => null,
            'stopped_at' => now(),
        ])->save();
        $contact->lead->forceFill([
            'status' => 'replied',
            'replied_at' => now(),
        ])->save();
        $contact->campaign->completeIfFinished();

        return response()->json(['accepted' => true, 'matched' => true]);
    }

    public function event(Request $request, OutreachMailgunService $mailgun): JsonResponse
    {
        $signatureData = $request->input('signature', []);
        $timestamp = (string) ($signatureData['timestamp'] ?? '');
        $token = (string) ($signatureData['token'] ?? '');
        $signature = (string) ($signatureData['signature'] ?? '');

        abort_unless($mailgun->webhookIsValid($timestamp, $token, $signature), 403, 'Invalid Mailgun signature.');

        $event = (array) $request->input('event-data', []);

        if (($event['event'] ?? null) !== 'failed' || ($event['severity'] ?? null) !== 'permanent') {
            return response()->json(['accepted' => true]);
        }

        $variables = (array) ($event['user-variables'] ?? []);
        $contact = OutreachCampaignContact::query()
            ->with(['campaign', 'lead'])
            ->find((int) ($variables['campaign_contact_id'] ?? 0));

        if ($contact !== null) {
            $contact->forceFill(['status' => 'bounced', 'next_send_at' => null, 'stopped_at' => now()])->save();
            $contact->lead->forceFill(['status' => 'bounced'])->save();
            $contact->campaign->completeIfFinished();
        }

        return response()->json(['accepted' => true]);
    }
}
