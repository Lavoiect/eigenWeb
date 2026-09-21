<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'provider', 'email', 'access_token', 'refresh_token',
    'token_expires_at', 'status', 'daily_limit', 'timezone', 'sending_start',
    'sending_end', 'gmail_history_id', 'last_synced_at', 'last_error',
])]
class OutreachEmailAccount extends Model
{
    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'daily_limit' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(OutreachCampaign::class, 'email_account_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OutreachMessage::class, 'email_account_id');
    }

    public function isConnected(): bool
    {
        return $this->provider === 'mailgun'
            && $this->status === 'connected'
            && filled($this->access_token);
    }
}
