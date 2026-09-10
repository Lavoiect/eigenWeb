import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    Link2,
    Mail,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { dashboard } from '@/routes';
import { store } from '@/routes/organizations/invitations';
import type { Auth } from '@/types';

type Organization = {
    id: number;
    name: string;
    slug: string;
};

type Invitation = {
    id: number;
    email: string;
    organization_role: 'organization_admin' | 'manager' | 'learner';
    organization_role_label: string;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    status_label: string;
    token: string;
    invite_url: string;
    created_at: string | null;
    expires_at: string | null;
    accepted_at: string | null;
    revoked_at: string | null;
    invited_by?: {
        id: number;
        name: string;
        email: string;
    } | null;
    accepted_by?: {
        id: number;
        name: string;
        email: string;
    } | null;
};

type PageProps = {
    auth: Auth;
    organization: Organization;
    invitations: Invitation[];
};

function formatDate(value: string | null): string {
    if (!value) {
        return 'Never';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function statusVariant(status: Invitation['status']) {
    switch (status) {
        case 'accepted':
            return 'default';
        case 'pending':
            return 'outline';
        case 'expired':
        case 'revoked':
            return 'destructive';
        default:
            return 'secondary';
    }
}

export default function OrganizationInvitations() {
    const { organization, invitations } = usePage<PageProps>().props;
    const [copiedText, copyToClipboard] = useClipboard();
    const [inviteRole, setInviteRole] = useState<
        'organization_admin' | 'manager' | 'learner'
    >('manager');

    const counts = useMemo(
        () => ({
            pending: invitations.filter((invite) => invite.status === 'pending')
                .length,
            accepted: invitations.filter(
                (invite) => invite.status === 'accepted',
            ).length,
            expired: invitations.filter((invite) => invite.status === 'expired')
                .length,
        }),
        [invitations],
    );

    const handleRevoke = (invitation: Invitation) => {
        if (
            !window.confirm(
                `Revoke the invitation sent to ${invitation.email}?`,
            )
        ) {
            return;
        }

        router.delete(
            `/organizations/${organization.id}/invitations/${invitation.id}`,
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <Head title={`${organization.name} invitations`} />

            <div className="space-y-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <Heading
                        title="Invitation management"
                        description={`Invite organization admins and managers, or create learner app logins for ${organization.name}.`}
                    />

                    <Button asChild variant="outline" className="w-fit">
                        <Link href={dashboard()}>Back to dashboard</Link>
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Total invites</CardDescription>
                            <CardTitle className="text-3xl">
                                {invitations.length}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Invitations that have been created for this
                            organization.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Pending</CardDescription>
                            <CardTitle className="text-3xl">
                                {counts.pending}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Invitations waiting for someone to accept.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Accepted</CardDescription>
                            <CardTitle className="text-3xl">
                                {counts.accepted}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Completed invites that have already been accepted.
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Create invite</CardTitle>
                            <CardDescription>
                                Web users receive an invitation link. Learners
                                receive an immediate mobile login.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form
                                {...store.form(organization)}
                                resetOnSuccess={[
                                    'name',
                                    'email',
                                    'temporary_password',
                                ]}
                                options={{
                                    preserveScroll: true,
                                }}
                                className="space-y-4"
                            >
                                {({
                                    processing,
                                    errors,
                                    recentlySuccessful,
                                }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Name</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                type="text"
                                                placeholder="Jordan Lee"
                                                autoComplete="name"
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email">
                                                Email address
                                            </Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                required
                                                placeholder="employee@example.com"
                                                autoComplete="email"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="organization_role">
                                                Invite as
                                            </Label>
                                            <select
                                                id="organization_role"
                                                name="organization_role"
                                                value={inviteRole}
                                                onChange={(event) =>
                                                    setInviteRole(
                                                        event.target.value as
                                                            typeof inviteRole,
                                                    )
                                                }
                                                className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"
                                            >
                                                <option value="manager">
                                                    Manager
                                                </option>
                                                <option value="organization_admin">
                                                    Organization Admin
                                                </option>
                                                <option value="learner">
                                                    Learner
                                                </option>
                                            </select>
                                            <InputError
                                                message={
                                                    errors.organization_role
                                                }
                                            />
                                        </div>

                                        {inviteRole === 'learner' && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="temporary_password">
                                                    Temporary password
                                                </Label>
                                                <Input
                                                    id="temporary_password"
                                                    name="temporary_password"
                                                    type="password"
                                                    minLength={8}
                                                    required
                                                    autoComplete="new-password"
                                                />
                                                <InputError
                                                    message={
                                                        errors.temporary_password
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    The learner can sign into
                                                    the mobile app immediately
                                                    and must change this after
                                                    login.
                                                </p>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            {inviteRole === 'learner'
                                                ? 'Create learner login'
                                                : 'Send invitation'}
                                        </Button>

                                        {recentlySuccessful && (
                                            <p className="text-sm text-muted-foreground">
                                                {inviteRole === 'learner'
                                                    ? 'Learner login created.'
                                                    : 'Invitation sent.'}
                                            </p>
                                        )}
                                    </>
                                )}
                            </Form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Current invitations</CardTitle>
                            <CardDescription>
                                Track which invites are pending, accepted,
                                expired, or revoked.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {invitations.length === 0 ? (
                                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    No invitations yet. Send the first one on
                                    the left.
                                </div>
                            ) : (
                                invitations.map((invitation) => (
                                    <div
                                        key={invitation.id}
                                        className="rounded-2xl border p-4 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">
                                                        {invitation.email}
                                                    </p>
                                                    <Badge
                                                        variant={statusVariant(
                                                            invitation.status,
                                                        )}
                                                    >
                                                        {
                                                            invitation.status_label
                                                        }
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {
                                                            invitation.organization_role_label
                                                        }
                                                    </Badge>
                                                </div>

                                                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                                    <p className="flex items-center gap-2">
                                                        <Mail className="size-4" />
                                                        Invited by{' '}
                                                        {invitation.invited_by
                                                            ?.name ?? 'Unknown'}
                                                    </p>
                                                    <p className="flex items-center gap-2">
                                                        <ShieldCheck className="size-4" />
                                                        Created{' '}
                                                        {formatDate(
                                                            invitation.created_at,
                                                        )}
                                                    </p>
                                                    <p className="flex items-center gap-2">
                                                        <Users className="size-4" />
                                                        Expires{' '}
                                                        {formatDate(
                                                            invitation.expires_at,
                                                        )}
                                                    </p>
                                                    <p className="flex items-center gap-2">
                                                        <Link2 className="size-4" />
                                                        Token{' '}
                                                        {invitation.token.slice(
                                                            0,
                                                            8,
                                                        )}
                                                        ...
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                                                    <p className="font-mono text-xs break-all">
                                                        {invitation.invite_url}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 lg:items-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        void copyToClipboard(
                                                            invitation.invite_url,
                                                        )
                                                    }
                                                >
                                                    {copiedText ===
                                                    invitation.invite_url ? (
                                                        <>
                                                            <Check className="size-4" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="size-4" />
                                                            Copy link
                                                        </>
                                                    )}
                                                </Button>

                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={
                                                        invitation.status !==
                                                        'pending'
                                                    }
                                                    onClick={() =>
                                                        handleRevoke(invitation)
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                    Revoke
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-2 border-t pt-4 text-sm text-muted-foreground sm:grid-cols-3">
                                            <p>
                                                Accepted:{' '}
                                                {formatDate(
                                                    invitation.accepted_at,
                                                )}
                                            </p>
                                            <p>
                                                Revoked:{' '}
                                                {formatDate(
                                                    invitation.revoked_at,
                                                )}
                                            </p>
                                            <p>
                                                Accepted by:{' '}
                                                {invitation.accepted_by?.name ??
                                                    'Not yet'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
