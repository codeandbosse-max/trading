'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Webhook,
  Copy,
  RefreshCw,
  Check,
  Code2,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowDownToLine,
  Send,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';
import { api, API_URL } from '@/lib/api';
import { signPayload } from '@/lib/hmac';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const signalStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  accepte: { label: 'Accepté', color: 'text-success', bg: 'bg-success/10' },
  rejete: { label: 'Rejeté', color: 'text-destructive', bg: 'bg-destructive/10' },
  duplique: { label: 'Dupliqué', color: 'text-warning', bg: 'bg-warning/10' },
  expire: { label: 'Expiré', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const examplePayload = `{
  "signalId": "tv-20260825-000123",
  "ticker": "AAPL",
  "action": "buy",
  "quantity": 10,
  "price": 212.4,
  "orderType": "market",
  "source": "TradingView",
  "timestamp": "2026-08-25T13:20:00Z"
}`;

const exampleResponse = `{
  "accepted": true,
  "signalId": "tv-20260825-000123",
  "strategy": "MACD Swing"
}`;

export default function WebhooksPage() {
  const { state, regenerateSecret, refresh } = useStore();
  const { strategies, signalLogs } = state;
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(API_URL), []);

  const copy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSecret = (id: string) =>
    setShowSecret((p) => ({ ...p, [id]: !p[id] }));

  const sendTestSignal = async (strategyId: string) => {
    const strategy = strategies.find((s) => s.id === strategyId);
    if (!strategy) return;
    setSending(strategyId);
    try {
      const body = JSON.stringify({
        signalId: `test-${Date.now().toString(36)}`,
        ticker: strategy.whitelist[0] ?? 'AAPL',
        action: strategy.allowedActions[0] ?? 'buy',
        price: 100,
        source: 'Test manuel',
      });
      const signature = await signPayload(strategy.webhookSecret, body);
      const res = await api.sendSignal(strategy.webhookId, signature, body);
      if (res.ok) {
        const data = await res.json();
        if (data.accepted) {
          toast.success('Signal de test accepté', {
            description: `${data.ordersCreated} ordre(s) créé(s).`,
          });
        } else {
          toast.warning('Signal reçu mais non exécuté', { description: data.reason });
        }
        await refresh();
      } else {
        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        toast.error('Signal refusé', { description: data.error });
      }
    } catch {
      toast.error('Impossible de joindre l’API d’ingestion.');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          URLs et secrets de réception, exemples JSON et journal des appels entrants.
        </p>
      </div>

      {/* Webhook endpoints */}
      <div className="space-y-4">
        {strategies.map((s) => {
          const webhookUrl = `${origin}/api/webhook/${s.webhookId}`;
          const secretVisible = showSecret[s.id];
          return (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Webhook className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {s.webhookId} · {s.signalsToday} appels aujourd’hui
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendTestSignal(s.id)}
                    disabled={sending === s.id}
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {sending === s.id ? 'Envoi…' : 'Signal de test'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      regenerateSecret(s.id);
                      toast.success('Secret régénéré', { description: s.name });
                    }}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Régénérer le secret
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* URL */}
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    URL de réception
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <code className="flex-1 truncate font-mono text-xs">{webhookUrl}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(webhookUrl, `url-${s.id}`)}
                    >
                      {copied === `url-${s.id}` ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Secret */}
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Secret de signature
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <code className="flex-1 truncate font-mono text-xs">
                      {secretVisible ? s.webhookSecret : '•'.repeat(24)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => toggleSecret(s.id)}
                      aria-label="Afficher le secret"
                    >
                      {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(s.webhookSecret, `secret-${s.id}`)}
                      aria-label="Copier le secret"
                    >
                      {copied === `secret-${s.id}` ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* JSON examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4 text-accent" />
            Référence du format JSON
          </CardTitle>
          <CardDescription>
            Format minimal et étendu attendu par la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="request">
            <TabsList>
              <TabsTrigger value="request">Requête entrante</TabsTrigger>
              <TabsTrigger value="response">Réponse</TabsTrigger>
              <TabsTrigger value="minimal">Format minimal</TabsTrigger>
            </TabsList>
            <TabsContent value="request">
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed scrollbar-thin">
                {examplePayload}
              </pre>
            </TabsContent>
            <TabsContent value="response">
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed scrollbar-thin">
                {exampleResponse}
              </pre>
            </TabsContent>
            <TabsContent value="minimal">
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed scrollbar-thin">
{`{
  "ticker": "AAPL",
  "action": "buy"
}`}
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                Les champs <code className="font-mono">ticker</code> et <code className="font-mono">action</code> sont le minimum requis.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Signal log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Journal des appels
          </CardTitle>
          <CardDescription>
            Historique immuable des signaux reçus, acceptés et rejetés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {signalLogs.map((log) => {
              const st = signalStatusMap[log.status];
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50"
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', st.bg)}>
                    <ArrowDownToLine className={cn('h-4 w-4', st.color)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{log.ticker}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">· {log.strategyName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.signalId} · {log.source} · {timeAgo(log.receivedAt)}
                    </p>
                    {log.reason && (
                      <p className={cn('mt-0.5 text-xs', st.color)}>{log.reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn('text-xs font-medium', st.color)}>{st.label}</span>
                    {log.subscriptionsTargeted > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {log.subscriptionsTargeted} souscriptions
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
