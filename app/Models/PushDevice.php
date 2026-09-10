<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $expo_push_token
 * @property string|null $platform
 * @property string|null $device_name
 * @property bool $enabled
 * @property Carbon|null $last_registered_at
 */
#[Fillable([
    'user_id',
    'expo_push_token',
    'platform',
    'device_name',
    'enabled',
    'last_registered_at',
])]
class PushDevice extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'last_registered_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
