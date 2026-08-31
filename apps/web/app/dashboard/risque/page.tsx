'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Shield,
  TrendingDown,
  Clock,
  DollarSign,
  Percent,
  Activity,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const ruleIcons: Record<string, React.ElementType> = {
  'risk-001': DollarSign,
  'risk-002': Activity,
  'risk-003': Percent,
  'risk-004': Shield,
  'risk-005': Activity,
  'risk-006': TrendingDown,
  'risk-007': TrendingDown,
  'risk-008': ShieldAlert,
  'risk-009': DollarSign,
  'risk-010': Clock,
};

export default function RiskPage() {
  const { state, setKillSwitch, updateRiskRule } = useStore();
  const killSwitch = state.killSwitch;
  const rules = state.riskRules;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const triggeredCount = rules.filter((r) => r.triggered).length;
  const dailyPnl = state.positions.reduce((sum, p) => sum + p.pnl, 0);

  const toggleRule = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    updateRiskRule({ ...rule, enabled: !rule.enabled });
  };

  const startEdit = (id: string, value: string) => {
    setEditingId(id);
    setDraftValue(value);
  };

  const commitEdit = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (rule && draftValue.trim().length > 0) {
      updateRiskRule({ ...rule, value: draftValue.trim() });
      toast.success('Seuil mis à jour', { description: rule.label });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestion du risque</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Règles de sécurité, seuils de protection et coupe-circuit global.
        </p>
      </div>

      {/* Kill switch */}
      <Card
        className={cn(
          'border-2 transition-colors',
          killSwitch ? 'border-destructive bg-destructive/5' : 'border-success/30 bg-success/5'
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-xl',
                  killSwitch ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
                )}
              >
                <Zap className="h-7 w-7" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Coupe-circuit global</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Suspend immédiatement tout envoi d’ordre réel sur l’ensemble des connexions. Les signaux continuent d’être reçus et journalisés, mais aucun ordre n’est transmis.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant={killSwitch ? 'destructive' : 'default'}
                    className={cn('text-xs', !killSwitch && 'bg-success text-success-foreground')}
                  >
                    {killSwitch ? 'COUPE-CIRCUIT ACTIF' : 'Système opérationnel'}
                  </Badge>
                  {killSwitch && (
                    <span className="text-xs text-destructive">
                      Aucun ordre réel ne sera envoyé.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={killSwitch ? 'outline' : 'destructive'}
                  size="lg"
                  className="shrink-0"
                >
                  <Zap className="mr-2 h-4 w-4" fill="currentColor" />
                  {killSwitch ? 'Désactiver le coupe-circuit' : 'Activer le coupe-circuit'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {killSwitch ? 'Désactiver le coupe-circuit ?' : 'Activer le coupe-circuit ?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {killSwitch
                      ? 'Les ordres réels reprendront. Veuillez vérifier l’état de vos connexions avant de continuer.'
                      : 'Cela suspendra immédiatement tout envoi d’ordre réel. Les signaux seront toujours reçus et journalisés, mais aucun ordre ne sera transmis aux courtiers.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => setKillSwitch(!killSwitch)}
                    className={cn(!killSwitch && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                  >                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Risk summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Règles actives</p>
                <p className="mt-1 font-mono-tnum text-2xl font-semibold">
                  {rules.filter((r) => r.enabled).length}/{rules.length}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Règles déclenchées</p>
                <p className="mt-1 font-mono-tnum text-2xl font-semibold">{triggeredCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">P&L journalier</p>
                <p
                  className={cn(
                    'mt-1 font-mono-tnum text-2xl font-semibold',
                    dailyPnl >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {dailyPnl >= 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(dailyPnl))}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-accent" />
            Règles de risque configurables
          </CardTitle>
          <CardDescription>
            Chaque règle est vérifiée avant la transmission d’un ordre réel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {rules.map((r) => {
            const Icon = ruleIcons[r.id] ?? Shield;
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 rounded-lg px-3 py-3 hover:bg-muted/40"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    r.triggered ? 'bg-warning/15 text-warning' : r.enabled ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{r.label}</p>
                    {r.triggered && (
                      <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Déclenchée
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                <div className="hidden items-center gap-1 text-right sm:flex">
                  {editingId === r.id ? (
                    <>
                      <Input
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(r.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-8 w-32 text-right"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success"
                        onClick={() => commitEdit(r.id)}
                        aria-label="Valider"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-mono-tnum text-sm font-medium">{r.value}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => startEdit(r.id, r.value)}
                        aria-label={`Modifier ${r.label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={() => toggleRule(r.id)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">Avertissement sur les risques</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              L’automatisation ne remplace pas la surveillance de l’utilisateur. Le trading automatisé comporte des risques significatifs et aucune garantie de performance ne peut être donnée. Le mode simulation doit être privilégié avant toute activation en réel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
