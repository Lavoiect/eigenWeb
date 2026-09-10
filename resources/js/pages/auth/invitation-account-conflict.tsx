import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeft, LogOut, Mail, UserRoundCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { dashboard } from '@/routes';

type Props = {
    organization: {
        name: string;
    };
    invitation: {
        email: string;
        role_label: string;
        switch_url: string;
    };
    currentUser: {
        name: string;
        email: string;
    };
};

export default function InvitationAccountConflict({
    organization,
    invitation,
    currentUser,
}: Props) {
    return (
        <>
            <Head title="Switch accounts to continue" />

            <div className="space-y-6">
                <div className="rounded-xl border bg-muted/35 p-4">
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                            <Mail className="size-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">
                                Invitation for {invitation.email}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Join {organization.name} as{' '}
                                {invitation.role_label}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <UserRoundCheck className="mt-0.5 size-4 shrink-0" />
                    <p>
                        You are currently signed in as{' '}
                        <strong className="font-medium text-foreground">
                            {currentUser.name} ({currentUser.email})
                        </strong>
                        . Sign out to create the invited account instead.
                    </p>
                </div>

                <Form action={invitation.switch_url} method="post">
                    {({ processing }) => (
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                        >
                            {processing ? <Spinner /> : <LogOut />}
                            Sign out and continue invitation
                        </Button>
                    )}
                </Form>

                <Button asChild variant="ghost" className="w-full">
                    <Link href={dashboard()}>
                        <ArrowLeft />
                        Stay signed in and return to dashboard
                    </Link>
                </Button>
            </div>
        </>
    );
}

InvitationAccountConflict.layout = {
    title: 'This invitation is for another account',
    description:
        'Switch accounts safely to finish accepting the invitation.',
};
