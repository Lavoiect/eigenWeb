<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['campaign_id', 'position', 'delay_days', 'subject', 'body'])]
class OutreachCampaignStep extends Model
{
    protected function casts(): array
    {
        return ['position' => 'integer', 'delay_days' => 'integer'];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(OutreachCampaign::class, 'campaign_id');
    }
}
