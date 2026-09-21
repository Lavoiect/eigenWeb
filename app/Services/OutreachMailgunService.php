<?php

namespace App\Services;

use App\Models\OutreachCampaignContact;
use App\Models\OutreachEmailAccount;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OutreachMailgunService
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

        if ($account->provider !== 'mailgun') {
            throw new RuntimeException('The selected sender is not a Mailgun sender.');
        }

        $domain = (string) config('services.mailgun.domain');
        $endpoint = rtrim((string) config('services.mailgun.endpoint', 'https://api.mailgun.net'), '/');
        $fromName = trim((string) config('services.mailgun.from_name', config('app.name')));
        $from = $fromName === '' ? $account->email : "{$fromName} <{$account->email}>";
        $replyAddress = $this->replyAddress($contact);

        $response = Http::asForm()
            ->withBasicAuth('api', (string) config('services.mailgun.secret'))
            ->timeout(30)
            ->post("{$endpoint}/v3/{$domain}/messages", [
                'from' => $from,
                'to' => $to,
                'subject' => $subject,
                'text' => $body,
                'h:Reply-To' => $replyAddress,
                'o:tag' => 'eigen-outreach',
                'v:campaign_id' => (string) $contact->campaign_id,
                'v:campaign_contact_id' => (string) $contact->getKey(),
            ]);

        if ($response->failed() || blank($response->json('id'))) {
            throw new RuntimeException('Mailgun could not send the message: '.$response->body());
        }

        return [
            'id' => (string) $response->json('id'),
            'threadId' => $replyAddress,
        ];
    }

    public function replyAddress(OutreachCampaignContact $contact): string
    {
        $domain = (string) config('services.mailgun.inbound_domain', config('services.mailgun.domain'));

        if ($domain === '') {
            throw new RuntimeException('Mailgun inbound domain is not configured.');
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

    public function webhookIsValid(string $timestamp, string $token, string $signature): bool
    {
        $signingKey = (string) config('services.mailgun.webhook_signing_key');

        if ($signingKey === '' || ! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 900) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $timestamp.$token, $signingKey), $signature);
    }

    private function assertConfigured(): void
    {
        if (blank(config('services.mailgun.domain')) || blank(config('services.mailgun.secret'))) {
            throw new RuntimeException('Mailgun is not configured.');
        }
    }
}
