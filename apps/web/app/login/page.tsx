'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Zap, Loader2 } from 'lucide-react';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type LoginPayload,
  type RegisterInput,
  type RegisterPayload,
} from '@trading/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { Separator } from '@/components/ui/separator';
import { api, ApiError, API_URL } from '@/lib/api';

function GoogleMark() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.17-2 3.44-4.95 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.540-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.68a6.9 6.9 0 0 1 0-4.36V7.34H1.7a11.5 11.5 0 0 0 0 10.32l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.24 15.1 0 12 0 7.4 0 3.44 2.64 1.7 6.48l3.85 2.98C6.46 6.77 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Le service d’authentification est injoignable.';
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<{
    bootstrap: boolean;
    signupCodeRequired: boolean;
    googleEnabled: boolean;
  } | null>(null);
  const [tab, setTab] = useState('connexion');
  const [signupCode, setSignupCode] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) toast.error('Connexion Google refusée', { description: error });
  }, [searchParams]);

  useEffect(() => {
    api
      .authStatus()
      .then((s) => {
        setStatus(s);
        if (s.bootstrap) setTab('inscription');
      })
      .catch(() => setStatus({ bootstrap: false, signupCodeRequired: false, googleEnabled: false }));

    // Already signed in: skip the form.
    api.me().then(() => router.replace('/dashboard')).catch(() => undefined);
  }, [router]);

  const googleHref = signupCode
    ? `${API_URL}/api/auth/google?signupCode=${encodeURIComponent(signupCode)}`
    : `${API_URL}/api/auth/google`;

  const login = useForm<LoginInput, unknown, LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const register = useForm<RegisterInput, unknown, RegisterPayload>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', name: '', password: '', signupCode: '' },
  });

  const onLogin = async (values: LoginPayload) => {
    try {
      const user = await api.login(values);
      toast.success(`Bienvenue, ${user.name}`);
      router.replace('/dashboard');
    } catch (error) {
      toast.error('Connexion refusée', { description: errorMessage(error) });
    }
  };

  const onRegister = async (values: RegisterPayload) => {
    try {
      const user = await api.register(values);
      toast.success('Compte créé', {
        description: user.role === 'admin' ? 'Vous êtes administrateur.' : undefined,
      });
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        const nextStatus = await api.authStatus().catch(() => null);
        if (nextStatus) setStatus(nextStatus);
      }
      toast.error('Inscription refusée', { description: errorMessage(error) });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Zap className="h-6 w-6" fill="currentColor" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">SignalDesk</h1>
          <p className="text-sm text-muted-foreground">Automatisation de trading par webhooks</p>
        </div>

        {status?.bootstrap && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-center text-xs text-muted-foreground">
            Aucun compte n’existe encore. Le premier compte créé sera administrateur.
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            {status?.googleEnabled && (
              <div className="mb-4 space-y-3">
                <Button variant="outline" className="w-full" asChild>
                  <a href={googleHref}>
                    <GoogleMark />
                    Continuer avec Google
                  </a>
                </Button>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-[11px] uppercase text-muted-foreground">ou</span>
                  <Separator className="flex-1" />
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="connexion">Connexion</TabsTrigger>
                <TabsTrigger value="inscription">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="connexion" className="pt-4">
                <form onSubmit={login.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Adresse e-mail</Label>
                    <Input id="login-email" type="email" autoComplete="email" {...login.register('email')} />
                    {login.formState.errors.email && (
                      <p className="text-xs text-destructive">{login.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      {...login.register('password')}
                    />
                    {login.formState.errors.password && (
                      <p className="text-xs text-destructive">
                        {login.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={login.formState.isSubmitting}>
                    {login.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="inscription" className="pt-4">
                <form onSubmit={register.handleSubmit(onRegister)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nom</Label>
                    <Input id="register-name" autoComplete="name" {...register.register('name')} />
                    {register.formState.errors.name && (
                      <p className="text-xs text-destructive">{register.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Adresse e-mail</Label>
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      {...register.register('email')}
                    />
                    {register.formState.errors.email && (
                      <p className="text-xs text-destructive">
                        {register.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Mot de passe</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      {...register.register('password')}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      12 caractères minimum, avec majuscule, minuscule et chiffre.
                    </p>
                    {register.formState.errors.password && (
                      <p className="text-xs text-destructive">
                        {register.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  {status && !status.bootstrap && (
                    <div className="space-y-2">
                      <Label htmlFor="register-code">Code d’inscription</Label>
                      <Input
                        id="register-code"
                        {...register.register('signupCode')}
                        onChange={(e) => {
                          register.setValue('signupCode', e.target.value);
                          setSignupCode(e.target.value);
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Fourni par un administrateur. Requis aussi pour créer un compte via Google.
                      </p>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={register.formState.isSubmitting}>
                    {register.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Créer mon compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}
