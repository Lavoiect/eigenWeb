<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outreach_email_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32)->default('gmail');
            $table->string('email');
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->string('status', 32)->default('connected');
            $table->unsignedSmallInteger('daily_limit')->default(25);
            $table->string('timezone', 64)->default('America/New_York');
            $table->time('sending_start')->default('09:00:00');
            $table->time('sending_end')->default('17:00:00');
            $table->string('gmail_history_id')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'provider', 'email'], 'outreach_accounts_user_provider_email_uq');
        });

        Schema::create('outreach_leads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email')->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('company')->nullable();
            $table->string('job_title')->nullable();
            $table->string('city')->nullable();
            $table->string('industry')->nullable();
            $table->text('custom_1')->nullable();
            $table->string('status', 32)->default('new');
            $table->string('unsubscribe_token', 64)->unique();
            $table->json('metadata')->nullable();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at'], 'outreach_leads_status_created_idx');
        });

        Schema::create('outreach_campaigns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('email_account_id')->nullable()->constrained('outreach_email_accounts')->nullOnDelete();
            $table->string('name');
            $table->string('status', 32)->default('draft');
            $table->unsignedSmallInteger('daily_limit')->default(25);
            $table->string('timezone', 64)->default('America/New_York');
            $table->time('sending_start')->default('09:00:00');
            $table->time('sending_end')->default('17:00:00');
            $table->json('sending_days')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at'], 'outreach_campaigns_status_created_idx');
        });

        Schema::create('outreach_campaign_steps', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('outreach_campaigns')->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->unsignedSmallInteger('delay_days')->default(0);
            $table->string('subject');
            $table->longText('body');
            $table->timestamps();

            $table->unique(['campaign_id', 'position'], 'outreach_steps_campaign_position_uq');
        });

        Schema::create('outreach_campaign_contacts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('outreach_campaigns')->cascadeOnDelete();
            $table->foreignId('lead_id')->constrained('outreach_leads')->cascadeOnDelete();
            $table->unsignedSmallInteger('current_step')->default(0);
            $table->string('status', 32)->default('queued');
            $table->timestamp('next_send_at')->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamp('stopped_at')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'lead_id'], 'outreach_contacts_campaign_lead_uq');
            $table->index(['status', 'next_send_at'], 'outreach_contacts_due_idx');
        });

        Schema::create('outreach_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('email_account_id')->nullable()->constrained('outreach_email_accounts')->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained('outreach_campaigns')->nullOnDelete();
            $table->foreignId('campaign_contact_id')->nullable()->constrained('outreach_campaign_contacts')->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained('outreach_leads')->nullOnDelete();
            $table->foreignId('campaign_step_id')->nullable()->constrained('outreach_campaign_steps')->nullOnDelete();
            $table->string('direction', 16);
            $table->string('provider_message_id')->nullable()->unique();
            $table->string('provider_thread_id')->nullable()->index();
            $table->string('subject')->nullable();
            $table->longText('body')->nullable();
            $table->string('status', 32);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['direction', 'received_at'], 'outreach_messages_inbox_idx');
            $table->index(['campaign_id', 'status', 'sent_at'], 'outreach_messages_campaign_sent_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outreach_messages');
        Schema::dropIfExists('outreach_campaign_contacts');
        Schema::dropIfExists('outreach_campaign_steps');
        Schema::dropIfExists('outreach_campaigns');
        Schema::dropIfExists('outreach_leads');
        Schema::dropIfExists('outreach_email_accounts');
    }
};
