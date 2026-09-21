<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'campaign_id', 'lead_id', 'current_step', 'status', 'next_send_at',
    'last_sent_at', 'stopped_at',
])]
class OutreachCampaignContact extends Model
{
    protected function casts(): array
    {
        return [
            'current_step' => 'integer',
            'next_send_at' => 'datetime',
            'last_sent_at' => 'datetime',
            'stopped_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(OutreachCampaign::class, 'campaign_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(OutreachLead::class, 'lead_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OutreachMessage::class, 'campaign_contact_id');
    }
}
