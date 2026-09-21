<?php

namespace App\Http\Controllers;

use App\Jobs\SendOutreachEmail;
use App\Models\OutreachCampaign;
use App\Models\OutreachCampaignContact;
use App\Models\OutreachEmailAccount;
use App\Models\OutreachLead;
use App\Models\OutreachMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PlatformEmailCampaignController extends Controller
{
    public function dashboard(): Response
    {
        return $this->renderWorkspace('dashboard');
    }

    public function campaigns(): Response
    {
        return $this->renderWorkspace('campaigns');
    }

    public function leads(Request $request): Response
    {
        return $this->renderWorkspace('leads', null, $request);
    }

    public function inbox(): Response
    {
        return $this->renderWorkspace('inbox');
    }

    public function settings(): Response
    {
        return $this->renderWorkspace('settings');
    }

    public function showCampaign(OutreachCampaign $campaign): Response
    {
        return $this->renderWorkspace('campaign', $campaign);
    }

    public function storeLead(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:outreach_leads,email'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'custom_1' => ['nullable', 'string', 'max:2000'],
        ]);

        OutreachLead::create([
            ...$validated,
            'created_by_id' => $request->user()->getKey(),
            'email' => mb_strtolower($validated['email']),
            'status' => 'new',
            'unsubscribe_token' => Str::random(48),
        ]);

        return back()->with('status', 'Lead added.');
    }

    public function downloadLeadTemplate(): StreamedResponse
    {
        return response()->streamDownload(function (): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fputcsv($output, ['First Name', 'Last Name', 'Email', 'Company', 'Job Title', 'City', 'Industry', 'Custom 1']);
            fputcsv($output, ['Mike', 'Taylor', 'mike@example.com', 'ABC Telecom', 'Operations Manager', 'Boston', 'Telecom', '75 field technicians']);
            fclose($output);
        }, 'eigen-outreach-leads-template.csv', ['Content-Type' => 'text/csv']);
    }

    public function importLeads(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);
        $handle = fopen($validated['csv']->getRealPath(), 'r');

        if ($handle === false) {
            throw ValidationException::withMessages(['csv' => 'The CSV could not be opened.']);
        }

        $rawHeaders = fgetcsv($handle);

        if (! is_array($rawHeaders)) {
            fclose($handle);
            throw ValidationException::withMessages(['csv' => 'The CSV needs a header row.']);
        }

        $headers = collect($rawHeaders)->map(fn ($header): string => Str::of((string) $header)
            ->replace("\xEF\xBB\xBF", '')
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString());
        $emailIndex = $headers->search(fn (string $header): bool => in_array($header, ['email', 'email_address', 'work_email'], true));

        if ($emailIndex === false) {
            fclose($handle);
            throw ValidationException::withMessages(['csv' => 'Add an Email column to the CSV.']);
        }

        $imported = 0;
        $skipped = 0;

        while (($row = fgetcsv($handle)) !== false) {
            $record = $headers->mapWithKeys(fn (string $header, int $index): array => [
                $header => trim((string) ($row[$index] ?? '')),
            ]);
            $email = mb_strtolower((string) $record->get($headers[$emailIndex]));

            if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped++;

                continue;
            }

            $lead = OutreachLead::query()->firstOrNew(['email' => $email]);
            $lead->fill([
                'created_by_id' => $lead->created_by_id ?? $request->user()->getKey(),
                'first_name' => $this->csvValue($record->all(), ['first_name', 'firstname', 'first']),
                'last_name' => $this->csvValue($record->all(), ['last_name', 'lastname', 'last']),
                'company' => $this->csvValue($record->all(), ['company', 'company_name', 'organization']),
                'job_title' => $this->csvValue($record->all(), ['job_title', 'title', 'role']),
                'city' => $this->csvValue($record->all(), ['city']),
                'industry' => $this->csvValue($record->all(), ['industry']),
                'custom_1' => $this->csvValue($record->all(), ['custom_1', 'custom', 'personalization']),
                'status' => $lead->exists ? $lead->status : 'new',
                'unsubscribe_token' => $lead->unsubscribe_token ?: Str::random(48),
            ])->save();
            $imported++;
        }

        fclose($handle);

        return back()->with('status', "Imported {$imported} leads; skipped {$skipped} invalid rows.");
    }

    public function updateLead(Request $request, OutreachLead $lead): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(OutreachLead::STATUSES))],
        ]);

        $lead->forceFill([
            'status' => $validated['status'],
            'replied_at' => $validated['status'] === 'replied' ? ($lead->replied_at ?? now()) : $lead->replied_at,
        ])->save();

        if (in_array($validated['status'], ['replied', 'not_interested', 'bounced', 'unsubscribed'], true)) {
            $campaignIds = $lead->campaignContacts()
                ->whereIn('status', ['queued', 'active', 'sending', 'paused'])
                ->pluck('campaign_id');
            $lead->campaignContacts()
                ->whereIn('status', ['queued', 'active', 'sending', 'paused'])
                ->update(['status' => $validated['status'], 'next_send_at' => null, 'stopped_at' => now()]);
            OutreachCampaign::query()->whereIn('id', $campaignIds)->get()->each->completeIfFinished();
        }

        return back()->with('status', 'Lead status updated.');
    }

    public function storeCampaign(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email_account_id' => [
                'required',
                'integer',
                Rule::exists('outreach_email_accounts', 'id')->where(fn ($query) => $query->where('user_id', $request->user()->getKey())),
            ],
            'daily_limit' => ['required', 'integer', 'min:1', 'max:500'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:50000'],
            'lead_ids' => ['required', 'array', 'min:1'],
            'lead_ids.*' => ['integer', 'distinct', Rule::exists('outreach_leads', 'id')],
        ]);

        $leadIds = OutreachLead::query()
            ->whereIn('id', $validated['lead_ids'])
            ->whereNotIn('status', ['bounced', 'unsubscribed', 'not_interested'])
            ->pluck('id');

        if ($leadIds->isEmpty()) {
            throw ValidationException::withMessages(['lead_ids' => 'Choose at least one contactable lead.']);
        }

        $campaign = DB::transaction(function () use ($request, $validated, $leadIds): OutreachCampaign {
            $campaign = OutreachCampaign::create([
                'created_by_id' => $request->user()->getKey(),
                'email_account_id' => $validated['email_account_id'],
                'name' => $validated['name'],
                'status' => 'draft',
                'daily_limit' => $validated['daily_limit'],
                'timezone' => 'America/New_York',
                'sending_start' => '09:00:00',
                'sending_end' => '17:00:00',
                'sending_days' => [1, 2, 3, 4, 5],
            ]);
            $campaign->steps()->create([
                'position' => 1,
                'delay_days' => 0,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
            ]);

            foreach ($leadIds as $leadId) {
                $campaign->contacts()->create(['lead_id' => $leadId, 'status' => 'queued']);
            }

            return $campaign;
        });

        return redirect()->route('platform.email-campaigns.campaigns.show', $campaign)
            ->with('status', 'Campaign created. Add follow-ups, then start when ready.');
    }

    public function updateCampaign(Request $request, OutreachCampaign $campaign): RedirectResponse
    {
        abort_if($campaign->status === 'active', 422, 'Pause this campaign before editing its sequence.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email_account_id' => [
                'required',
                'integer',
                Rule::exists('outreach_email_accounts', 'id')->where(fn ($query) => $query->where('user_id', $request->user()->getKey())),
            ],
            'daily_limit' => ['required', 'integer', 'min:1', 'max:500'],
            'timezone' => ['required', 'timezone'],
            'sending_start' => ['required', 'date_format:H:i'],
            'sending_end' => ['required', 'date_format:H:i', 'after:sending_start'],
            'steps' => ['required', 'array', 'min:1', 'max:12'],
            'steps.*.subject' => ['required', 'string', 'max:255'],
            'steps.*.body' => ['required', 'string', 'max:50000'],
            'steps.*.delay_days' => ['required', 'integer', 'min:0', 'max:365'],
        ]);

        DB::transaction(function () use ($campaign, $validated): void {
            $campaign->forceFill([
                'name' => $validated['name'],
                'email_account_id' => $validated['email_account_id'],
                'daily_limit' => $validated['daily_limit'],
                'timezone' => $validated['timezone'],
                'sending_start' => $validated['sending_start'],
                'sending_end' => $validated['sending_end'],
            ])->save();

            $keptIds = [];

            foreach ($validated['steps'] as $index => $stepData) {
                $step = $campaign->steps()->updateOrCreate(
                    ['position' => $index + 1],
                    [
                        'delay_days' => $index === 0 ? 0 : $stepData['delay_days'],
                        'subject' => $stepData['subject'],
                        'body' => $stepData['body'],
                    ],
                );
                $keptIds[] = $step->getKey();
            }

            $campaign->steps()->whereNotIn('id', $keptIds)->delete();
        });

        return back()->with('status', 'Campaign sequence saved.');
    }

    public function startCampaign(OutreachCampaign $campaign): RedirectResponse
    {
        $campaign->loadMissing(['emailAccount', 'steps']);

        if (! $campaign->emailAccount?->isConnected()) {
            throw ValidationException::withMessages(['email_account_id' => 'Add a connected Mailgun sender before starting.']);
        }

        if ($campaign->steps->isEmpty() || ! $campaign->contacts()->whereIn('status', ['queued', 'paused'])->exists()) {
            throw ValidationException::withMessages(['campaign' => 'This campaign has no leads waiting to receive the sequence.']);
        }

        DB::transaction(function () use ($campaign): void {
            $campaign->forceFill(['status' => 'active', 'started_at' => $campaign->started_at ?? now(), 'paused_at' => null])->save();
            $campaign->contacts()
                ->whereIn('status', ['queued', 'paused'])
                ->whereHas('lead', fn ($query) => $query->whereNotIn('status', ['replied', 'not_interested', 'bounced', 'unsubscribed']))
                ->update(['status' => 'active', 'next_send_at' => now(), 'stopped_at' => null]);
        });

        $campaign->contacts()
            ->where('status', 'active')
            ->where('next_send_at', '<=', now())
            ->each(function (OutreachCampaignContact $contact): void {
                $claimed = OutreachCampaignContact::query()
                    ->whereKey($contact->getKey())
                    ->where('status', 'active')
                    ->update(['status' => 'sending']);

                if ($claimed === 1) {
                    SendOutreachEmail::dispatch($contact->getKey());
                }
            });

        return back()->with('status', 'Campaign started. Initial messages were added to the sending queue.');
    }

    public function pauseCampaign(OutreachCampaign $campaign): RedirectResponse
    {
        DB::transaction(function () use ($campaign): void {
            $campaign->forceFill(['status' => 'paused', 'paused_at' => now()])->save();
            $campaign->contacts()->whereIn('status', ['active', 'sending'])->update(['status' => 'paused']);
        });

        return back()->with('status', 'Campaign paused.');
    }

    public function updateEmailAccount(Request $request, OutreachEmailAccount $account): RedirectResponse
    {
        abort_unless($account->user_id === $request->user()->getKey() && $account->provider === 'mailgun', 404);
        $validated = $request->validate([
            'daily_limit' => ['required', 'integer', 'min:1', 'max:500'],
            'timezone' => ['required', 'timezone'],
            'sending_start' => ['required', 'date_format:H:i'],
            'sending_end' => ['required', 'date_format:H:i', 'after:sending_start'],
        ]);
        $account->forceFill($validated)->save();

        return back()->with('status', 'Sending settings updated.');
    }

    public function storeEmailAccount(Request $request): RedirectResponse
    {
        abort_unless($this->mailgunConfigured(), 503, 'Mailgun is not configured.');
        $validated = $request->validate([
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('outreach_email_accounts', 'email')->where(fn ($query) => $query
                    ->where('user_id', $request->user()->getKey())
                    ->where('provider', 'mailgun')),
            ],
            'daily_limit' => ['required', 'integer', 'min:1', 'max:500'],
        ]);
        $domain = mb_strtolower((string) config('services.mailgun.domain'));

        if (! str_ends_with(mb_strtolower($validated['email']), '@'.$domain)) {
            throw ValidationException::withMessages([
                'email' => "Use a sender address on the configured Mailgun domain ({$domain}).",
            ]);
        }

        OutreachEmailAccount::create([
            'user_id' => $request->user()->getKey(),
            'provider' => 'mailgun',
            'email' => mb_strtolower($validated['email']),
            'access_token' => 'configured-in-environment',
            'status' => 'connected',
            'daily_limit' => $validated['daily_limit'],
            'timezone' => 'America/New_York',
            'sending_start' => '09:00:00',
            'sending_end' => '17:00:00',
        ]);

        return back()->with('status', 'Mailgun sender added.');
    }

    public function destroyEmailAccount(Request $request, OutreachEmailAccount $account): RedirectResponse
    {
        abort_unless($account->user_id === $request->user()->getKey() && $account->provider === 'mailgun', 404);

        DB::transaction(function () use ($account): void {
            $account->campaigns()->where('status', 'active')->update(['status' => 'paused', 'paused_at' => now()]);
            $account->campaigns()->each(fn (OutreachCampaign $campaign) => $campaign->contacts()
                ->whereIn('status', ['active', 'sending'])
                ->update(['status' => 'paused']));
            $account->delete();
        });

        return back()->with('status', 'Mailgun sender removed. Associated campaigns were paused.');
    }

    private function renderWorkspace(string $section, ?OutreachCampaign $selectedCampaign = null, ?Request $request = null): Response
    {
        $campaigns = OutreachCampaign::query()
            ->with('emailAccount:id,email,status')
            ->withCount([
                'contacts',
                'contacts as replied_count' => fn ($query) => $query->where('status', 'replied'),
                'contacts as interested_count' => fn ($query) => $query->whereHas('lead', fn ($leadQuery) => $leadQuery->where('status', 'interested')),
                'contacts as bounced_count' => fn ($query) => $query->where('status', 'bounced'),
                'messages as sent_count' => fn ($query) => $query->where('direction', 'outbound')->where('status', 'sent'),
            ])
            ->latest()
            ->get();
        $leadsQuery = OutreachLead::query()->latest();

        if ($request !== null) {
            $search = trim($request->string('search')->toString());
            $status = trim($request->string('status')->toString());
            $leadsQuery
                ->when($search !== '', fn ($query) => $query->where(function ($nested) use ($search): void {
                    $nested->where('email', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('company', 'like', "%{$search}%");
                }))
                ->when(array_key_exists($status, OutreachLead::STATUSES), fn ($query) => $query->where('status', $status));
        }

        $leads = $leadsQuery->limit(1000)->get()->map(fn (OutreachLead $lead): array => [
            ...$lead->only(['id', 'email', 'first_name', 'last_name', 'company', 'job_title', 'city', 'industry', 'custom_1', 'status']),
            'status_label' => $lead->statusLabel(),
            'last_contacted_at' => $lead->last_contacted_at?->toIso8601String(),
            'created_at' => $lead->created_at?->toIso8601String(),
        ]);
        $accounts = OutreachEmailAccount::query()
            ->where('user_id', auth()->id())
            ->where('provider', 'mailgun')
            ->latest()
            ->get()
            ->map(fn (OutreachEmailAccount $account): array => [
                ...$account->only(['id', 'email', 'provider', 'status', 'daily_limit', 'timezone', 'sending_start', 'sending_end', 'last_error']),
                'token_expires_at' => $account->token_expires_at?->toIso8601String(),
            ]);
        $inbox = OutreachMessage::query()
            ->with(['lead:id,email,first_name,last_name,company,status', 'campaign:id,name'])
            ->where('direction', 'inbound')
            ->latest('received_at')
            ->limit(200)
            ->get()
            ->map(fn (OutreachMessage $message): array => [
                ...$message->only(['id', 'subject', 'body', 'status', 'provider_thread_id']),
                'received_at' => $message->received_at?->toIso8601String(),
                'lead' => $message->lead?->only(['id', 'email', 'first_name', 'last_name', 'company', 'status']),
                'campaign' => $message->campaign?->only(['id', 'name']),
            ]);

        if ($selectedCampaign !== null) {
            $selectedCampaign->load(['steps', 'emailAccount'])->loadCount([
                'contacts',
                'contacts as active_count' => fn ($query) => $query->whereIn('status', ['active', 'sending']),
                'contacts as replied_count' => fn ($query) => $query->where('status', 'replied'),
                'contacts as bounced_count' => fn ($query) => $query->where('status', 'bounced'),
                'messages as sent_count' => fn ($query) => $query->where('direction', 'outbound')->where('status', 'sent'),
                'messages as sent_today_count' => fn ($query) => $query->where('direction', 'outbound')->where('status', 'sent')->whereDate('sent_at', today()),
            ]);
        }

        return Inertia::render('platform/email-campaigns/index', [
            'active_section' => $section,
            'lead_statuses' => OutreachLead::STATUSES,
            'stats' => [
                'leads' => OutreachLead::query()->count(),
                'active_campaigns' => OutreachCampaign::query()->where('status', 'active')->count(),
                'scheduled_today' => OutreachCampaignContact::query()->whereIn('status', ['active', 'sending'])->whereDate('next_send_at', today())->count(),
                'sent_today' => OutreachMessage::query()->where('direction', 'outbound')->where('status', 'sent')->whereDate('sent_at', today())->count(),
                'replies' => OutreachLead::query()->whereIn('status', ['replied', 'interested', 'meeting_booked'])->count(),
                'interested' => OutreachLead::query()->where('status', 'interested')->count(),
                'bounces' => OutreachLead::query()->where('status', 'bounced')->count(),
            ],
            'campaigns' => $campaigns,
            'leads' => $leads,
            'email_accounts' => $accounts,
            'inbox' => $inbox,
            'selected_campaign' => $selectedCampaign ? [
                ...$selectedCampaign->only(['id', 'name', 'status', 'email_account_id', 'daily_limit', 'timezone', 'sending_start', 'sending_end']),
                'contacts_count' => $selectedCampaign->contacts_count,
                'active_count' => $selectedCampaign->active_count,
                'replied_count' => $selectedCampaign->replied_count,
                'bounced_count' => $selectedCampaign->bounced_count,
                'sent_count' => $selectedCampaign->sent_count,
                'sent_today_count' => $selectedCampaign->sent_today_count,
                'steps' => $selectedCampaign->steps->map->only(['id', 'position', 'delay_days', 'subject', 'body'])->values(),
            ] : null,
            'mailgun_configured' => $this->mailgunConfigured(),
            'mailgun_domain' => config('services.mailgun.domain'),
            'mailgun_inbound_domain' => config('services.mailgun.inbound_domain'),
        ]);
    }

    private function mailgunConfigured(): bool
    {
        return filled(config('services.mailgun.domain'))
            && filled(config('services.mailgun.secret'))
            && filled(config('services.mailgun.webhook_signing_key'))
            && filled(config('services.mailgun.inbound_domain'));
    }

    /** @param array<string,string> $record @param array<int,string> $keys */
    private function csvValue(array $record, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (filled($record[$key] ?? null)) {
                return $record[$key];
            }
        }

        return null;
    }
}
