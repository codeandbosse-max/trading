'use client';

import Link from 'next/link';
import {
  Zap,
  Webhook,
  Shield,
  Radio,
  Layers,
  Activity,
  TrendingUp,
  ArrowRight,
  Check,
  Plug,
  Bell,
  Lock,
  Eye,
  Code2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Webhook,
    title: 'Réception par webhooks',
    description: 'Recevez des signaux de TradingView, TrendSpider ou votre code personnalisé via une URL HTTPS unique avec secret et signature HMAC.',
  },
  {
    icon: Layers,
    title: 'Routage multi-comptes',
    description: 'Un signal peut générer plusieurs ordres, un par souscription, avec un sizing et des paramètres de risque indépendants pour chaque compte.',
  },
  {
    icon: Shield,
    title: 'Contrôle du risque',
    description: 'Montant max, exposition, pertes journalières, plage horaire, stop-loss obligatoire et coupe-circuit global pour suspendre tout envoi réel.',
  },
  {
    icon: Plug,
    title: 'Adaptateurs broker',
    description: 'Couche d’abstraction isolant chaque courtier. Ajoutez Alpaca, Interactive Brokers, Binance ou prop firms sans toucher au moteur central.',
  },
  {
    icon: Activity,
    title: 'Traçabilité complète',
    description: 'Cycle de vie explicite des ordres, journal d’audit append-only et historique immuable des signaux reçus et rejetés.',
  },
  {
    icon: Bell,
    title: 'Notifications multi-canaux',
    description: 'Email, push, Slack, Discord ou webhook sortant. Définissez la gravité minimale et les canaux par type d’événement.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Connectez vos comptes',
    description: 'Ajoutez vos courtiers, exchanges ou prop firms. Testez la connectivité et choisissez l’environnement : simulation, démonstration ou réel.',
  },
  {
    num: '02',
    title: 'Créez une stratégie',
    description: 'Définissez les règles : classe d’actifs, listes blanche/noire, actions autorisées, paramètres de sécurité. Récupérez votre URL de webhook.',
  },
  {
    num: '03',
    title: 'Souscrivez vos comptes',
    description: 'Associez la stratégie à un ou plusieurs comptes. Configurez le mode d’exécution et le sizing propres à chaque souscription.',
  },
  {
    num: '04',
    title: 'Envoyez vos signaux',
    description: 'Configurez TradingView ou votre outil pour envoyer un POST JSON vers votre webhook. La plateforme s’occupe du reste.',
  },
];

const codeExample = `{
  "signal_id": "tv-20260825-000123",
  "ticker": "AAPL",
  "action": "buy",
  "quantity": 10,
  "order_type": "market",
  "stop_loss": 210.50,
  "take_profit": 225.00,
  "timestamp": "2026-08-25T13:20:00Z"
}`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Zap className="h-5 w-5" fill="currentColor" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SignalDesk</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#fonctionnalites" className="text-sm text-muted-foreground hover:text-foreground">Fonctionnalités</Link>
            <Link href="#fonctionnement" className="text-sm text-muted-foreground hover:text-foreground">Fonctionnement</Link>
            <Link href="#securite" className="text-sm text-muted-foreground hover:text-foreground">Sécurité</Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Connexion</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard">
                Accéder au tableau de bord
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 border-accent/30 text-accent">
              <span className="relative mr-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Plateforme d’automatisation de trading
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Reliez vos signaux à vos{' '}
              <span className="text-accent">comptes de courtage</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Recevez des signaux de TradingView, TrendSpider ou votre code personnalisé par webhook. Appliquez vos règles de stratégie et de risque, puis transmettez automatiquement les ordres à un ou plusieurs comptes connectés.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/dashboard">
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#fonctionnement">
                  Voir le fonctionnement
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Mode simulation disponible · Aucune carte bancaire requise
            </p>
          </div>

          {/* Dashboard preview */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="rounded-xl border border-border bg-card p-2 shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                <span className="h-3 w-3 rounded-full bg-destructive/60" />
                <span className="h-3 w-3 rounded-full bg-warning/60" />
                <span className="h-3 w-3 rounded-full bg-success/60" />
                <span className="ml-3 text-xs text-muted-foreground">signdesk.io/dashboard</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <Card className="sm:col-span-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase text-muted-foreground">Signaux aujourd’hui</p>
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <p className="mt-2 font-mono-tnum text-3xl font-bold">19</p>
                    <div className="mt-4 flex h-20 items-end gap-1.5">
                      {[40, 65, 30, 80, 55, 90, 45, 70, 60, 85, 50, 75].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-accent/20"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase text-muted-foreground">Taux de réussite</p>
                    <p className="mt-2 font-mono-tnum text-3xl font-bold text-success">78,9%</p>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: 'Exécutés', pct: '64%', color: 'bg-success' },
                        { label: 'Soumis', pct: '14%', color: 'bg-chart-5' },
                        { label: 'En attente', pct: '11%', color: 'bg-warning' },
                        { label: 'Rejetés', pct: '7%', color: 'bg-destructive' },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', r.color)} />
                          <span className="text-xs text-muted-foreground">{r.label}</span>
                          <span className="ml-auto text-xs font-medium">{r.pct}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Une couche d’orchestration pour vos signaux
            </h2>
            <p className="mt-4 text-muted-foreground">
              La plateforme reçoit un signal externe, applique vos contrôles de stratégie et de risque, puis le convertit en ordre exécutable sur un ou plusieurs comptes connectés.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="transition-all hover:border-accent/30 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="fonctionnement" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Comment ça marche
            </h2>
            <p className="mt-4 text-muted-foreground">
              De la connexion du broker à l’exécution de l’ordre en quatre étapes.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                <Card className="h-full">
                  <CardContent className="p-6">
                    <span className="font-mono text-3xl font-bold text-accent/30">{s.num}</span>
                    <h3 className="mt-3 font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                  </CardContent>
                </Card>
                {i < steps.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-muted-foreground lg:block" />
                )}
              </div>
            ))}
          </div>

          {/* Code example */}
          <div className="mx-auto mt-16 max-w-3xl">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold">Exemple de signal JSON</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Le minimum requis est un ticker et une action. Tous les autres champs sont optionnels.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed scrollbar-thin">
                  {codeExample}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="securite" className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Sécurité et conformité par défaut
              </h2>
              <p className="mt-4 text-muted-foreground">
                Vos identifiants broker sont chiffrés au repos. L’authentification multifacteur protège votre compte. Le journal d’audit est inviolable.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Lock, text: 'Chiffrement TLS pour tous les échanges et chiffrement au repos des secrets' },
                  { icon: Shield, text: 'Authentification multifacteur TOTP et hachage Argon2id des mots de passe' },
                  { icon: Eye, text: 'Journal d’audit append-only et séparation stricte test / réel' },
                  { icon: Zap, text: 'Coupe-circuit global accessible depuis le tableau de bord' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <p className="pt-1.5 text-sm">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/15 text-warning">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Avertissement sur les risques</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  L’automatisation ne remplace pas la surveillance de l’utilisateur. Le trading automatisé comporte des risques significatifs et aucune garantie de performance ne peut être donnée. Le mode simulation doit être privilégié avant toute activation en réel.
                </p>
                <Separator className="my-4" />
                <p className="text-sm font-medium">
                  Nous vous encourageons à tester vos stratégies en paper trading avant de risquer du capital réel.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-accent/5 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Prêt à automatiser vos ordres ?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Connectez votre premier broker en simulation, créez une stratégie et recevez votre premier signal en quelques minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Accéder au tableau de bord
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#fonctionnalites">
                Explorer les fonctionnalités
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Zap className="h-4 w-4" fill="currentColor" />
              </div>
              <span className="font-semibold">SignalDesk</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 SignalDesk. Plateforme d’automatisation de trading par webhooks.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="#" className="hover:text-foreground">Documentation</Link>
              <Link href="#" className="hover:text-foreground">Confidentialité</Link>
              <Link href="#" className="hover:text-foreground">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
