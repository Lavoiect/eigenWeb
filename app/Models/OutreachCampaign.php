<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'created_by_id', 'email_account_id', 'name', 'status', 'daily_limit',
    'timezone', 'sending_start', 'sending_end', 'sending_days', 'started_at',
    'paused_at', 'completed_at',
])]
class OutreachCampaign extends Model
{
    protected function casts(): array
    {
        return [
            'daily_limit' => 'integer',
            'sending_days' => 'array',
            'started_at' => 'datetime',
            'paused_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(OutreachEmailAccount::class, 'email_account_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(OutreachCampaignStep::class, 'campaign_id')->orderBy('position');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(OutreachCampaignContact::class, 'campaign_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OutreachMessage::class, 'campaign_id');
    }

    public function completeIfFinished(): bool
    {
        if ($this->status !== 'active' || $this->contacts()->whereIn('status', ['queued', 'active', 'sending', 'paused'])->exists()) {
            return false;
        }

        return $this->forceFill([
            'status' => 'completed',
            'completed_at' => now(),
        ])->save();
    }
}
