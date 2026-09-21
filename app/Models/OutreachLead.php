<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'created_by_id', 'email', 'first_name', 'last_name', 'company', 'job_title',
    'city', 'industry', 'custom_1', 'status', 'unsubscribe_token', 'metadata',
    'last_contacted_at', 'replied_at',
])]
class OutreachLead extends Model
{
    public const STATUSES = [
        'new' => 'New',
        'active' => 'Active',
        'replied' => 'Replied',
        'interested' => 'Interested',
        'not_interested' => 'Not Interested',
        'follow_up_later' => 'Follow Up Later',
        'meeting_booked' => 'Meeting Booked',
        'bounced' => 'Bounced',
        'unsubscribed' => 'Unsubscribed',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'last_contacted_at' => 'datetime',
            'replied_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function campaignContacts(): HasMany
    {
        return $this->hasMany(OutreachCampaignContact::class, 'lead_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OutreachMessage::class, 'lead_id');
    }

    public function statusLabel(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst(str_replace('_', ' ', $this->status));
    }

    public function canReceiveEmail(): bool
    {
        return ! in_array($this->status, ['replied', 'not_interested', 'bounced', 'unsubscribed'], true);
    }
}
