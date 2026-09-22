<?php

use App\Jobs\SendOutreachEmail;
use App\Models\Organization;
use App\Models\OutreachCampaign;
use App\Models\OutreachCampaignContact;
use App\Models\OutreachEmailAccount;
use App\Models\OutreachLead;
use App\Models\OutreachMessage;
use App\Models\User;
use App\Services\OutreachMailgunService;
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
        'services.mailgun.domain' => 'mg.eigen.test',
        'services.mailgun.secret' => 'mailgun-api-key',
        'services.mailgun.endpoint' => 'https://api.mailgun.net',
        'services.mailgun.webhook_signing_key' => 'mailgun-signing-key',
        'services.mailgun.inbound_domain' => 'reply.mg.eigen.test',
        'services.mailgun.from_name' => 'Eigen Learning',
    ]);
});

function outreachAccount(User $user): OutreachEmailAccount
{
    return OutreachEmailAccount::create([
        'user_id' => $user->id,
        'provider' => 'mailgun',
        'email' => 'sender@mg.eigen.test',
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

test('a Super Admin can add only a sender on the configured Mailgun domain', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $this->actingAs($superAdmin)
        ->post(route('platform.email-campaigns.accounts.store'), [
            'email' => 'outreach@gmail.com',
            'daily_limit' => 25,
        ])
        ->assertSessionHasErrors('email');

    $this->post(route('platform.email-campaigns.accounts.store'), [
        'email' => 'outreach@mg.eigen.test',
        'daily_limit' => 30,
    ])->assertSessionHasNoErrors();

    $this->assertDatabaseHas('outreach_email_accounts', [
        'user_id' => $superAdmin->id,
        'provider' => 'mailgun',
        'email' => 'outreach@mg.eigen.test',
        'daily_limit' => 30,
        'status' => 'connected',
    ]);
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
        'https://api.mailgun.net/v3/mg.eigen.test/messages' => Http::response([
            'id' => '<mailgun-message-1@mg.eigen.test>',
            'message' => 'Queued. Thank you.',
        ]),
    ]);

    (new SendOutreachEmail($contact->id, true))->handle(
        app(OutreachMailgunService::class),
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

    Http::assertSent(fn (ClientRequest $request): bool => $request->url() === 'https://api.mailgun.net/v3/mg.eigen.test/messages'
        && str_starts_with($request->header('Content-Type')[0] ?? '', 'multipart/form-data; boundary=')
        && str_contains($request->body(), 'mike@example.com')
        && str_contains($request->body(), 'Quick question for ABC Telecom')
        && str_contains($request->body(), 'reply+'.$contact->id.'.'));
});

test('a signed Mailgun inbound reply stops the sequence and appears in the inbox', function () {
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
    $mailgun = app(OutreachMailgunService::class);
    $timestamp = (string) time();
    $token = 'mailgun-webhook-token';
    $signature = hash_hmac('sha256', $timestamp.$token, 'mailgun-signing-key');

    $this->post(route('webhooks.mailgun.inbound'), [
        'timestamp' => $timestamp,
        'token' => $token,
        'signature' => $signature,
        'recipient' => $mailgun->replyAddress($contact),
        'sender' => 'mike@example.com',
        'subject' => 'Re: Quick question',
        'stripped-text' => 'Yes, I would like to learn more.',
        'Message-Id' => '<reply-1@customer.test>',
    ])->assertOk()->assertJson(['accepted' => true, 'matched' => true]);

    expect($contact->refresh()->status)->toBe('replied')
        ->and($contact->next_send_at)->toBeNull()
        ->and($lead->refresh()->status)->toBe('replied')
        ->and($campaign->refresh()->status)->toBe('completed');

    $this->assertDatabaseHas('outreach_messages', [
        'provider_message_id' => 'reply-1@customer.test',
        'direction' => 'inbound',
        'status' => 'received',
    ]);
});

test('Mailgun webhooks reject an invalid signature', function () {
    $this->post(route('webhooks.mailgun.inbound'), [
        'timestamp' => (string) time(),
        'token' => 'forged-token',
        'signature' => 'forged-signature',
        'recipient' => 'reply+1.invalid@reply.mg.eigen.test',
    ])->assertForbidden();
});

test('a permanent Mailgun delivery failure stops the sequence as bounced', function () {
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
    $timestamp = (string) time();
    $token = 'event-token';

    $this->postJson(route('webhooks.mailgun.events'), [
        'signature' => [
            'timestamp' => $timestamp,
            'token' => $token,
            'signature' => hash_hmac('sha256', $timestamp.$token, 'mailgun-signing-key'),
        ],
        'event-data' => [
            'event' => 'failed',
            'severity' => 'permanent',
            'user-variables' => ['campaign_contact_id' => (string) $contact->id],
        ],
    ])->assertOk()->assertJson(['accepted' => true]);

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
