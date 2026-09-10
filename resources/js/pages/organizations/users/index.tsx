import { Form, Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    ArrowDownAZ,
    ArrowRight,
    BriefcaseBusiness,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Download,
    Ellipsis,
    FileDown,
    GraduationCap,
    MapPin,
    MoreHorizontal,
    Network,
    Search,
    ShieldCheck,
    Upload,
    UserPlus,
    Users,
    UserX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';

type Organization = { id: number; name: string; slug: string };
type Team = {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    manager_count: number;
};
type PathwaySummary = { id: number; name: string };
type JobTitle = {
    id: number;
    name: string;
    description: string | null;
    employee_count: number;
    pathway_id: number | null;
    pathway: PathwaySummary | null;
};
type Location = {
    id: number;
    name: string;
    description: string | null;
    employee_count: number;
};
type Pathway = PathwaySummary & {
    description: string | null;
    job_title_count: number;
    course_count: number;
    item_count: number;
    milestone_count: number;
    sequential_completion: boolean;
    expected_completion_days: number | null;
};
type TrainingSummary = {
    assigned_courses: number;
    completed_courses: number;
    overdue_courses: number;
    average_score_percent: number | null;
    completion_percent: number | null;
};
type UserRow = {
    id: number;
    name: string;
    email: string;
    organization_role: 'organization_admin' | 'manager' | 'learner' | null;
    organization_role_label: string | null;
    account_status: 'active' | 'deactivated';
    account_status_label: string;
    must_change_password: boolean;
    created_at: string | null;
    last_active_at: string | null;
    is_current_user: boolean;
    job_title_id: number | null;
    job_title: (PathwaySummary & { pathway: PathwaySummary | null }) | null;
    location_id: number | null;
    location: PathwaySummary | null;
    team_assignment_mode: 'admin' | 'manager' | 'learner';
    assigned_team_ids: number[];
    filter_team_ids: number[];
    teams: PathwaySummary[];
    managed_teams: PathwaySummary[];
    training_status: 'unassigned' | 'in_progress' | 'overdue' | 'completed';
    training_status_label: string;
    training_summary: TrainingSummary;
};
type Option = { value: string; label: string };
type Filters = {
    search: string;
    role: string;
    team: number | null;
    training_status: string;
};
type Summary = {
    total: number;
    active: number;
    active_learners: number;
    needs_attention: number;
    deactivated: number;
    admins: number;
    managers: number;
    learners: number;
};
type Props = {
    organization: Organization;
    teams: Team[];
    jobTitles: JobTitle[];
    locations: Location[];
    pathways: Pathway[];
    users: UserRow[];
    summary: Summary;
    filters: Filters;
    roleOptions: Option[];
    trainingStatusOptions: Option[];
};

type Tab = 'employees' | 'teams' | 'job_titles' | 'locations';
type EmployeeModalMode = 'single' | 'bulk' | 'csv';
type InviteRole = 'organization_admin' | 'manager' | 'learner';
type CreateKind = 'team' | 'job_title' | 'location';
type BulkAction =
    'set_job_title' | 'set_location' | 'add_team' | 'set_account_status';

const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30';

const createMeta: Record<
    CreateKind,
    {
        title: string;
        description: string;
        field: string;
        placeholder: string;
        endpoint: string;
    }
> = {
    team: {
        title: 'Create team',
        description: 'Create a scoped group for managers and learners.',
        field: 'team_name',
        placeholder: 'Warehouse team',
        endpoint: 'teams',
    },
    job_title: {
        title: 'Create job title',
        description: 'Add a title that can connect employees to a pathway.',
        field: 'job_title_name',
        placeholder: 'Store manager',
        endpoint: 'job-titles',
    },
    location: {
        title: 'Create location',
        description: 'Add a store, warehouse, office, or region.',
        field: 'location_name',
        placeholder: 'Detroit warehouse',
        endpoint: 'locations',
    },
};

function initials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function relativeDate(value: string | null, notActivated = false): string {
    if (notActivated) {
        return 'Not activated';
    }

    if (!value) {
        return 'Never';
    }

    const elapsed = Date.now() - new Date(value).getTime();
    const days = Math.floor(elapsed / 86_400_000);

    if (days <= 0) {
        return 'Today';
    }

    if (days === 1) {
        return 'Yesterday';
    }

    if (days < 30) {
        return `${days} days ago`;
    }

    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year:
            new Date(value).getFullYear() === new Date().getFullYear()
                ? undefined
                : 'numeric',
    }).format(new Date(value));
}

function teamNames(user: UserRow): string {
    const assigned =
        user.team_assignment_mode === 'manager'
            ? user.managed_teams
            : user.teams;

    return assigned.length
        ? assigned.map((team) => team.name).join(', ')
        : 'No team';
}

function EmployeeAvatar({
    user,
    large = false,
}: {
    user: UserRow;
    large?: boolean;
}) {
    return (
        <div
            className={`relative grid shrink-0 place-items-center rounded-full bg-slate-900 font-semibold text-white ${large ? 'size-14 text-base' : 'size-9 text-xs'}`}
        >
            {initials(user.name)}
            <span
                className={`absolute right-0 bottom-0 rounded-full border-2 border-background ${large ? 'size-3.5' : 'size-3'} ${user.account_status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
        </div>
    );
}

function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: typeof Users;
    title: string;
    description: string;
    action: React.ReactNode;
}) {
    return (
        <div className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
            <div className="max-w-sm space-y-4">
                <div className="mx-auto grid size-11 place-items-center rounded-xl border bg-background shadow-sm">
                    <Icon className="size-5 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {action}
            </div>
        </div>
    );
}

export default function OrganizationUsers({
    organization,
    teams,
    jobTitles,
    locations,
    pathways,
    users,
    summary,
    filters,
    roleOptions,
    trainingStatusOptions,
}: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('employees');
    const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
    const [employeeModalMode, setEmployeeModalMode] =
        useState<EmployeeModalMode>('single');
    const [inviteRole, setInviteRole] = useState<InviteRole>('learner');
    const [createKind, setCreateKind] = useState<CreateKind>('team');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedJobTitleId, setSelectedJobTitleId] = useState<number | null>(
        null,
    );
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkAction>('set_job_title');
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState('');
    const [role, setRole] = useState(filters.role);
    const [team, setTeam] = useState(filters.team?.toString() ?? '');
    const [jobTitle, setJobTitle] = useState('');
    const [location, setLocation] = useState('');
    const [trainingStatus, setTrainingStatus] = useState(
        filters.training_status,
    );
    const [sort, setSort] = useState('name');
    const [page, setPage] = useState(1);

    const selectedUser =
        users.find((user) => user.id === selectedUserId) ?? null;
    const selectedJobTitle =
        jobTitles.find((item) => item.id === selectedJobTitleId) ?? null;
    const createConfig = createMeta[createKind];

    const filteredUsers = users
        .filter((user) => {
            const query = search.trim().toLowerCase();
            const matchesSearch =
                query === '' ||
                `${user.name} ${user.email} ${user.job_title?.name ?? ''}`
                    .toLowerCase()
                    .includes(query);

            return (
                matchesSearch &&
                (status === '' || user.account_status === status) &&
                (role === '' || user.organization_role === role) &&
                (team === '' || user.filter_team_ids.includes(Number(team))) &&
                (jobTitle === '' || user.job_title_id === Number(jobTitle)) &&
                (location === '' || user.location_id === Number(location)) &&
                (trainingStatus === '' ||
                    user.training_status === trainingStatus)
            );
        })
        .sort((a, b) => {
            if (sort === 'recently_added') {
                return (b.created_at ?? '').localeCompare(a.created_at ?? '');
            }

            if (sort === 'completion') {
                return (
                    (b.training_summary.completion_percent ?? -1) -
                    (a.training_summary.completion_percent ?? -1)
                );
            }

            if (sort === 'overdue') {
                return (
                    b.training_summary.overdue_courses -
                    a.training_summary.overdue_courses
                );
            }

            if (sort === 'last_active') {
                return (b.last_active_at ?? '').localeCompare(
                    a.last_active_at ?? '',
                );
            }

            return a.name.localeCompare(b.name);
        });

    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const pageUsers = filteredUsers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
    );
    const pageIsSelected =
        pageUsers.length > 0 &&
        pageUsers.every((user) => selectedIds.has(user.id));
    const hasFilters = Boolean(
        search ||
        status ||
        role ||
        team ||
        jobTitle ||
        location ||
        trainingStatus,
    );

    const resetFilters = () => {
        setSearch('');
        setStatus('');
        setRole('');
        setTeam('');
        setJobTitle('');
        setLocation('');
        setTrainingStatus('');
        setPage(1);
    };

    const toggleUser = (id: number, checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    };

    const togglePage = (checked: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            pageUsers.forEach((user) =>
                checked ? next.add(user.id) : next.delete(user.id),
            );

            return next;
        });
    };

    const openEmployeeModal = (mode: EmployeeModalMode) => {
        setEmployeeModalMode(mode);
        setEmployeeModalOpen(true);
    };

    const openCreateModal = (kind: CreateKind) => {
        setCreateKind(kind);
        setCreateModalOpen(true);
    };

    const handleDeactivate = (user: UserRow) => {
        if (
            !window.confirm(
                `Deactivate ${user.name}? They will lose access, but their assignments, transcript, and training history will be preserved.`,
            )
        ) {
            return;
        }

        router.patch(
            `/organizations/${organization.id}/users/${user.id}/deactivate`,
            {},
            { preserveScroll: true },
        );
    };

    const handleReactivate = (user: UserRow) => {
        router.patch(
            `/organizations/${organization.id}/users/bulk`,
            {
                user_ids: [user.id],
                action: 'set_account_status',
                account_status: 'active',
            },
            { preserveScroll: true },
        );
    };

    const exportEmployees = () => {
        const escape = (value: string | number) =>
            `"${String(value).replaceAll('"', '""')}"`;
        const rows = filteredUsers.map((user) => [
            user.name,
            user.email,
            user.organization_role_label ?? '',
            user.account_status_label,
            user.job_title?.name ?? '',
            teamNames(user),
            user.location?.name ?? '',
            user.training_status_label,
            user.training_summary.completion_percent ?? '',
        ]);
        const csv = [
            [
                'Name',
                'Email',
                'Role',
                'Status',
                'Job title',
                'Teams',
                'Location',
                'Training status',
                'Completion %',
            ],
            ...rows,
        ]
            .map((row) => row.map(escape).join(','))
            .join('\n');
        const url = URL.createObjectURL(
            new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        );
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${organization.slug}-employees.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <Head title={`${organization.name} employees`} />

            <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            {organization.name}
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Employees
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                            Manage employee access, organization details, and
                            training health from one roster.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => openEmployeeModal('csv')}
                        >
                            <Upload className="size-4" />
                            Import CSV
                        </Button>
                        <Button onClick={() => openEmployeeModal('single')}>
                            <UserPlus className="size-4" />
                            Add employees
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="More employee actions"
                                >
                                    <Ellipsis className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                    <Link
                                        href={`/organizations/${organization.id}/invitations`}
                                    >
                                        <Activity /> Invitation log
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={exportEmployees}>
                                    <Download /> Export employees
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <nav
                    className="flex gap-1 overflow-x-auto border-b"
                    aria-label="Employee management sections"
                >
                    {(
                        [
                            ['employees', 'Employees', summary.total],
                            ['teams', 'Teams', teams.length],
                            ['job_titles', 'Job titles', jobTitles.length],
                            ['locations', 'Locations', locations.length],
                        ] as const
                    ).map(([value, label, count]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setActiveTab(value)}
                            className={`relative flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors ${activeTab === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {label}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                {count}
                            </span>
                            {activeTab === value && (
                                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground" />
                            )}
                        </button>
                    ))}
                    <Link
                        href={`/organizations/${organization.id}/invitations`}
                        className="flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                        Invitations
                        <ArrowRight className="size-3.5" />
                    </Link>
                </nav>

                {activeTab === 'employees' && (
                    <section className="space-y-5">
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            {[
                                {
                                    label: 'Total employees',
                                    value: summary.total,
                                    note: `${summary.active} active accounts`,
                                    icon: Users,
                                },
                                {
                                    label: 'Active learners',
                                    value: summary.active_learners,
                                    note: `${summary.learners} learner accounts`,
                                    icon: GraduationCap,
                                },
                                {
                                    label: 'Managers',
                                    value: summary.managers,
                                    note: `${teams.length} teams available`,
                                    icon: ShieldCheck,
                                },
                                {
                                    label: 'Need attention',
                                    value: summary.needs_attention,
                                    note: 'Employees with overdue training',
                                    icon: Activity,
                                    alert: summary.needs_attention > 0,
                                },
                            ].map((metric) => (
                                <Card
                                    key={metric.label}
                                    className={`gap-0 py-0 ${
                                        metric.alert
                                            ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'
                                            : ''
                                    }`}
                                >
                                    <CardContent className="flex items-start justify-between p-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                {metric.label}
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold tabular-nums">
                                                {metric.value}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {metric.note}
                                            </p>
                                        </div>
                                        <metric.icon
                                            className={`size-5 ${metric.alert ? 'text-amber-700' : 'text-muted-foreground'}`}
                                        />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card className="overflow-hidden">
                            <div className="border-b p-4">
                                <div className="flex flex-col gap-3">
                                    <div className="relative min-w-64 flex-1">
                                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(event) => {
                                                setSearch(event.target.value);
                                                setPage(1);
                                            }}
                                            placeholder="Search name, email, or job title"
                                            className="pl-9"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                        <select
                                            aria-label="Account status"
                                            className={selectClass}
                                            value={status}
                                            onChange={(event) => {
                                                setStatus(event.target.value);
                                                setPage(1);
                                            }}
                                        >
                                            <option value="">
                                                All statuses
                                            </option>
                                            <option value="active">
                                                Active
                                            </option>
                                            <option value="deactivated">
                                                Deactivated
                                            </option>
                                        </select>
                                        <select
                                            aria-label="Role"
                                            className={selectClass}
                                            value={role}
                                            onChange={(event) => {
                                                setRole(event.target.value);
                                                setPage(1);
                                            }}
                                        >
                                            {roleOptions.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            aria-label="Team"
                                            className={selectClass}
                                            value={team}
                                            onChange={(event) => {
                                                setTeam(event.target.value);
                                                setPage(1);
                                            }}
                                        >
                                            <option value="">All teams</option>
                                            {teams.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            aria-label="Job title"
                                            className={selectClass}
                                            value={jobTitle}
                                            onChange={(event) => {
                                                setJobTitle(event.target.value);
                                                setPage(1);
                                            }}
                                        >
                                            <option value="">
                                                All job titles
                                            </option>
                                            {jobTitles.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            aria-label="Location"
                                            className={selectClass}
                                            value={location}
                                            onChange={(event) => {
                                                setLocation(event.target.value);
                                                setPage(1);
                                            }}
                                        >
                                            <option value="">
                                                All locations
                                            </option>
                                            {locations.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            aria-label="Training status"
                                            className={selectClass}
                                            value={trainingStatus}
                                            onChange={(event) => {
                                                setTrainingStatus(
                                                    event.target.value,
                                                );
                                                setPage(1);
                                            }}
                                        >
                                            {trainingStatusOptions.map(
                                                (option) => (
                                                    <option
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-muted-foreground">
                                        Showing{' '}
                                        <span className="font-medium text-foreground">
                                            {filteredUsers.length}
                                        </span>{' '}
                                        of {users.length} employees
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {hasFilters && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={resetFilters}
                                            >
                                                Clear filters
                                            </Button>
                                        )}
                                        <ArrowDownAZ className="size-4 text-muted-foreground" />
                                        <select
                                            aria-label="Sort employees"
                                            className={`${selectClass} w-auto`}
                                            value={sort}
                                            onChange={(event) =>
                                                setSort(event.target.value)
                                            }
                                        >
                                            <option value="name">Name</option>
                                            <option value="recently_added">
                                                Recently added
                                            </option>
                                            <option value="completion">
                                                Completion
                                            </option>
                                            <option value="overdue">
                                                Overdue first
                                            </option>
                                            <option value="last_active">
                                                Last active
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {selectedIds.size > 0 && (
                                <div className="flex flex-wrap items-center gap-2 border-b bg-slate-950 px-4 py-3 text-white">
                                    <span className="mr-2 text-sm font-medium">
                                        {selectedIds.size} selected
                                    </span>
                                    <Button
                                        asChild
                                        size="sm"
                                        variant="secondary"
                                    >
                                        <Link
                                            href={`/organizations/${organization.id}/courses`}
                                        >
                                            Assign training
                                        </Link>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setBulkModalOpen(true)}
                                    >
                                        Edit organization
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-white hover:text-slate-950"
                                        onClick={() =>
                                            setSelectedIds(new Set())
                                        }
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}

                            {filteredUsers.length === 0 ? (
                                <div className="p-5">
                                    <EmptyState
                                        icon={Search}
                                        title="No employees match these filters"
                                        description="Try clearing one or more filters, or add a new employee to the organization."
                                        action={
                                            <Button
                                                variant="outline"
                                                onClick={resetFilters}
                                            >
                                                Clear filters
                                            </Button>
                                        }
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="divide-y md:hidden">
                                        {pageUsers.map((user) => (
                                            <div
                                                key={user.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() =>
                                                    setSelectedUserId(user.id)
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        setSelectedUserId(
                                                            user.id,
                                                        );
                                                    }
                                                }}
                                                className="space-y-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        <Checkbox
                                                            checked={selectedIds.has(
                                                                user.id,
                                                            )}
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                toggleUser(
                                                                    user.id,
                                                                    Boolean(
                                                                        checked,
                                                                    ),
                                                                )
                                                            }
                                                            aria-label={`Select ${user.name}`}
                                                        />
                                                    </div>
                                                    <EmployeeAvatar
                                                        user={user}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-medium">
                                                            {user.name}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">
                                                        {user.organization_role_label ??
                                                            'Not set'}
                                                    </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 pl-12 text-xs">
                                                    <div>
                                                        <p className="text-muted-foreground">
                                                            Organization
                                                        </p>
                                                        <p className="mt-1 truncate font-medium">
                                                            {user.job_title
                                                                ?.name ??
                                                                'No job title'}
                                                        </p>
                                                        <p className="truncate text-muted-foreground">
                                                            {teamNames(user)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">
                                                            Training
                                                        </p>
                                                        <p className="mt-1 font-medium">
                                                            {user
                                                                .training_summary
                                                                .completion_percent ===
                                                            null
                                                                ? 'No assignments'
                                                                : `${user.training_summary.completion_percent}% complete`}
                                                        </p>
                                                        <p
                                                            className={
                                                                user
                                                                    .training_summary
                                                                    .overdue_courses >
                                                                0
                                                                    ? 'text-red-600'
                                                                    : 'text-muted-foreground'
                                                            }
                                                        >
                                                            {user
                                                                .training_summary
                                                                .overdue_courses >
                                                            0
                                                                ? `${user.training_summary.overdue_courses} overdue`
                                                                : relativeDate(
                                                                      user.last_active_at,
                                                                      user.must_change_password,
                                                                  )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="hidden overflow-x-auto md:block">
                                        <table className="w-full min-w-[960px] text-left text-sm">
                                            <thead className="bg-muted/40 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                <tr>
                                                    <th className="w-12 px-4 py-3">
                                                        <Checkbox
                                                            checked={
                                                                pageIsSelected
                                                            }
                                                            onCheckedChange={(
                                                                checked,
                                                            ) =>
                                                                togglePage(
                                                                    Boolean(
                                                                        checked,
                                                                    ),
                                                                )
                                                            }
                                                            aria-label="Select all employees on this page"
                                                        />
                                                    </th>
                                                    <th className="px-3 py-3">
                                                        Employee
                                                    </th>
                                                    <th className="px-3 py-3">
                                                        Role
                                                    </th>
                                                    <th className="px-3 py-3">
                                                        Organization
                                                    </th>
                                                    <th className="px-3 py-3">
                                                        Training
                                                    </th>
                                                    <th className="px-3 py-3">
                                                        Last active
                                                    </th>
                                                    <th className="w-14 px-4 py-3">
                                                        <span className="sr-only">
                                                            Actions
                                                        </span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {pageUsers.map((user) => (
                                                    <tr
                                                        key={user.id}
                                                        onClick={() =>
                                                            setSelectedUserId(
                                                                user.id,
                                                            )
                                                        }
                                                        className="cursor-pointer transition-colors hover:bg-muted/35"
                                                    >
                                                        <td
                                                            className="px-4 py-3"
                                                            onClick={(event) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            <Checkbox
                                                                checked={selectedIds.has(
                                                                    user.id,
                                                                )}
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) =>
                                                                    toggleUser(
                                                                        user.id,
                                                                        Boolean(
                                                                            checked,
                                                                        ),
                                                                    )
                                                                }
                                                                aria-label={`Select ${user.name}`}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <EmployeeAvatar
                                                                    user={user}
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-medium">
                                                                        {
                                                                            user.name
                                                                        }
                                                                    </p>
                                                                    <p className="truncate text-xs text-muted-foreground">
                                                                        {
                                                                            user.email
                                                                        }
                                                                    </p>
                                                                    <div className="mt-1 flex gap-1">
                                                                        {user.organization_role ===
                                                                            'organization_admin' && (
                                                                            <Badge variant="outline">
                                                                                Admin
                                                                            </Badge>
                                                                        )}
                                                                        {user.account_status ===
                                                                            'deactivated' && (
                                                                            <Badge variant="destructive">
                                                                                Deactivated
                                                                            </Badge>
                                                                        )}
                                                                        {user.must_change_password &&
                                                                            user.account_status ===
                                                                                'active' && (
                                                                                <Badge variant="secondary">
                                                                                    Not
                                                                                    activated
                                                                                </Badge>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-muted-foreground">
                                                            {user.organization_role_label ??
                                                                'Not set'}
                                                        </td>
                                                        <td className="max-w-64 px-3 py-3">
                                                            <p className="font-medium">
                                                                {user.job_title
                                                                    ?.name ??
                                                                    'No job title'}
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {teamNames(
                                                                    user,
                                                                )}{' '}
                                                                ·{' '}
                                                                {user.location
                                                                    ?.name ??
                                                                    'No location'}
                                                            </p>
                                                            {user.job_title
                                                                ?.pathway && (
                                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                    Pathway:{' '}
                                                                    {
                                                                        user
                                                                            .job_title
                                                                            .pathway
                                                                            .name
                                                                    }
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="w-56 px-3 py-3">
                                                            <div className="flex items-center justify-between gap-3 text-xs">
                                                                <span>
                                                                    {user
                                                                        .training_summary
                                                                        .completion_percent ===
                                                                    null
                                                                        ? 'No assignments'
                                                                        : `${user.training_summary.completion_percent}% complete`}
                                                                </span>
                                                                {user
                                                                    .training_summary
                                                                    .overdue_courses >
                                                                    0 && (
                                                                    <span className="font-medium text-red-600">
                                                                        {
                                                                            user
                                                                                .training_summary
                                                                                .overdue_courses
                                                                        }{' '}
                                                                        overdue
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                                <div
                                                                    className={`h-full rounded-full ${user.training_summary.overdue_courses > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                                    style={{
                                                                        width: `${user.training_summary.completion_percent ?? 0}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-muted-foreground">
                                                            {relativeDate(
                                                                user.last_active_at,
                                                                user.must_change_password,
                                                            )}
                                                        </td>
                                                        <td
                                                            className="px-4 py-3"
                                                            onClick={(event) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        aria-label={`Actions for ${user.name}`}
                                                                    >
                                                                        <MoreHorizontal className="size-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onSelect={() =>
                                                                            setSelectedUserId(
                                                                                user.id,
                                                                            )
                                                                        }
                                                                    >
                                                                        View
                                                                        details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        asChild
                                                                    >
                                                                        <Link
                                                                            href={`/organizations/${organization.id}/users/${user.id}`}
                                                                        >
                                                                            Open
                                                                            profile
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        asChild
                                                                    >
                                                                        <Link
                                                                            href={`/organizations/${organization.id}/users/${user.id}/transcript`}
                                                                        >
                                                                            View
                                                                            transcript
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    {!user.is_current_user && (
                                                                        <DropdownMenuSeparator />
                                                                    )}
                                                                    {!user.is_current_user &&
                                                                        user.account_status ===
                                                                            'active' && (
                                                                            <DropdownMenuItem
                                                                                variant="destructive"
                                                                                onSelect={() =>
                                                                                    handleDeactivate(
                                                                                        user,
                                                                                    )
                                                                                }
                                                                            >
                                                                                Deactivate
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    {user.account_status ===
                                                                        'deactivated' && (
                                                                        <DropdownMenuItem
                                                                            onSelect={() =>
                                                                                handleReactivate(
                                                                                    user,
                                                                                )
                                                                            }
                                                                        >
                                                                            Reactivate
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center justify-between border-t px-4 py-3">
                                <p className="text-xs text-muted-foreground">
                                    Page {currentPage} of {pageCount} · 25 per
                                    page
                                </p>
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage === 1}
                                        onClick={() =>
                                            setPage((value) =>
                                                Math.max(1, value - 1),
                                            )
                                        }
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage === pageCount}
                                        onClick={() =>
                                            setPage((value) =>
                                                Math.min(pageCount, value + 1),
                                            )
                                        }
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </section>
                )}

                {activeTab === 'teams' && (
                    <OrganizationListSection
                        title="Teams"
                        description="Teams control manager scope and make group training assignments easier."
                        buttonLabel="Create team"
                        onCreate={() => openCreateModal('team')}
                        empty={teams.length === 0}
                        emptyState={
                            <EmptyState
                                icon={Network}
                                title="Create your first team"
                                description="Group learners under the managers responsible for their progress."
                                action={
                                    <Button
                                        onClick={() => openCreateModal('team')}
                                    >
                                        Create team
                                    </Button>
                                }
                            />
                        }
                    >
                        {teams.map((item) => (
                            <div
                                key={item.id}
                                className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                            >
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.description ??
                                            'No description added'}
                                    </p>
                                </div>
                                <p className="text-sm">
                                    <span className="font-semibold tabular-nums">
                                        {item.member_count}
                                    </span>{' '}
                                    learners
                                </p>
                                <p className="text-sm">
                                    <span className="font-semibold tabular-nums">
                                        {item.manager_count}
                                    </span>{' '}
                                    managers
                                </p>
                            </div>
                        ))}
                    </OrganizationListSection>
                )}

                {activeTab === 'job_titles' && (
                    <OrganizationListSection
                        title="Job titles"
                        description="Job titles describe each employee's function and can automate pathway assignment."
                        buttonLabel="Create job title"
                        onCreate={() => openCreateModal('job_title')}
                        empty={jobTitles.length === 0}
                        emptyState={
                            <EmptyState
                                icon={BriefcaseBusiness}
                                title="Create your first job title"
                                description="Connect titles to pathways so new employees receive the right training automatically."
                                action={
                                    <Button
                                        onClick={() =>
                                            openCreateModal('job_title')
                                        }
                                    >
                                        Create job title
                                    </Button>
                                }
                            />
                        }
                    >
                        {jobTitles.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedJobTitleId(item.id)}
                                className="grid w-full gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/35 sm:grid-cols-[1fr_180px_180px_auto] sm:items-center"
                            >
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.description ??
                                            'No description added'}
                                    </p>
                                </div>
                                <p className="text-sm">
                                    <span className="font-semibold tabular-nums">
                                        {item.employee_count}
                                    </span>{' '}
                                    employees
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {item.pathway?.name ??
                                        'No pathway connected'}
                                </p>
                                <ChevronRight className="size-4 text-muted-foreground" />
                            </button>
                        ))}
                    </OrganizationListSection>
                )}

                {activeTab === 'locations' && (
                    <OrganizationListSection
                        title="Locations"
                        description="Organize employees by stores, facilities, offices, and regions."
                        buttonLabel="Create location"
                        onCreate={() => openCreateModal('location')}
                        empty={locations.length === 0}
                        emptyState={
                            <EmptyState
                                icon={MapPin}
                                title="Create your first location"
                                description="Locations make reporting and targeted training assignments easier."
                                action={
                                    <Button
                                        onClick={() =>
                                            openCreateModal('location')
                                        }
                                    >
                                        Create location
                                    </Button>
                                }
                            />
                        }
                    >
                        {locations.map((item) => (
                            <div
                                key={item.id}
                                className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                            >
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.description ??
                                            'No description added'}
                                    </p>
                                </div>
                                <p className="text-sm">
                                    <span className="font-semibold tabular-nums">
                                        {item.employee_count}
                                    </span>{' '}
                                    employees
                                </p>
                            </div>
                        ))}
                    </OrganizationListSection>
                )}
            </main>

            <Dialog
                open={employeeModalOpen}
                onOpenChange={setEmployeeModalOpen}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add employees</DialogTitle>
                        <DialogDescription>
                            Add one person, paste a list, or upload the employee
                            CSV template.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
                        {(
                            [
                                ['single', 'One employee'],
                                ['bulk', 'Paste a list'],
                                ['csv', 'Import CSV'],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setEmployeeModalMode(value)}
                                className={`min-h-9 rounded-md px-2 text-sm font-medium ${employeeModalMode === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {employeeModalMode === 'single' && (
                        <Form
                            action={`/organizations/${organization.id}/invitations`}
                            method="post"
                            options={{ preserveScroll: true }}
                            autoComplete="off"
                            className="space-y-4"
                            onSuccess={() => {
                                setEmployeeModalOpen(false);
                                toast.success(
                                    inviteRole === 'learner'
                                        ? 'Learner login created.'
                                        : `${inviteRole === 'organization_admin' ? 'Organization Admin' : 'Manager'} invitation sent.`,
                                );
                            }}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2 sm:col-span-2">
                                            <Label htmlFor="employee-name">
                                                Name
                                            </Label>
                                            <Input
                                                id="employee-name"
                                                name="name"
                                                placeholder="Jordan Lee"
                                            />
                                            <InputError message={errors.name} />
                                        </div>
                                        <div className="grid gap-2 sm:col-span-2">
                                            <Label htmlFor="employee-email">
                                                Company email
                                            </Label>
                                            <Input
                                                id="employee-email"
                                                name="email"
                                                type="email"
                                                autoComplete="off"
                                                required
                                                placeholder="jordan@company.com"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="employee-role">
                                                Role
                                            </Label>
                                            <select
                                                id="employee-role"
                                                name="organization_role"
                                                className={selectClass}
                                                value={inviteRole}
                                                onChange={(event) =>
                                                    setInviteRole(
                                                        event.target
                                                            .value as InviteRole,
                                                    )
                                                }
                                            >
                                                <option value="learner">
                                                    Learner
                                                </option>
                                                <option value="manager">
                                                    Manager
                                                </option>
                                                <option value="organization_admin">
                                                    Organization Admin
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
                                                <Label htmlFor="temporary-password">
                                                    Temporary password
                                                </Label>
                                                <Input
                                                    id="temporary-password"
                                                    name="temporary_password"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    minLength={8}
                                                    required
                                                />
                                                <InputError
                                                    message={
                                                        errors.temporary_password
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                                        {inviteRole === 'learner'
                                            ? 'The learner can sign in immediately and will be required to create a new password.'
                                            : `The ${inviteRole === 'organization_admin' ? 'organization admin' : 'manager'} receives a secure invitation link to create their account.`}
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}
                                        {inviteRole === 'learner'
                                            ? 'Create learner login'
                                            : `Send ${inviteRole === 'organization_admin' ? 'admin' : 'manager'} invitation`}
                                    </Button>
                                </>
                            )}
                        </Form>
                    )}

                    {employeeModalMode === 'bulk' && (
                        <Form
                            action={`/organizations/${organization.id}/users/bulk-invite`}
                            method="post"
                            options={{ preserveScroll: true }}
                            className="space-y-4"
                            onSuccess={() => {
                                setEmployeeModalOpen(false);
                                toast.success('Employee list processed.');
                            }}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="employees">
                                            Employee list
                                        </Label>
                                        <textarea
                                            id="employees"
                                            name="employees"
                                            required
                                            rows={10}
                                            className="rounded-md border bg-background p-3 font-mono text-sm"
                                            placeholder={
                                                'Mia Carter,mia@company.com,learner,TempPass123\nJordan Lee,jordan@company.com,manager\nAlex Smith,alex@company.com,organization_admin'
                                            }
                                        />
                                        <InputError
                                            message={errors.employees}
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        One employee per line: name, email,
                                        role, and temporary password for
                                        learners. Roles: organization_admin,
                                        manager, or learner.
                                    </p>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}Process
                                        employee list
                                    </Button>
                                </>
                            )}
                        </Form>
                    )}

                    {employeeModalMode === 'csv' && (
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Button asChild variant="outline">
                                    <a
                                        href={`/organizations/${organization.id}/users/import-template`}
                                    >
                                        <FileDown className="size-4" />
                                        Download blank template
                                    </a>
                                </Button>
                                <Button asChild variant="outline">
                                    <a
                                        href={`/organizations/${organization.id}/users/import-sample`}
                                    >
                                        <Download className="size-4" />
                                        Download sample
                                    </a>
                                </Button>
                            </div>
                            <Form
                                action={`/organizations/${organization.id}/users/import`}
                                method="post"
                                options={{ preserveScroll: true }}
                                className="space-y-4"
                                onSuccess={() => {
                                    setEmployeeModalOpen(false);
                                    toast.success('CSV import completed.');
                                }}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <label className="grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center hover:bg-muted/40">
                                            <span>
                                                <Upload className="mx-auto mb-3 size-6 text-muted-foreground" />
                                                <span className="block font-medium">
                                                    Choose an employee CSV
                                                </span>
                                                <span className="mt-1 block text-sm text-muted-foreground">
                                                    Use the template headers for
                                                    the cleanest import.
                                                </span>
                                            </span>
                                            <input
                                                type="file"
                                                name="csv_file"
                                                accept=".csv,text/csv"
                                                required
                                                className="sr-only"
                                            />
                                        </label>
                                        <InputError message={errors.csv_file} />
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}Import
                                            employees
                                        </Button>
                                    </>
                                )}
                            </Form>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{createConfig.title}</DialogTitle>
                        <DialogDescription>
                            {createConfig.description}
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action={`/organizations/${organization.id}/${createConfig.endpoint}`}
                        method="post"
                        options={{ preserveScroll: true }}
                        className="space-y-4"
                        onSuccess={() => {
                            setCreateModalOpen(false);
                            toast.success(
                                `${createConfig.title.replace('Create ', '')} created.`,
                            );
                        }}
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor={createConfig.field}>
                                        Name
                                    </Label>
                                    <Input
                                        id={createConfig.field}
                                        name={createConfig.field}
                                        required
                                        placeholder={createConfig.placeholder}
                                    />
                                    <InputError
                                        message={errors[createConfig.field]}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    {processing && <Spinner />}
                                    {createConfig.title}
                                </Button>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Edit {selectedIds.size} employees
                        </DialogTitle>
                        <DialogDescription>
                            Apply one organization change to every selected
                            employee.
                        </DialogDescription>
                    </DialogHeader>
                    <Form
                        action={`/organizations/${organization.id}/users/bulk`}
                        method="patch"
                        options={{ preserveScroll: true }}
                        className="space-y-4"
                        onSuccess={() => {
                            setBulkModalOpen(false);
                            setSelectedIds(new Set());
                            toast.success('Selected employees updated.');
                        }}
                    >
                        {({ processing, errors }) => (
                            <>
                                {[...selectedIds].map((id) => (
                                    <input
                                        key={id}
                                        type="hidden"
                                        name="user_ids[]"
                                        value={id}
                                    />
                                ))}
                                <div className="grid gap-2">
                                    <Label htmlFor="bulk-action">Change</Label>
                                    <select
                                        id="bulk-action"
                                        name="action"
                                        className={selectClass}
                                        value={bulkAction}
                                        onChange={(event) =>
                                            setBulkAction(
                                                event.target
                                                    .value as BulkAction,
                                            )
                                        }
                                    >
                                        <option value="set_job_title">
                                            Set job title
                                        </option>
                                        <option value="set_location">
                                            Set location
                                        </option>
                                        <option value="add_team">
                                            Add to team
                                        </option>
                                        <option value="set_account_status">
                                            Set account status
                                        </option>
                                    </select>
                                </div>
                                {bulkAction === 'set_job_title' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-job-title">
                                            Job title
                                        </Label>
                                        <select
                                            id="bulk-job-title"
                                            name="value_id"
                                            className={selectClass}
                                        >
                                            <option value="">
                                                No job title
                                            </option>
                                            {jobTitles.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {bulkAction === 'set_location' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-location">
                                            Location
                                        </Label>
                                        <select
                                            id="bulk-location"
                                            name="value_id"
                                            className={selectClass}
                                        >
                                            <option value="">
                                                No location
                                            </option>
                                            {locations.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {bulkAction === 'add_team' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-team">Team</Label>
                                        <select
                                            id="bulk-team"
                                            name="value_id"
                                            required
                                            className={selectClass}
                                        >
                                            <option value="">
                                                Choose a team
                                            </option>
                                            {teams.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {bulkAction === 'set_account_status' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="bulk-status">
                                            Account status
                                        </Label>
                                        <select
                                            id="bulk-status"
                                            name="account_status"
                                            className={selectClass}
                                        >
                                            <option value="active">
                                                Active
                                            </option>
                                            <option value="deactivated">
                                                Deactivated
                                            </option>
                                        </select>
                                        <p className="text-xs text-muted-foreground">
                                            Deactivation removes access but
                                            preserves all training records.
                                        </p>
                                    </div>
                                )}
                                <InputError
                                    message={
                                        errors.user_ids ??
                                        errors.value_id ??
                                        errors.account_status
                                    }
                                />
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={processing}
                                >
                                    {processing && <Spinner />}Apply change
                                </Button>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <EmployeeSheet
                organization={organization}
                user={selectedUser}
                teams={teams}
                jobTitles={jobTitles}
                locations={locations}
                roleOptions={roleOptions.filter((option) => option.value)}
                onClose={() => setSelectedUserId(null)}
                onDeactivate={handleDeactivate}
                onReactivate={handleReactivate}
            />

            <Sheet
                open={selectedJobTitle !== null}
                onOpenChange={(open) => !open && setSelectedJobTitleId(null)}
            >
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {selectedJobTitle && (
                        <>
                            <SheetHeader className="border-b p-6">
                                <SheetTitle className="text-xl">
                                    {selectedJobTitle.name}
                                </SheetTitle>
                                <SheetDescription>
                                    {selectedJobTitle.employee_count} employees
                                    currently use this title.
                                </SheetDescription>
                            </SheetHeader>
                            <div className="space-y-6 p-6">
                                <div className="rounded-xl border bg-muted/25 p-4">
                                    <p className="text-sm font-medium">
                                        Automated pathway
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Employees with this job title receive
                                        published courses from the connected
                                        pathway.
                                    </p>
                                </div>
                                <Form
                                    action={`/organizations/${organization.id}/job-titles/${selectedJobTitle.id}/pathway`}
                                    method="put"
                                    options={{ preserveScroll: true }}
                                    className="space-y-3"
                                    onSuccess={() =>
                                        toast.success(
                                            'Pathway connection updated.',
                                        )
                                    }
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="pathway_id">
                                                    Pathway
                                                </Label>
                                                <select
                                                    id="pathway_id"
                                                    name="pathway_id"
                                                    defaultValue={
                                                        selectedJobTitle.pathway_id ??
                                                        ''
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">
                                                        No automated pathway
                                                    </option>
                                                    {pathways.map((pathway) => (
                                                        <option
                                                            key={pathway.id}
                                                            value={pathway.id}
                                                        >
                                                            {pathway.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={errors.pathway_id}
                                                />
                                            </div>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                {processing && <Spinner />}Save
                                                pathway
                                            </Button>
                                        </>
                                    )}
                                </Form>
                                <div className="border-t pt-5">
                                    <p className="text-sm text-muted-foreground">
                                        Pathway content is managed with courses,
                                        not employee settings.
                                    </p>
                                    {selectedJobTitle.pathway && (
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="mt-3"
                                        >
                                            <Link
                                                href={`/organizations/${organization.id}/pathways/${selectedJobTitle.pathway.id}`}
                                            >
                                                Open{' '}
                                                {selectedJobTitle.pathway.name}
                                                <ArrowRight className="size-4" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}

function OrganizationListSection({
    title,
    description,
    buttonLabel,
    onCreate,
    empty,
    emptyState,
    children,
}: {
    title: string;
    description: string;
    buttonLabel: string;
    onCreate: () => void;
    empty: boolean;
    emptyState: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                <Button onClick={onCreate}>
                    <UserPlus className="size-4" />
                    {buttonLabel}
                </Button>
            </div>
            {empty ? emptyState : <div className="space-y-2">{children}</div>}
        </section>
    );
}

function EmployeeSheet({
    organization,
    user,
    teams,
    jobTitles,
    locations,
    roleOptions,
    onClose,
    onDeactivate,
    onReactivate,
}: {
    organization: Organization;
    user: UserRow | null;
    teams: Team[];
    jobTitles: JobTitle[];
    locations: Location[];
    roleOptions: Option[];
    onClose: () => void;
    onDeactivate: (user: UserRow) => void;
    onReactivate: (user: UserRow) => void;
}) {
    return (
        <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                {user && (
                    <>
                        <SheetHeader className="border-b p-6 pr-12">
                            <div className="flex items-center gap-4">
                                <EmployeeAvatar user={user} large />
                                <div className="min-w-0">
                                    <SheetTitle className="truncate text-xl">
                                        {user.name}
                                    </SheetTitle>
                                    <SheetDescription className="truncate">
                                        {user.email}
                                    </SheetDescription>
                                    <div className="mt-2 flex gap-2">
                                        <Badge
                                            variant={
                                                user.account_status === 'active'
                                                    ? 'secondary'
                                                    : 'destructive'
                                            }
                                        >
                                            {user.account_status_label}
                                        </Badge>
                                        {user.must_change_password && (
                                            <Badge variant="outline">
                                                Not activated
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SheetHeader>
                        <div className="space-y-6 p-6">
                            <section className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        Training summary
                                    </h3>
                                    <Badge
                                        variant={
                                            user.training_summary
                                                .overdue_courses > 0
                                                ? 'destructive'
                                                : 'outline'
                                        }
                                    >
                                        {user.training_status_label}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {[
                                        [
                                            'Assigned',
                                            user.training_summary
                                                .assigned_courses,
                                        ],
                                        [
                                            'Completed',
                                            user.training_summary
                                                .completed_courses,
                                        ],
                                        [
                                            'Overdue',
                                            user.training_summary
                                                .overdue_courses,
                                        ],
                                        [
                                            'Avg. score',
                                            user.training_summary
                                                .average_score_percent === null
                                                ? 'N/A'
                                                : `${user.training_summary.average_score_percent}%`,
                                        ],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="rounded-lg border p-3"
                                        >
                                            <p className="text-xs text-muted-foreground">
                                                {label}
                                            </p>
                                            <p className="mt-1 font-semibold tabular-nums">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Button asChild>
                                        <Link
                                            href={`/organizations/${organization.id}/courses`}
                                        >
                                            Assign training
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline">
                                        <Link
                                            href={`/organizations/${organization.id}/users/${user.id}/transcript`}
                                        >
                                            View transcript
                                        </Link>
                                    </Button>
                                </div>
                            </section>

                            <section className="space-y-3 border-t pt-5">
                                <h3 className="font-semibold">
                                    Role and account
                                </h3>
                                {user.is_current_user ? (
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                                        Your role is{' '}
                                        {user.organization_role_label}. Another
                                        organization admin must change your
                                        access.
                                    </div>
                                ) : (
                                    <Form
                                        action={`/organizations/${organization.id}/users/${user.id}/role`}
                                        method="patch"
                                        options={{ preserveScroll: true }}
                                        className="flex items-end gap-2"
                                        onSuccess={() =>
                                            toast.success(
                                                'Employee role updated.',
                                            )
                                        }
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <div className="grid flex-1 gap-2">
                                                    <Label
                                                        htmlFor={`role-${user.id}`}
                                                    >
                                                        Organization role
                                                    </Label>
                                                    <select
                                                        id={`role-${user.id}`}
                                                        name="organization_role"
                                                        defaultValue={
                                                            user.organization_role ??
                                                            ''
                                                        }
                                                        className={selectClass}
                                                    >
                                                        {roleOptions.map(
                                                            (option) => (
                                                                <option
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {
                                                                        option.label
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <InputError
                                                        message={
                                                            errors.organization_role
                                                        }
                                                    />
                                                </div>
                                                <Button
                                                    type="submit"
                                                    disabled={processing}
                                                >
                                                    {processing && <Spinner />}
                                                    Save
                                                </Button>
                                            </>
                                        )}
                                    </Form>
                                )}
                            </section>

                            <section className="space-y-3 border-t pt-5">
                                <h3 className="font-semibold">
                                    Organization details
                                </h3>
                                <Form
                                    action={`/organizations/${organization.id}/users/${user.id}/structure`}
                                    method="put"
                                    options={{ preserveScroll: true }}
                                    className="space-y-3"
                                    onSuccess={() =>
                                        toast.success(
                                            'Organization details updated.',
                                        )
                                    }
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label
                                                        htmlFor={`job-title-${user.id}`}
                                                    >
                                                        Job title
                                                    </Label>
                                                    <select
                                                        id={`job-title-${user.id}`}
                                                        name="job_title_id"
                                                        defaultValue={
                                                            user.job_title_id ??
                                                            ''
                                                        }
                                                        className={selectClass}
                                                    >
                                                        <option value="">
                                                            No job title
                                                        </option>
                                                        {jobTitles.map(
                                                            (item) => (
                                                                <option
                                                                    key={
                                                                        item.id
                                                                    }
                                                                    value={
                                                                        item.id
                                                                    }
                                                                >
                                                                    {item.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <InputError
                                                        message={
                                                            errors.job_title_id
                                                        }
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label
                                                        htmlFor={`location-${user.id}`}
                                                    >
                                                        Location
                                                    </Label>
                                                    <select
                                                        id={`location-${user.id}`}
                                                        name="location_id"
                                                        defaultValue={
                                                            user.location_id ??
                                                            ''
                                                        }
                                                        className={selectClass}
                                                    >
                                                        <option value="">
                                                            No location
                                                        </option>
                                                        {locations.map(
                                                            (item) => (
                                                                <option
                                                                    key={
                                                                        item.id
                                                                    }
                                                                    value={
                                                                        item.id
                                                                    }
                                                                >
                                                                    {item.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <InputError
                                                        message={
                                                            errors.location_id
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            {user.job_title?.pathway && (
                                                <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                                                    Connected pathway:{' '}
                                                    <span className="font-medium text-foreground">
                                                        {
                                                            user.job_title
                                                                .pathway.name
                                                        }
                                                    </span>
                                                </p>
                                            )}
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                disabled={processing}
                                            >
                                                {processing && <Spinner />}Save
                                                organization details
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </section>

                            <section className="space-y-3 border-t pt-5">
                                <div>
                                    <h3 className="font-semibold">
                                        Team access
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {user.team_assignment_mode === 'manager'
                                            ? 'Managers can view and assign training only for selected teams.'
                                            : user.team_assignment_mode ===
                                                'learner'
                                              ? 'Learners belong to the selected teams.'
                                              : 'Organization admins have organization-wide access.'}
                                    </p>
                                </div>
                                {user.team_assignment_mode !== 'admin' && (
                                    <Form
                                        key={`${user.id}-${user.organization_role}`}
                                        action={`/organizations/${organization.id}/users/${user.id}/teams`}
                                        method="put"
                                        options={{ preserveScroll: true }}
                                        className="space-y-3"
                                        onSuccess={() =>
                                            toast.success(
                                                'Team access updated.',
                                            )
                                        }
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {teams.map((team) => (
                                                        <label
                                                            key={team.id}
                                                            className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                name="team_ids[]"
                                                                value={team.id}
                                                                defaultChecked={user.assigned_team_ids.includes(
                                                                    team.id,
                                                                )}
                                                                className="size-4 rounded border-input"
                                                            />
                                                            {team.name}
                                                        </label>
                                                    ))}
                                                </div>
                                                {teams.length === 0 && (
                                                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                                        Create a team from the
                                                        Teams tab before
                                                        assigning access.
                                                    </p>
                                                )}
                                                <InputError
                                                    message={errors.team_ids}
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="outline"
                                                    disabled={processing}
                                                >
                                                    {processing && <Spinner />}
                                                    Save team access
                                                </Button>
                                            </>
                                        )}
                                    </Form>
                                )}
                            </section>

                            <section className="space-y-3 border-t pt-5">
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Link
                                        href={`/organizations/${organization.id}/users/${user.id}`}
                                    >
                                        Open full employee profile
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                                {!user.is_current_user &&
                                    user.account_status === 'active' && (
                                        <Button
                                            variant="ghost"
                                            className="w-full text-destructive hover:text-destructive"
                                            onClick={() => onDeactivate(user)}
                                        >
                                            <UserX className="size-4" />
                                            Deactivate employee
                                        </Button>
                                    )}
                                {user.account_status === 'deactivated' && (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => onReactivate(user)}
                                    >
                                        <CheckCircle2 className="size-4" />
                                        Reactivate employee
                                    </Button>
                                )}
                                <p className="text-center text-xs text-muted-foreground">
                                    Deactivation preserves assignments,
                                    transcripts, and training history.
                                </p>
                            </section>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
