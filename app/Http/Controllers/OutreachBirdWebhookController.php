<?php

namespace App\Http\Controllers;

use App\Models\OutreachCampaign;
use App\Models\OutreachCampaignContact;
use App\Models\OutreachLead;
use App\Models\OutreachMessage;
use App\Services\OutreachBirdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Throwable;

class OutreachBirdWebhookController extends Controller
{
    public function __invoke(Request $request, OutreachBirdService $bird): JsonResponse
    {
        $rawBody = $request->getContent();

        abort_unless($bird->webhookIsValid(
            $rawBody,
            (string) $request->header('webhook-id'),
            (string) $request->header('webhook-timestamp'),
            (string) $request->header('webhook-signature'),
        ), 403, 'Invalid Bird signature.');

        $event = $request->json()->all();
        $type = (string) ($event['type'] ?? '');
        $data = (array) ($event['data'] ?? []);

        if ($type === 'email.received') {
            return $this->received($data, $bird);
        }

        if (in_array($type, ['email.bounced', 'email.out_of_band_bounce', 'email.rejected'], true)) {
            $this->stopContact($data, 'bounced');
        }

        if (in_array($type, ['email.complained', 'email.unsubscribed', 'email.list_unsubscribed'], true)) {
            $this->stopContact($data, 'unsubscribed');
        }

        return response()->json(['accepted' => true]);
    }

    /** @param array<string,mixed> $data */
    private function received(array $data, OutreachBirdService $bird): JsonResponse
    {
        $inboundMessageId = (string) ($data['inbound_message_id'] ?? '');

        if ($inboundMessageId === '') {
            return response()->json(['accepted' => true, 'matched' => false]);
        }

        if (OutreachMessage::query()->where('provider_message_id', $inboundMessageId)->exists()) {
            return response()->json(['accepted' => true, 'duplicate' => true]);
        }

        $contact = $this->contactFromRecipients($data, $bird)
            ?? $this->contactFromReplyReference($data);

        if ($contact === null) {
            return response()->json(['accepted' => true, 'matched' => false]);
        }

        $campaign = OutreachCampaign::query()->findOrFail($contact->campaign_id);
        $lead = OutreachLead::query()->findOrFail($contact->lead_id);

        try {
            $body = $bird->inboundBody($inboundMessageId);
        } catch (Throwable) {
            $body = ['text' => null, 'html' => null];
        }

        OutreachMessage::create([
            'email_account_id' => $campaign->email_account_id,
            'campaign_id' => $contact->campaign_id,
            'campaign_contact_id' => $contact->getKey(),
            'lead_id' => $contact->lead_id,
            'direction' => 'inbound',
            'provider_message_id' => $inboundMessageId,
            'provider_thread_id' => (string) ($data['in_reply_to'] ?? $inboundMessageId),
            'subject' => $data['subject'] ?? null,
            'body' => $body['text'] ?: strip_tags((string) $body['html']),
            'status' => 'received',
            'received_at' => now(),
        ]);

        $contact->forceFill([
            'status' => 'replied',
            'next_send_at' => null,
            'stopped_at' => now(),
        ])->save();
        $lead->forceFill([
            'status' => 'replied',
            'replied_at' => now(),
        ])->save();
        $campaign->completeIfFinished();

        return response()->json(['accepted' => true, 'matched' => true]);
    }

    /** @param array<string,mixed> $data */
    private function contactFromRecipients(array $data, OutreachBirdService $bird): ?OutreachCampaignContact
    {
        $recipients = Arr::wrap($data['to'] ?? $data['recipients'] ?? $data['recipient'] ?? []);

        foreach ($recipients as $recipient) {
            $address = mb_strtolower(is_array($recipient)
                ? (string) ($recipient['email'] ?? $recipient['address'] ?? '')
                : (string) $recipient);

            if (! preg_match('/reply\+(\d+)\.([a-f0-9]{24})@/i', $address, $matches)) {
                continue;
            }

            $contact = OutreachCampaignContact::query()->find((int) $matches[1]);

            if ($contact !== null && hash_equals($bird->contactSignature($contact->getKey()), mb_strtolower($matches[2]))) {
                return $contact;
            }
        }

        return null;
    }

    /** @param array<string,mixed> $data */
    private function contactFromReplyReference(array $data): ?OutreachCampaignContact
    {
        $reference = trim((string) ($data['in_reply_to'] ?? ''), '<>');

        if ($reference === '') {
            return null;
        }

        $message = OutreachMessage::query()
            ->where('provider_message_id', $reference)
            ->first();

        return $message?->campaign_contact_id
            ? OutreachCampaignContact::query()->find($message->campaign_contact_id)
            : null;
    }

    /** @param array<string,mixed> $data */
    private function stopContact(array $data, string $status): void
    {
        $contactId = (int) data_get($data, 'metadata.campaign_contact_id', 0);
        $contact = OutreachCampaignContact::query()->find($contactId);

        if ($contact === null) {
            return;
        }

        $campaign = OutreachCampaign::query()->findOrFail($contact->campaign_id);
        $lead = OutreachLead::query()->findOrFail($contact->lead_id);

        $contact->forceFill([
            'status' => $status,
            'next_send_at' => null,
            'stopped_at' => now(),
        ])->save();
        $lead->forceFill(['status' => $status])->save();
        $campaign->completeIfFinished();
    }
}
