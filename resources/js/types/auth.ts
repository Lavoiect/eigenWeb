export type User = {
    id: number;
    name: string;
    email: string;
    organization_id: number | null;
    organization_role: string | null;
    platform_role: string | null;
    account_status: 'pending' | 'active' | 'suspended';
    activated_at: string | null;
    must_change_password: boolean;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
    is_super_admin?: boolean;
    managed_organization?: {
        id: number;
        name: string;
        slug: string;
        status: 'setup' | 'active' | 'suspended';
        status_label: string;
    } | null;
    abilities?: {
        can_manage_users: boolean;
        can_author_training: boolean;
        can_assign_training: boolean;
        can_view_organization_reporting: boolean;
        can_view_team_reporting: boolean;
        can_manage_resources: boolean;
        can_view_own_training: boolean;
    };
};
