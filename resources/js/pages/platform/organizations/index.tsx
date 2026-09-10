import { Form, Head, router } from '@inertiajs/react';
import {
    Building2,
    CheckCircle2,
    ChevronDown,
    CirclePause,
    Clock3,
    GraduationCap,
    ImagePlus,
    Library,
    Mail,
    Network,
    Plus,
    Search,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';

import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Administrator = {
    id: number;
    name: string;
    email: string;
    account_status: 'pending' | 'active' | 'suspended';
    account_status_label: string;
};

type OrganizationSummary = {
    id: number;
    name: string;
    slug: string;
    logo_url: string | null;
    status: 'setup' | 'active' | 'suspended';
    status_label: string;
    user_count: number;
    learner_count: number;
    course_count: number;
    pathway_count: number;
    resource_count: number;
    updated_at: string | null;
    administrators: Administrator[];
};

type PageProps = {
    organizations: OrganizationSummary[];
    managedOrganizationId: number | null;
};

const statusStyles: Record<OrganizationSummary['status'], string> = {
    setup: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    active: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    suspended:
        'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function formatDate(value: string | null): string {
    if (!value) {
        return 'No activity yet';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

function Metric({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Users;
    label: string;
    value: number;
}) {
    return (
        <div className="rounded-xl border bg-muted/25 p-3">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
    );
}

export default function PlatformOrganizations({
    organizations,
    managedOrganizationId,
}: PageProps) {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const [statusFilter, setStatusFilter] = useState<'all' | OrganizationSummary['status']>('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoName, setLogoName] = useState('');
    const [administratorOrganization, setAdministratorOrganization] =
        useState<OrganizationSummary | null>(null);

    useEffect(() => {
        return () => {
            if (logoPreview) {
                URL.revokeObjectURL(logoPreview);
            }
        };
    }, [logoPreview]);

    const handleLogoChange = (file: File | undefined) => {
        setLogoPreview((current) => {
            if (current) {
                URL.revokeObjectURL(current);
            }

            return file ? URL.createObjectURL(file) : null;
        });
        setLogoName(file?.name ?? '');
    };

    const filteredOrganizations = organizations.filter((organization) => {
        const matchesQuery =
            deferredQuery.length === 0 ||
            organization.name.toLowerCase().includes(deferredQuery) ||
            organization.slug.toLowerCase().includes(deferredQuery) ||
            organization.administrators.some((administrator) =>
                administrator.email.toLowerCase().includes(deferredQuery),
            );
        const matchesStatus =
            statusFilter === 'all' || organization.status === statusFilter;

        return matchesQuery && matchesStatus;
    });

    const updateStatus = (
        organization: OrganizationSummary,
        status: OrganizationSummary['status'],
    ) => {
        router.patch(`/platform/organizations/${organization.id}/status`, {
            status,
        });
    };

    return (
        <>
            <Head title="Organizations" />

            <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
                <section className="overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_top_right,rgba(22,119,255,0.16),transparent_38%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)))] p-6 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                                <ShieldCheck className="size-4" />
                                Eigen platform administration
                            </div>
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                                Customer organizations
                            </h1>
                            <p className="text-muted-foreground">
                                Create customer workspaces, configure training,
                                and hand off a ready account to each organization
                                administrator.
                            </p>
                        </div>
                        <Button size="lg" onClick={() => setCreateOpen(true)}>
                            <Plus />
                            Create organization
                        </Button>
                    </div>
                </section>

                <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search organizations or administrators"
                            className="pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'setup', 'active', 'suspended'] as const).map(
                            (status) => (
                                <Button
                                    key={status}
                                    type="button"
                                    size="sm"
                                    variant={
                                        statusFilter === status
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => setStatusFilter(status)}
                                    className="capitalize"
                                >
                                    {status}
                                </Button>
                            ),
                        )}
                    </div>
                </section>

                <section className="space-y-4">
                    {filteredOrganizations.map((organization) => (
                        <Card
                            key={organization.id}
                            className={
                                managedOrganizationId === organization.id
                                    ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-950'
                                    : ''
                            }
                        >
                            <CardContent className="space-y-5 p-5 sm:p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="flex min-w-0 items-start gap-4">
                                        {organization.logo_url ? (
                                            <img
                                                src={organization.logo_url}
                                                alt={`${organization.name} logo`}
                                                className="size-12 shrink-0 rounded-xl border bg-white object-contain p-1"
                                            />
                                        ) : (
                                            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-950 font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
                                                {initials(organization.name)}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-lg font-semibold">
                                                    {organization.name}
                                                </h2>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        statusStyles[
                                                            organization.status
                                                        ]
                                                    }
                                                >
                                                    {organization.status_label}
                                                </Badge>
                                                {managedOrganizationId ===
                                                    organization.id && (
                                                    <Badge className="bg-blue-600">
                                                        Current workspace
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {organization.slug} · Updated{' '}
                                                {formatDate(
                                                    organization.updated_at,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                setAdministratorOrganization(
                                                    organization,
                                                )
                                            }
                                        >
                                            <Mail />
                                            Add administrator
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                router.post(
                                                    `/platform/organizations/${organization.id}/manage`,
                                                )
                                            }
                                        >
                                            <Building2 />
                                            Manage organization
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label={`Change ${organization.name} status`}
                                                >
                                                    <ChevronDown />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        updateStatus(
                                                            organization,
                                                            'setup',
                                                        )
                                                    }
                                                >
                                                    <Clock3 /> Setup
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        updateStatus(
                                                            organization,
                                                            'active',
                                                        )
                                                    }
                                                >
                                                    <CheckCircle2 /> Activate
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() =>
                                                        updateStatus(
                                                            organization,
                                                            'suspended',
                                                        )
                                                    }
                                                >
                                                    <CirclePause /> Suspend
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    <Metric
                                        icon={Users}
                                        label="People"
                                        value={organization.user_count}
                                    />
                                    <Metric
                                        icon={GraduationCap}
                                        label="Learners"
                                        value={organization.learner_count}
                                    />
                                    <Metric
                                        icon={Library}
                                        label="Courses"
                                        value={organization.course_count}
                                    />
                                    <Metric
                                        icon={Network}
                                        label="Pathways"
                                        value={organization.pathway_count}
                                    />
                                    <Metric
                                        icon={Building2}
                                        label="Resources"
                                        value={organization.resource_count}
                                    />
                                </div>

                                <div className="rounded-xl border bg-background p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-semibold">
                                            Organization administrators
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                            {organization.administrators.length}{' '}
                                            total
                                        </span>
                                    </div>
                                    {organization.administrators.length > 0 ? (
                                        <div className="grid gap-2 lg:grid-cols-2">
                                            {organization.administrators.map(
                                                (administrator) => (
                                                    <div
                                                        key={administrator.id}
                                                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">
                                                                {
                                                                    administrator.name
                                                                }
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {
                                                                    administrator.email
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <Badge
                                                                variant="outline"
                                                                className="capitalize"
                                                            >
                                                                {
                                                                    administrator.account_status_label
                                                                }
                                                            </Badge>
                                                            {administrator.account_status ===
                                                                'pending' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        router.post(
                                                                            `/platform/organizations/${organization.id}/administrators/${administrator.id}/resend-activation`,
                                                                        )
                                                                    }
                                                                >
                                                                    Resend
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No customer administrator has been
                                            added yet. Finish setup, then send
                                            the activation link when the account
                                            is ready to hand off.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filteredOrganizations.length === 0 && (
                        <div className="rounded-2xl border border-dashed p-12 text-center">
                            <Building2 className="mx-auto mb-3 size-8 text-muted-foreground" />
                            <h2 className="font-semibold">
                                No organizations found
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Adjust the search or status filter, or create a
                                new customer workspace.
                            </p>
                        </div>
                    )}
                </section>
            </main>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create organization</DialogTitle>
                        <DialogDescription>
                            Start a private customer workspace. You can enter it
                            immediately to build their training and structure.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action="/platform/organizations"
                        method="post"
                        className="space-y-4"
                        onSuccess={() => {
                            setCreateOpen(false);
                            setLogoPreview(null);
                            setLogoName('');
                        }}
                        resetOnSuccess
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="organization-name">
                                        Organization name
                                    </Label>
                                    <Input
                                        id="organization-name"
                                        name="name"
                                        autoFocus
                                        required
                                        placeholder="Acme Operations"
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="organization-slug">
                                        Workspace slug{' '}
                                        <span className="font-normal text-muted-foreground">
                                            (optional)
                                        </span>
                                    </Label>
                                    <Input
                                        id="organization-slug"
                                        name="slug"
                                        placeholder="acme-operations"
                                    />
                                    <InputError message={errors.slug} />
                                    <p className="text-xs text-muted-foreground">
                                        Leave blank to generate this from the
                                        organization name.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="organization-logo">
                                        Company logo{' '}
                                        <span className="font-normal text-muted-foreground">
                                            (optional)
                                        </span>
                                    </Label>
                                    <div className="flex items-center gap-4 rounded-xl border border-dashed bg-muted/20 p-4">
                                        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-background">
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview}
                                                    alt="Selected company logo preview"
                                                    className="size-full object-contain p-1"
                                                />
                                            ) : (
                                                <ImagePlus className="size-6 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                asChild
                                            >
                                                <Label
                                                    htmlFor="organization-logo"
                                                    className="cursor-pointer"
                                                >
                                                    Choose logo
                                                </Label>
                                            </Button>
                                            <Input
                                                id="organization-logo"
                                                name="logo"
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="sr-only"
                                                onChange={(event) =>
                                                    handleLogoChange(
                                                        event.target.files?.[0],
                                                    )
                                                }
                                            />
                                            <p className="truncate text-xs text-muted-foreground">
                                                {logoName ||
                                                    'JPG, PNG, or WebP up to 5 MB'}
                                            </p>
                                        </div>
                                    </div>
                                    <InputError message={errors.logo} />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCreateOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}
                                        Create workspace
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={administratorOrganization !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setAdministratorOrganization(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add organization administrator</DialogTitle>
                        <DialogDescription>
                            {administratorOrganization
                                ? `Create a pending administrator for ${administratorOrganization.name}. They will receive a secure link to set their password and activate the account.`
                                : 'Create a pending organization administrator.'}
                        </DialogDescription>
                    </DialogHeader>
                    {administratorOrganization && (
                        <Form
                            action={`/platform/organizations/${administratorOrganization.id}/administrators`}
                            method="post"
                            className="space-y-4"
                            onSuccess={() =>
                                setAdministratorOrganization(null)
                            }
                            resetOnSuccess
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="administrator-name">
                                            Full name
                                        </Label>
                                        <Input
                                            id="administrator-name"
                                            name="name"
                                            autoFocus
                                            required
                                            placeholder="Jordan Lee"
                                        />
                                        <InputError message={errors.name} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="administrator-email">
                                            Work email
                                        </Label>
                                        <Input
                                            id="administrator-email"
                                            name="email"
                                            type="email"
                                            required
                                            placeholder="jordan@company.com"
                                        />
                                        <InputError message={errors.email} />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setAdministratorOrganization(
                                                    null,
                                                )
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Create and send activation
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
