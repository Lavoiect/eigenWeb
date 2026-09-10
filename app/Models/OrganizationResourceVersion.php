<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $organization_resource_id
 * @property int $version_number
 * @property string $disk
 * @property string $path
 * @property string $url
 * @property string $original_name
 * @property string|null $mime_type
 * @property int|null $size_bytes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'organization_resource_id',
    'uploaded_by_id',
    'version_number',
    'disk',
    'path',
    'url',
    'original_name',
    'mime_type',
    'size_bytes',
])]
class OrganizationResourceVersion extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'size_bytes' => 'integer',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(OrganizationResource::class, 'organization_resource_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }
}
