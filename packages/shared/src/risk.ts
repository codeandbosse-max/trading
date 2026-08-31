import type {
  Connection,
  IncomingSignal,
  RiskRule,
  SignalAction,
  Strategy,
  Subscription,
} from './types';

export interface RiskContext {
  killSwitch: boolean;
  riskRules: RiskRule[];
  connections: Connection[];
}

export interface RiskDecision {
  allowed: boolean;
  reason: string | null;
}

export const actionToSide: Record<SignalAction, 'achat' | 'vente'> = {
  buy: 'achat',
  cover: 'achat',
  sell: 'vente',
  short: 'vente',
  exit: 'vente',
  reverse: 'achat',
};

/** Numeric portion of a risk rule value such as "5 000 USD" or "3 %". */
export function ruleNumber(rules: RiskRule[], id: string): number | null {
  const rule = rules.find((r) => r.id === id);
  if (!rule || !rule.enabled) return null;
  const digits = rule.value.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
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
    return { allowed: false, reason: 'Coupe-circuit actif : toute exécution est bloquée.' };
  }
  if (strategy.status !== 'active') {
    return { allowed: false, reason: `Stratégie ${strategy.status}, signal ignoré.` };
  }
  if (!subscription.enabled) {
    return { allowed: false, reason: 'Abonnement désactivé.' };
  }
  if (!strategy.allowedActions.includes(signal.action)) {
    return { allowed: false, reason: `Action "${signal.action}" non autorisée par la stratégie.` };
  }
  const ticker = subscription.tickerOverride ?? signal.ticker;
  if (strategy.whitelist.length > 0 && !strategy.whitelist.includes(ticker)) {
    return { allowed: false, reason: `${ticker} absent de la liste blanche.` };
  }
  if (strategy.blacklist.includes(ticker)) {
    return { allowed: false, reason: `${ticker} figure sur la liste noire.` };
  }
  if (signal.action === 'short' && !subscription.allowShort) {
    return { allowed: false, reason: 'Vente à découvert interdite sur cet abonnement.' };
  }
  const ageSec = (Date.now() - new Date(signal.receivedAt).getTime()) / 1000;
  if (ageSec > strategy.maxSignalDelaySec) {
    return {
      allowed: false,
      reason: `Signal expiré (${Math.round(ageSec)}s > ${strategy.maxSignalDelaySec}s).`,
    };
  }
  if (quantity <= 0) {
    return { allowed: false, reason: 'Quantité calculée nulle.' };
  }
  if (quantity > strategy.maxVolume) {
    return {
      allowed: false,
      reason: `Volume ${quantity} supérieur au maximum ${strategy.maxVolume}.`,
    };
  }
  if (quantity > subscription.maxOrderSize) {
    return {
      allowed: false,
      reason: `Taille d'ordre ${quantity} supérieure au plafond ${subscription.maxOrderSize}.`,
    };
  }
  const notional = quantity * price;
  if (notional > subscription.maxExposure) {
    return { allowed: false, reason: `Exposition ${notional.toFixed(0)} au-dessus du plafond.` };
  }
  const maxNotional = ruleNumber(ctx.riskRules, 'risk-001');
  if (maxNotional !== null && notional > maxNotional) {
    return { allowed: false, reason: `Notionnel ${notional.toFixed(0)} > règle de risque globale.` };
  }
  const connection = ctx.connections.find((c) => c.id === subscription.connectionId);
  if (!connection) return { allowed: false, reason: 'Connexion introuvable.' };
  if (connection.status !== 'actif') {
    return { allowed: false, reason: `Connexion ${connection.name} indisponible.` };
  }
  if (notional > connection.buyingPower) {
    return { allowed: false, reason: 'Pouvoir d’achat insuffisant.' };
  }
  return { allowed: true, reason: null };
}
