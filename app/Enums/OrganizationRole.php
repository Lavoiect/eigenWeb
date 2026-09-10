<?php

namespace App\Enums;

enum OrganizationRole: string
{
    case OrganizationAdmin = 'organization_admin';
    case Manager = 'manager';
    case Learner = 'learner';

    public function label(): string
    {
        return match ($this) {
            self::OrganizationAdmin => 'Organization Admin',
            self::Manager => 'Manager',
            self::Learner => 'Learner',
        };
    }
}
