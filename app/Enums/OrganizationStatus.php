<?php

namespace App\Enums;

enum OrganizationStatus: string
{
    case Setup = 'setup';
    case Active = 'active';
    case Suspended = 'suspended';

    public function label(): string
    {
        return match ($this) {
            self::Setup => 'Setup',
            self::Active => 'Active',
            self::Suspended => 'Suspended',
        };
    }
}
