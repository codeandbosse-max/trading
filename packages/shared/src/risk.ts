import type {
  Connection,
  IncomingSignal,
  Position,
  RiskRule,
  SignalAction,
  Strategy,
  Subscription,
} from './types';

export interface RiskContext {
  killSwitch: boolean;
  riskRules: RiskRule[];
  connections: Connection[];
  positions: Position[];
  /** Orders received since the start of the current day. */
  ordersToday: number;
  /** Realised P&L since the start of the current day. */
  realizedPnlToday: number;
  /** Losing trades in a row, most recent first. */
  consecutiveLosses: number;
  now: Date;
  timeZone: string;
}

export interface RiskDecision {
  allowed: boolean;
  reason: string | null;
  /** Set when a rule downgrades an automatic order to manual approval. */
  requireManualValidation: boolean;
}

const allow = (requireManualValidation = false): RiskDecision => ({
  allowed: true,
  reason: null,
  requireManualValidation,
});

const deny = (reason: string): RiskDecision => ({
  allowed: false,
  reason,
  requireManualValidation: false,
});

export const actionToSide: Record<SignalAction, 'achat' | 'vente'> = {
  buy: 'achat',
  cover: 'achat',
  sell: 'vente',
  short: 'vente',
  exit: 'vente',
  reverse: 'achat',
};

function activeRule(rules: RiskRule[], id: string): RiskRule | null {
  const found = rules.find((r) => r.id === id);
  return found && found.enabled ? found : null;
}

/** Numeric portion of a risk rule value such as "5 000 USD" or "3 %". */
export function ruleNumber(rules: RiskRule[], id: string): number | null {
  const found = activeRule(rules, id);
  if (!found) return null;
  const digits = found.value.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads "09:30–16:00" from a rule value; the separator may be – — or -. */
export function ruleTimeWindow(
  rules: RiskRule[],
  id: string
): { startMinutes: number; endMinutes: number } | null {
  const found = activeRule(rules, id);
  if (!found) return null;
  const match = found.value.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startMinutes: Number(match[1]) * 60 + Number(match[2]),
    endMinutes: Number(match[3]) * 60 + Number(match[4]),
  };
}

export function minutesInTimeZone(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return (hour % 24) * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

export function sizeOrder(
  subscription: Subscription,
  connection: Connection,
  price: number,
  signalQty?: number
): number {
  switch (subscription.sizingMethod) {
    case 'quantite_fixe':
      return subscription.sizingValue;
    case 'taille_du_signal':
      return signalQty ?? subscription.sizingValue;
    case 'pourcentage_capital':
    case 'risque_par_trade':
      return price > 0
        ? Math.max(1, Math.floor((connection.equity * (subscription.sizingValue / 100)) / price))
        : 0;
    case 'montant_monetaire':
      return price > 0 ? Math.max(1, Math.floor(subscription.sizingValue / price)) : 0;
    default:
      return subscription.sizingValue;
  }
}

export function evaluateRisk(
  ctx: RiskContext,
  strategy: Strategy,
  subscription: Subscription,
  signal: IncomingSignal,
  quantity: number,
  price: number
): RiskDecision {
  if (ctx.killSwitch) {
    return deny('Coupe-circuit actif : toute exécution est bloquée.');
  }
  if (strategy.status !== 'active') {
    return deny(`Stratégie ${strategy.status}, signal ignoré.`);
  }
  if (!subscription.enabled) {
    return deny('Abonnement désactivé.');
  }
  if (!strategy.allowedActions.includes(signal.action)) {
    return deny(`Action "${signal.action}" non autorisée par la stratégie.`);
  }

  const ticker = subscription.tickerOverride ?? signal.ticker;
  if (strategy.whitelist.length > 0 && !strategy.whitelist.includes(ticker)) {
    return deny(`${ticker} absent de la liste blanche.`);
  }
  if (strategy.blacklist.includes(ticker)) {
    return deny(`${ticker} figure sur la liste noire.`);
  }
  if (signal.action === 'short' && !subscription.allowShort) {
    return deny('Vente à découvert interdite sur cet abonnement.');
  }

  const emittedAt = signal.emittedAt ?? signal.receivedAt;
  const ageSec = (ctx.now.getTime() - new Date(emittedAt).getTime()) / 1000;
  if (ageSec > strategy.maxSignalDelaySec) {
    return deny(`Signal expiré (${Math.round(ageSec)}s > ${strategy.maxSignalDelaySec}s).`);
  }

  if (quantity <= 0) {
    return deny('Quantité calculée nulle.');
  }
  if (quantity > strategy.maxVolume) {
    return deny(`Volume ${quantity} supérieur au maximum ${strategy.maxVolume}.`);
  }
  if (quantity > subscription.maxOrderSize) {
    return deny(`Taille d'ordre ${quantity} supérieure au plafond ${subscription.maxOrderSize}.`);
  }

  const notional = quantity * price;
  if (notional > subscription.maxExposure) {
    return deny(`Exposition ${notional.toFixed(0)} au-dessus du plafond.`);
  }

  const connection = ctx.connections.find((c) => c.id === subscription.connectionId);
  if (!connection) return deny('Connexion introuvable.');
  if (connection.status !== 'actif') {
    return deny(`Connexion ${connection.name} indisponible.`);
  }

  // risk-010 — trading hours.
  const window = ruleTimeWindow(ctx.riskRules, 'risk-010');
  if (window) {
    const minutes = minutesInTimeZone(ctx.now, ctx.timeZone);
    const inside =
      window.startMinutes <= window.endMinutes
        ? minutes >= window.startMinutes && minutes <= window.endMinutes
        : minutes >= window.startMinutes || minutes <= window.endMinutes;
    if (!inside) {
      return deny('Hors de la plage horaire autorisée.');
    }
  }

  // risk-008 — stop-loss required on the riskiest asset classes.
  if (
    activeRule(ctx.riskRules, 'risk-008') &&
    (strategy.assetClass === 'futures' || strategy.assetClass === 'crypto') &&
    signal.stopLoss === undefined
  ) {
    return deny('Stop-loss obligatoire pour cette classe d’actifs.');
  }

  // risk-002 — maximum quantity per order.
  const maxQty = ruleNumber(ctx.riskRules, 'risk-002');
  if (maxQty !== null && quantity > maxQty) {
    return deny(`Quantité ${quantity} supérieure au maximum autorisé (${maxQty}).`);
  }

  // risk-001 — maximum notional per order.
  const maxNotional = ruleNumber(ctx.riskRules, 'risk-001');
  if (maxNotional !== null && notional > maxNotional) {
    return deny(`Notionnel ${notional.toFixed(0)} > règle de risque globale.`);
  }

  // risk-003 — maximum exposure on a single instrument.
  const maxPerTicker = ruleNumber(ctx.riskRules, 'risk-003');
  if (maxPerTicker !== null) {
    const held = ctx.positions
      .filter((p) => p.ticker === ticker)
      .reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
    if (held + notional > maxPerTicker) {
      return deny(
        `Exposition sur ${ticker} (${(held + notional).toFixed(0)}) au-dessus du plafond.`
      );
    }
  }

  // risk-004 — maximum exposure per account.
  const maxPerAccount = ruleNumber(ctx.riskRules, 'risk-004');
  if (maxPerAccount !== null) {
    const held = ctx.positions
      .filter((p) => p.connectionName === connection.name)
      .reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
    if (held + notional > maxPerAccount) {
      return deny(`Exposition du compte ${connection.name} au-dessus du plafond.`);
    }
  }

  // risk-005 — daily order count.
  const maxOrdersPerDay = ruleNumber(ctx.riskRules, 'risk-005');
  if (maxOrdersPerDay !== null && ctx.ordersToday >= maxOrdersPerDay) {
    return deny(`Quota d’ordres journalier atteint (${maxOrdersPerDay}).`);
  }

  // risk-006 — daily loss limit.
  const maxDailyLoss = ruleNumber(ctx.riskRules, 'risk-006');
  if (maxDailyLoss !== null && -ctx.realizedPnlToday >= maxDailyLoss) {
    return deny(`Perte journalière maximale atteinte (${maxDailyLoss}).`);
  }

  // risk-007 — consecutive losing trades.
  const maxConsecutiveLosses = ruleNumber(ctx.riskRules, 'risk-007');
  if (maxConsecutiveLosses !== null && ctx.consecutiveLosses >= maxConsecutiveLosses) {
    return deny(`${ctx.consecutiveLosses} pertes consécutives : exécution suspendue.`);
  }

  if (notional > connection.buyingPower) {
    return deny('Pouvoir d’achat insuffisant.');
  }

  // risk-009 — large orders require a human decision.
  const manualThreshold = ruleNumber(ctx.riskRules, 'risk-009');
  return allow(manualThreshold !== null && notional > manualThreshold);
}
