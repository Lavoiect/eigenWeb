<?php

namespace App\Services;

use App\Models\OutreachCampaignContact;
use App\Models\OutreachEmailAccount;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OutreachBirdService
{
    /** @return array{id:string,threadId:string} */
    public function send(
        OutreachEmailAccount $account,
        OutreachCampaignContact $contact,
        string $to,
        string $subject,
        string $body,
    ): array {
        $this->assertConfigured();

        if ($account->provider !== 'bird') {
            throw new RuntimeException('The selected sender is not a Bird sender.');
        }

        $fromName = trim((string) config('services.bird.from_name', config('app.name')));
        $replyAddress = $this->replyAddress($contact);

        $response = Http::acceptJson()
            ->asJson()
            ->withToken((string) config('services.bird.api_key'))
            ->withHeaders([
                'Idempotency-Key' => "eigen-outreach-{$contact->getKey()}-{$contact->current_step}",
            ])
            ->timeout(30)
            ->post($this->endpoint().'/v1/email/messages', [
                'from' => [
                    'email' => $account->email,
                    'name' => $fromName,
                ],
                'to' => [$to],
                'reply_to' => [$replyAddress],
                'subject' => $subject,
                'text' => $body,
                'category' => 'marketing',
                'track_opens' => true,
                'track_clicks' => true,
                'tags' => [
                    ['name' => 'source', 'value' => 'eigen-outreach'],
                ],
                'metadata' => [
                    'campaign_id' => $contact->campaign_id,
                    'campaign_contact_id' => $contact->getKey(),
                ],
            ]);

        if ($response->failed() || blank($response->json('id'))) {
            throw new RuntimeException('Bird could not send the message: '.$response->body());
        }

        return [
            'id' => (string) $response->json('id'),
            'threadId' => $replyAddress,
        ];
    }

    /** @return array{text:?string,html:?string} */
    public function inboundBody(string $inboundMessageId): array
    {
        $this->assertConfigured();

        $response = Http::acceptJson()
            ->withToken((string) config('services.bird.api_key'))
            ->timeout(10)
            ->get($this->endpoint().'/v1/email/inbound-messages/'.urlencode($inboundMessageId).'/body');

        if ($response->failed()) {
            throw new RuntimeException('Bird could not retrieve the inbound message body: '.$response->body());
        }

        return [
            'text' => $response->json('text') ?? $response->json('body.text'),
            'html' => $response->json('html') ?? $response->json('body.html'),
        ];
    }

    public function replyAddress(OutreachCampaignContact $contact): string
    {
        $domain = (string) config('services.bird.inbound_domain');

        if ($domain === '') {
            throw new RuntimeException('Bird inbound domain is not configured.');
        }

        return sprintf(
            'reply+%d.%s@%s',
            $contact->getKey(),
            $this->contactSignature($contact->getKey()),
            $domain,
        );
    }

    public function contactSignature(int $contactId): string
    {
        return substr(hash_hmac('sha256', (string) $contactId, (string) config('app.key')), 0, 24);
    }

    public function webhookIsValid(string $rawBody, string $id, string $timestamp, string $signatureHeader): bool
    {
        $secret = (string) config('services.bird.webhook_secret');

        if (
            ! str_starts_with($secret, 'whsec_')
            || $id === ''
            || ! ctype_digit($timestamp)
            || abs(time() - (int) $timestamp) > 300
        ) {
            return false;
        }

        $key = base64_decode(substr($secret, 6), true);

        if ($key === false) {
            return false;
        }

        $expected = base64_encode(hash_hmac('sha256', "{$id}.{$timestamp}.{$rawBody}", $key, true));

        foreach (preg_split('/\s+/', trim($signatureHeader)) ?: [] as $signature) {
            if (str_starts_with($signature, 'v1,') && hash_equals($expected, substr($signature, 3))) {
                return true;
            }
        }

        return false;
    }

    private function endpoint(): string
    {
        $configured = trim((string) config('services.bird.endpoint'));

        if ($configured !== '') {
            return rtrim($configured, '/');
        }

        return str_starts_with((string) config('services.bird.api_key'), 'bk_eu1_')
            ? 'https://eu1.platform.bird.com'
            : 'https://us1.platform.bird.com';
    }

    private function assertConfigured(): void
    {
        if (blank(config('services.bird.api_key'))) {
            throw new RuntimeException('Bird is not configured.');
        }
    }
}
