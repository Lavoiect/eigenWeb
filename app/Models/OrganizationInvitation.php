<?php

namespace App\Models;

use App\Enums\OrganizationRole;
use Database\Factories\OrganizationInvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_id
 * @property string $email
 * @property string $organization_role
 * @property string $token
 * @property Carbon|null $accepted_at
 * @property Carbon|null $revoked_at
 * @property Carbon|null $expires_at
 */
#[Fillable([
    'organization_id',
    'invited_by_id',
    'email',
    'organization_role',
    'token',
    'accepted_by_id',
    'accepted_at',
    'revoked_at',
    'expires_at',
])]
class OrganizationInvitation extends Model
{
    /** @use HasFactory<OrganizationInvitationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'expires_at' => 'datetime',
            'organization_role' => OrganizationRole::class,
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_id');
    }

    public function isPending(): bool
    {
        return $this->accepted_at === null && $this->revoked_at === null && ! $this->isExpired();
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function status(): string
    {
        if ($this->accepted_at !== null) {
            return 'accepted';
        }

        if ($this->revoked_at !== null) {
            return 'revoked';
        }

        if ($this->isExpired()) {
            return 'expired';
        }

        return 'pending';
    }

    public function statusLabel(): string
    {
        return match ($this->status()) {
            'accepted' => 'Accepted',
            'revoked' => 'Revoked',
            'expired' => 'Expired',
            default => 'Pending',
        };
    }

    public function accept(User $user): void
    {
        $this->forceFill([
            'accepted_by_id' => $user->getKey(),
            'accepted_at' => now(),
        ])->save();
    }
}
