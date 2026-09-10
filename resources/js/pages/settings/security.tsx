import { Form, Head } from '@inertiajs/react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/security';

type Props = {
    passwordRules: string;
    mustChangePassword?: boolean;
};

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const mustChangePassword = props.mustChangePassword ?? false;

    return (
        <>
            <Head
                title={
                    mustChangePassword
                        ? 'Change temporary password'
                        : 'Security settings'
                }
            />

            <h1 className="sr-only">
                {mustChangePassword
                    ? 'Change temporary password'
                    : 'Security settings'}
            </h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={
                        mustChangePassword
                            ? 'Change your temporary password'
                            : 'Update password'
                    }
                    description={
                        mustChangePassword
                            ? 'You were given a temporary password. Change it before you continue.'
                            : 'Ensure your account is using a long, random password to stay secure.'
                    }
                />

                {mustChangePassword && (
                    <Card className="border-amber-500/40 bg-amber-500/5">
                        <CardContent className="pt-6 text-sm text-amber-950 dark:text-amber-100">
                            This account is locked to a temporary password.
                            Update it now to unlock the rest of the app.
                        </CardContent>
                    </Card>
                )}

                <Form
                    {...SecurityController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">
                                    {mustChangePassword
                                        ? 'Temporary password'
                                        : 'Current password'}
                                </Label>

                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    className="mt-1 block w-full"
                                    autoComplete="current-password"
                                    placeholder={
                                        mustChangePassword
                                            ? 'Temporary password'
                                            : 'Current password'
                                    }
                                />

                                <InputError message={errors.current_password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">New password</Label>

                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="New password"
                                    passwordrules={props.passwordRules}
                                />

                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Confirm password
                                </Label>

                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    className="mt-1 block w-full"
                                    autoComplete="new-password"
                                    placeholder="Confirm password"
                                    passwordrules={props.passwordRules}
                                />

                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-password-button"
                                >
                                    {mustChangePassword
                                        ? 'Save and continue'
                                        : 'Save'}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Security settings',
            href: edit(),
        },
    ],
};
