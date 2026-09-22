<?php

use App\Jobs\SendOutreachEmail;
use App\Models\Organization;
use App\Models\OutreachCampaign;
use App\Models\OutreachCampaignContact;
use App\Models\OutreachEmailAccount;
use App\Models\OutreachLead;
use App\Models\OutreachMessage;
use App\Models\User;
use App\Services\OutreachBirdService;
use App\Services\OutreachPersonalization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'services.bird.api_key' => 'bk_us1_bird-api-key',
        'services.bird.endpoint' => 'https://us1.platform.bird.com',
        'services.bird.sending_domain' => 'eigen.test',
        'services.bird.webhook_secret' => 'whsec_'.base64_encode('bird-webhook-secret'),
        'services.bird.inbound_domain' => 'reply.eigen.test',
        'services.bird.from_name' => 'Eigen Learning',
    ]);
});

function outreachAccount(User $user): OutreachEmailAccount
{
    return OutreachEmailAccount::create([
        'user_id' => $user->id,
        'provider' => 'bird',
        'email' => 'sender@eigen.test',
        'access_token' => 'configured-in-environment',
        'status' => 'connected',
        'daily_limit' => 25,
        'timezone' => 'America/New_York',
        'sending_start' => '09:00:00',
        'sending_end' => '17:00:00',
    ]);
}

function outreachLead(User $user, array $attributes = []): OutreachLead
{
    return OutreachLead::create([
        'created_by_id' => $user->id,
        'email' => $attributes['email'] ?? 'mike@example.com',
        'first_name' => $attributes['first_name'] ?? 'Mike',
        'company' => $attributes['company'] ?? 'ABC Telecom',
        'status' => $attributes['status'] ?? 'new',
        'unsubscribe_token' => $attributes['unsubscribe_token'] ?? str_repeat('a', 48),
    ]);
}

/** @param array<string,mixed> $payload @return array<string,string> */
function birdWebhookHeaders(array $payload): array
{
    $id = 'whd_'.str_repeat('a', 24);
    $timestamp = (string) time();
    $rawBody = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $signature = base64_encode(hash_hmac('sha256', "{$id}.{$timestamp}.{$rawBody}", 'bird-webhook-secret', true));

    return [
        'webhook-id' => $id,
        'webhook-timestamp' => $timestamp,
        'webhook-signature' => 'v1,'.$signature,
    ];
}

test('email campaign management is restricted to Eigen Super Admins', function () {
    $organization = Organization::factory()->create();
    $customerAdmin = User::factory()->organizationAdmin($organization)->create();
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($customerAdmin)
        ->get(route('platform.email-campaigns.dashboard'))
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->get(route('platform.email-campaigns.dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('platform/email-campaigns/index')
            ->where('active_section', 'dashboard')
            ->where('stats.leads', 0));
});

test('a Super Admin can import leads from the downloadable CSV format', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $csv = implode("\n", [
        'First Name,Last Name,Email,Company,Job Title,City,Industry,Custom 1',
        'Mike,Taylor,mike@example.com,ABC Telecom,Operations Manager,Boston,Telecom,75 field technicians',
        'Invalid,Lead,not-an-email,No Company,,,,',
    ]);

    $this->actingAs($superAdmin)
        ->get(route('platform.email-campaigns.leads.template'))
        ->assertOk()
        ->assertDownload('eigen-outreach-leads-template.csv');

    $this->post(route('platform.email-campaigns.leads.import'), [
        'csv' => UploadedFile::fake()->createWithContent('leads.csv', $csv),
    ])->assertSessionHasNoErrors();

    $this->assertDatabaseHas('outreach_leads', [
        'email' => 'mike@example.com',
        'company' => 'ABC Telecom',
        'job_title' => 'Operations Manager',
        'status' => 'new',
    ]);
    $this->assertDatabaseCount('outreach_leads', 1);
});

test('a Super Admin can create and start a campaign sequence', function () {
    Queue::fake();
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $lead = outreachLead($superAdmin);

    $this->actingAs($superAdmin)
        ->post(route('platform.email-campaigns.campaigns.store'), [
            'name' => 'Field service companies',
            'email_account_id' => $account->id,
            'daily_limit' => 25,
            'subject' => 'Quick question for {{company}}',
            'body' => 'Hi {{first_name}}, how do you train your team?',
            'lead_ids' => [$lead->id],
        ])
        ->assertSessionHasNoErrors();

    $campaign = OutreachCampaign::query()->firstOrFail();

    expect($campaign->steps()->count())->toBe(1)
        ->and($campaign->contacts()->count())->toBe(1);

    $this->post(route('platform.email-campaigns.campaigns.start', $campaign))
        ->assertSessionHasNoErrors();

    expect($campaign->refresh()->status)->toBe('active')
        ->and($campaign->contacts()->firstOrFail()->status)->toBe('sending')
        ->and($campaign->contacts()->firstOrFail()->next_send_at)->not->toBeNull();

    Queue::assertPushed(SendOutreachEmail::class, fn (SendOutreachEmail $job): bool => $job->campaignContactId === $campaign->contacts()->firstOrFail()->id);
});

test('debug send now queues every eligible pending lead and bypasses delivery limits', function () {
    Queue::fake();
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $account->update(['daily_limit' => 1]);
    $campaign = OutreachCampaign::create([
        'created_by_id' => $superAdmin->id,
        'email_account_id' => $account->id,
        'name' => 'Immediate debug send',
        'status' => 'active',
        'daily_limit' => 1,
        'timezone' => 'America/New_York',
        'sending_start' => '23:00:00',
        'sending_end' => '23:30:00',
        'sending_days' => [7],
        'started_at' => now(),
    ]);
    $campaign->steps()->create([
        'position' => 1,
        'delay_days' => 0,
        'subject' => 'Quick question',
        'body' => 'Hi {{first_name}}',
    ]);
    $pendingLead = outreachLead($superAdmin, [
        'email' => 'pending@example.com',
        'unsubscribe_token' => str_repeat('p', 48),
    ]);
    $pausedLead = outreachLead($superAdmin, [
        'email' => 'paused@example.com',
        'unsubscribe_token' => str_repeat('s', 48),
    ]);
    $repliedLead = outreachLead($superAdmin, [
        'email' => 'replied@example.com',
        'status' => 'replied',
        'unsubscribe_token' => str_repeat('r', 48),
    ]);
    $unattachedLead = outreachLead($superAdmin, [
        'email' => 'unattached@example.com',
        'unsubscribe_token' => str_repeat('u', 48),
    ]);
    $pendingContact = $campaign->contacts()->create([
        'lead_id' => $pendingLead->id,
        'status' => 'sending',
        'current_step' => 0,
        'next_send_at' => now()->addMonth(),
    ]);
    $pausedContact = $campaign->contacts()->create([
        'lead_id' => $pausedLead->id,
        'status' => 'paused',
        'current_step' => 0,
        'next_send_at' => now()->addMonth(),
    ]);
    $repliedContact = $campaign->contacts()->create([
        'lead_id' => $repliedLead->id,
        'status' => 'replied',
        'current_step' => 0,
        'next_send_at' => null,
    ]);

    $this->actingAs($superAdmin)
        ->post(route('platform.email-campaigns.campaigns.start', $campaign), [
            'debug_send_now' => true,
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('status', 'Queued 3 pending campaign emails for immediate sending.');

    $unattachedContact = $campaign->contacts()->where('lead_id', $unattachedLead->id)->firstOrFail();

    expect($pendingContact->refresh()->status)->toBe('sending')
        ->and($pendingContact->next_send_at)->not->toBeNull()
        ->and($pausedContact->refresh()->status)->toBe('sending')
        ->and($unattachedContact->status)->toBe('sending')
        ->and($repliedContact->refresh()->status)->toBe('replied');

    Queue::assertPushed(SendOutreachEmail::class, 3);
    Queue::assertPushed(SendOutreachEmail::class, fn (SendOutreachEmail $job): bool => $job->campaignContactId === $pendingContact->id && $job->force);
    Queue::assertPushed(SendOutreachEmail::class, fn (SendOutreachEmail $job): bool => $job->campaignContactId === $pausedContact->id && $job->force);
    Queue::assertPushed(SendOutreachEmail::class, fn (SendOutreachEmail $job): bool => $job->campaignContactId === $unattachedContact->id && $job->force);

    $middleware = (new SendOutreachEmail($pendingContact->id, true))->middleware();
    expect($middleware)->toHaveCount(1)
        ->and($middleware[0])->toBeInstanceOf(WithoutOverlapping::class);
});

test('a Super Admin can add only a sender on the configured Bird domain', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($superAdmin)
        ->post(route('platform.email-campaigns.accounts.store'), [
            'email' => 'outreach@gmail.com',
            'daily_limit' => 25,
        ])
        ->assertSessionHasErrors('email');

    $this->post(route('platform.email-campaigns.accounts.store'), [
        'email' => 'outreach@eigen.test',
        'daily_limit' => 30,
    ])->assertSessionHasNoErrors();

    $this->assertDatabaseHas('outreach_email_accounts', [
        'user_id' => $superAdmin->id,
        'provider' => 'bird',
        'email' => 'outreach@eigen.test',
        'daily_limit' => 30,
        'status' => 'connected',
    ]);
});

test('the Bird webhook setup command creates the Eigen endpoint and returns its secret', function () {
    Http::fake(function (ClientRequest $request) {
        if ($request->method() === 'GET') {
            return Http::response(['data' => []]);
        }

        return Http::response([
            'id' => 'whk_eigen_outreach',
            'url' => 'https://eigen-learning.com/webhooks/bird',
            'events' => OutreachBirdService::WEBHOOK_EVENTS,
            'status' => 'active',
            'secret' => 'whsec_created-secret',
        ]);
    });

    $this->artisan('outreach:configure-bird-webhook', [
        '--url' => 'https://eigen-learning.com/webhooks/bird',
        '--no-write' => true,
        '--skip-test' => true,
    ])
        ->expectsOutput('Created Bird webhook whk_eigen_outreach.')
        ->expectsOutput('BIRD_WEBHOOK_SECRET=whsec_created-secret')
        ->assertSuccessful();

    Http::assertSent(fn (ClientRequest $request): bool => $request->method() === 'POST'
        && $request->url() === 'https://us1.platform.bird.com/v1/webhooks'
        && $request['url'] === 'https://eigen-learning.com/webhooks/bird'
        && $request['events'] === OutreachBirdService::WEBHOOK_EVENTS);
});

test('the Bird webhook setup command explains missing API key scopes', function () {
    Http::fake([
        'https://us1.platform.bird.com/v1/webhooks*' => Http::response([
            'error' => [
                'message' => 'This request requires the "webhooks:read" scope.',
                'remediation' => 'Use a credential with the required scope.',
            ],
        ], 403),
    ]);

    $this->artisan('outreach:configure-bird-webhook', [
        '--url' => 'https://eigen-learning.com/webhooks/bird',
        '--no-write' => true,
        '--skip-test' => true,
    ])
        ->expectsOutput('Bird could not list webhooks: This request requires the "webhooks:read" scope. Use a credential with the required scope.')
        ->assertFailed();
});

test('a forced campaign email bypasses daily limits, is personalized, and completes its sequence', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $account->update(['daily_limit' => 1]);
    $lead = outreachLead($superAdmin);
    $campaign = OutreachCampaign::create([
        'created_by_id' => $superAdmin->id,
        'email_account_id' => $account->id,
        'name' => 'Telecom outreach',
        'status' => 'active',
        'daily_limit' => 1,
        'timezone' => 'America/New_York',
        'sending_start' => '09:00:00',
        'sending_end' => '17:00:00',
        'sending_days' => [1, 2, 3, 4, 5],
        'started_at' => now(),
    ]);
    $step = $campaign->steps()->create([
        'position' => 1,
        'delay_days' => 0,
        'subject' => 'Quick question for {{company}}',
        'body' => 'Hi {{first_name}}, can we talk?',
    ]);
    $contact = $campaign->contacts()->create([
        'lead_id' => $lead->id,
        'status' => 'sending',
        'current_step' => 0,
        'next_send_at' => now(),
    ]);
    OutreachMessage::create([
        'email_account_id' => $account->id,
        'campaign_id' => $campaign->id,
        'campaign_contact_id' => $contact->id,
        'lead_id' => $lead->id,
        'campaign_step_id' => $step->id,
        'direction' => 'outbound',
        'provider_message_id' => 'earlier-message',
        'subject' => 'Earlier message',
        'body' => 'This message already reached the daily limit.',
        'status' => 'sent',
        'sent_at' => now(),
    ]);

    Http::fake([
        'https://us1.platform.bird.com/v1/email/messages' => Http::response([
            'id' => 'em_bird_message_1',
            'status' => 'accepted',
        ], 202),
    ]);

    (new SendOutreachEmail($contact->id, true))->handle(
        app(OutreachBirdService::class),
        app(OutreachPersonalization::class),
    );

    $message = OutreachMessage::query()->latest('id')->firstOrFail();
    expect($message->campaign_step_id)->toBe($step->id)
        ->and($message->subject)->toBe('Quick question for ABC Telecom')
        ->and($message->body)->toContain('Hi Mike, can we talk?')
        ->and($contact->refresh()->status)->toBe('completed')
        ->and($campaign->refresh()->status)->toBe('completed')
        ->and($lead->refresh()->status)->toBe('active')
        ->and(OutreachMessage::query()->count())->toBe(2);

    Http::assertSent(fn (ClientRequest $request): bool => $request->url() === 'https://us1.platform.bird.com/v1/email/messages'
        && $request->hasHeader('Authorization', 'Bearer bk_us1_bird-api-key')
        && $request['to'] === ['mike@example.com']
        && $request['subject'] === 'Quick question for ABC Telecom'
        && str_starts_with($request['reply_to'][0], 'reply+'.$contact->id.'.')
        && $request['metadata']['campaign_contact_id'] === $contact->id
        && $request['category'] === 'marketing');
});

test('a signed Bird inbound reply stops the sequence and appears in the inbox', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $lead = outreachLead($superAdmin);
    $campaign = OutreachCampaign::create([
        'created_by_id' => $superAdmin->id,
        'email_account_id' => $account->id,
        'name' => 'Reply test',
        'status' => 'active',
        'daily_limit' => 25,
        'timezone' => 'America/New_York',
        'sending_start' => '09:00:00',
        'sending_end' => '17:00:00',
        'sending_days' => [1, 2, 3, 4, 5],
    ]);
    $contact = $campaign->contacts()->create([
        'lead_id' => $lead->id,
        'status' => 'active',
        'current_step' => 1,
        'next_send_at' => now()->addDays(3),
    ]);
    $bird = app(OutreachBirdService::class);
    $payload = [
        'type' => 'email.received',
        'timestamp' => now()->toIso8601String(),
        'data' => [
            'inbound_message_id' => 'in_bird_reply_1',
            'to' => [$bird->replyAddress($contact)],
            'from' => 'mike@example.com',
            'subject' => 'Re: Quick question',
            'in_reply_to' => 'em_bird_message_1',
        ],
    ];

    Http::fake([
        'https://us1.platform.bird.com/v1/email/inbound-messages/in_bird_reply_1/body' => Http::response([
            'text' => 'Yes, I would like to learn more.',
        ]),
    ]);

    $this->withHeaders(birdWebhookHeaders($payload))
        ->postJson(route('webhooks.bird'), $payload)
        ->assertOk()
        ->assertJson(['accepted' => true, 'matched' => true]);

    expect($contact->refresh()->status)->toBe('replied')
        ->and($contact->next_send_at)->toBeNull()
        ->and($lead->refresh()->status)->toBe('replied')
        ->and($campaign->refresh()->status)->toBe('completed');

    $this->assertDatabaseHas('outreach_messages', [
        'provider_message_id' => 'in_bird_reply_1',
        'direction' => 'inbound',
        'body' => 'Yes, I would like to learn more.',
        'status' => 'received',
    ]);
});

test('Bird webhooks reject an invalid signature', function () {
    $this->withHeaders([
        'webhook-id' => 'whd_forged',
        'webhook-timestamp' => (string) time(),
        'webhook-signature' => 'v1,forged-signature',
    ])->postJson(route('webhooks.bird'), [
        'type' => 'email.received',
        'data' => ['inbound_message_id' => 'in_forged'],
    ])->assertForbidden();
});

test('a Bird bounce stops the sequence as bounced', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $lead = outreachLead($superAdmin);
    $campaign = OutreachCampaign::create([
        'created_by_id' => $superAdmin->id,
        'email_account_id' => $account->id,
        'name' => 'Bounce test',
        'status' => 'active',
        'daily_limit' => 25,
        'timezone' => 'America/New_York',
        'sending_start' => '09:00:00',
        'sending_end' => '17:00:00',
    ]);
    $contact = $campaign->contacts()->create([
        'lead_id' => $lead->id,
        'status' => 'active',
        'current_step' => 1,
        'next_send_at' => now()->addDay(),
    ]);
    $payload = [
        'type' => 'email.bounced',
        'timestamp' => now()->toIso8601String(),
        'data' => [
            'email_id' => 'em_bounced',
            'recipient' => $lead->email,
            'bounce_type' => 'hard',
            'metadata' => ['campaign_contact_id' => $contact->id],
        ],
    ];

    $this->withHeaders(birdWebhookHeaders($payload))
        ->postJson(route('webhooks.bird'), $payload)
        ->assertOk()
        ->assertJson(['accepted' => true]);

    expect($contact->refresh()->status)->toBe('bounced')
        ->and($lead->refresh()->status)->toBe('bounced')
        ->and($campaign->refresh()->status)->toBe('completed');
});

test('unsubscribe immediately stops every active sequence for a lead', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $account = outreachAccount($superAdmin);
    $lead = outreachLead($superAdmin, ['unsubscribe_token' => str_repeat('u', 48)]);
    $campaign = OutreachCampaign::create([
        'created_by_id' => $superAdmin->id,
        'email_account_id' => $account->id,
        'name' => 'Unsubscribe test',
        'status' => 'active',
        'daily_limit' => 25,
        'timezone' => 'America/New_York',
        'sending_start' => '09:00:00',
        'sending_end' => '17:00:00',
    ]);
    $contact = OutreachCampaignContact::create([
        'campaign_id' => $campaign->id,
        'lead_id' => $lead->id,
        'status' => 'active',
        'next_send_at' => now(),
    ]);

    $this->get(route('outreach.unsubscribe', $lead->unsubscribe_token))
        ->assertOk()
        ->assertSee('You are unsubscribed.');

    expect($lead->refresh()->status)->toBe('unsubscribed')
        ->and($contact->refresh()->status)->toBe('unsubscribed')
        ->and($contact->next_send_at)->toBeNull()
        ->and($campaign->refresh()->status)->toBe('completed');
});
