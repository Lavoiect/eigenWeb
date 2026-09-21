<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'email_account_id', 'campaign_id', 'campaign_contact_id', 'lead_id',
    'campaign_step_id', 'direction', 'provider_message_id', 'provider_thread_id',
    'subject', 'body', 'status', 'sent_at', 'received_at', 'error',
])]
class OutreachMessage extends Model
{
    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'received_at' => 'datetime'];
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(OutreachEmailAccount::class, 'email_account_id');
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(OutreachCampaign::class, 'campaign_id');
    }

    public function campaignContact(): BelongsTo
    {
        return $this->belongsTo(OutreachCampaignContact::class, 'campaign_contact_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(OutreachLead::class, 'lead_id');
    }

    public function campaignStep(): BelongsTo
    {
        return $this->belongsTo(OutreachCampaignStep::class, 'campaign_step_id');
    }
}
