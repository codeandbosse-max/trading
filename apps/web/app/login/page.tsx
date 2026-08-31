'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { api, ApiError } from '@/lib/api';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Le service d’authentification est injoignable.';
}

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<{ bootstrap: boolean; signupCodeRequired: boolean } | null>(
    null
  );
  const [tab, setTab] = useState('connexion');

  useEffect(() => {
    api
      .authStatus()
      .then((s) => {
        setStatus(s);
        if (s.bootstrap) setTab('inscription');
      })
      .catch(() => setStatus({ bootstrap: false, signupCodeRequired: false }));

    // Already signed in: skip the form.
    api.me().then(() => router.replace('/dashboard')).catch(() => undefined);
  }, [router]);

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
                      <Input id="register-code" {...register.register('signupCode')} />
                      <p className="text-[11px] text-muted-foreground">
                        Fourni par un administrateur.
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
