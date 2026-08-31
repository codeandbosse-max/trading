import { Router } from 'express';
import {
  connectionInputSchema,
  connectionFormSchema,
  killSwitchSchema,
  orderActionSchema,
  riskRuleUpdateSchema,
  strategyInputSchema,
  subscriptionInputSchema,
} from '@trading/shared';
import { getDb } from '../db/pool';
import { encrypt, newWebhookId, newWebhookSecret, uid } from '../lib/crypto';
import {
  countRows,
  findConnection,
  findOrder,
  findStrategy,
  listAuditLogs,
  listConnections,
  listNotifications,
  listOrders,
  listPositions,
  listRiskRules,
  listSignalLogs,
  listStrategies,
  listSubscriptions,
  getKillSwitch,
  setKillSwitch,
  mapConnection,
  mapRiskRule,
  mapStrategy,
  mapSubscription,
  recordRealizedTrade,
} from '../repositories/queries';
import { pushNotification, recordAudit } from '../services/journal';
import { maybeRunTick } from '../services/scheduler';
import { asyncHandler, HttpError } from '../middleware/errors';

export const router = Router();

const clientIp = (req: { ip?: string }): string => req.ip ?? '-';

function pageParams(query: Record<string, unknown>, defaultLimit: number) {
  const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit, 1), 500);
  const offset = Math.max(Number.parseInt(String(query.offset ?? 0), 10) || 0, 0);
  return { limit, offset };
}

router.get(
  '/state',
  asyncHandler(async (_req, res) => {
    await maybeRunTick();

    const [
      strategies,
      connections,
      subscriptions,
      orders,
      signalLogs,
      positions,
      riskRules,
      auditLogs,
      notifications,
      killSwitch,
      ordersTotal,
      signalLogsTotal,
      auditLogsTotal,
    ] = await Promise.all([
      listStrategies(),
      listConnections(),
      listSubscriptions(),
      listOrders(),
      listSignalLogs(),
      listPositions(),
      listRiskRules(),
      listAuditLogs(),
      listNotifications(),
      getKillSwitch(),
      countRows('orders'),
      countRows('signal_logs'),
      countRows('audit_logs'),
    ]);
    res.json({
      strategies,
      connections,
      subscriptions,
      orders,
      signalLogs,
      positions,
      riskRules,
      auditLogs,
      notifications,
      killSwitch,
      counts: {
        orders: ordersTotal,
        signalLogs: signalLogsTotal,
        auditLogs: auditLogsTotal,
      },
    });
  })
);

/* ---------------------------------- Strategies --------------------------------- */

router.get(
  '/strategies',
  asyncHandler(async (_req, res) => res.json(await listStrategies()))
);

router.post(
  '/strategies',
  asyncHandler(async (req, res) => {
    const input = strategyInputSchema.parse(req.body);
    const { rows } = await getDb().query(
      `INSERT INTO strategies
        (id, name, description, status, asset_class, allowed_actions, whitelist, blacklist,
         webhook_id, webhook_secret, max_signal_delay_sec, reject_duplicates, max_volume,
         max_exposure, default_order_type, signals_today, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0, now()) RETURNING *`,
      [
        uid('strat'),
        input.name,
        input.description,
        input.status,
        input.assetClass,
        JSON.stringify(input.allowedActions),
        JSON.stringify(input.whitelist),
        JSON.stringify(input.blacklist),
        newWebhookId(),
        newWebhookSecret(),
        input.maxSignalDelaySec,
        input.rejectDuplicates,
        input.maxVolume,
        input.maxExposure,
        input.defaultOrderType,
      ]
    );
    await recordAudit('strategie.creation', input.name, 'info', clientIp(req));
    res.status(201).json(mapStrategy(rows[0]));
  })
);

router.put(
  '/strategies/:id',
  asyncHandler(async (req, res) => {
    const input = strategyInputSchema.parse(req.body);
    const { rows } = await getDb().query(
      `UPDATE strategies SET name=$2, description=$3, status=$4, asset_class=$5,
         allowed_actions=$6, whitelist=$7, blacklist=$8, max_signal_delay_sec=$9,
         reject_duplicates=$10, max_volume=$11, max_exposure=$12, default_order_type=$13
       WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        input.name,
        input.description,
        input.status,
        input.assetClass,
        JSON.stringify(input.allowedActions),
        JSON.stringify(input.whitelist),
        JSON.stringify(input.blacklist),
        input.maxSignalDelaySec,
        input.rejectDuplicates,
        input.maxVolume,
        input.maxExposure,
        input.defaultOrderType,
      ]
    );
    if (!rows[0]) throw new HttpError(404, 'Stratégie introuvable.');
    await recordAudit('strategie.modification', input.name, 'info', clientIp(req));
    res.json(mapStrategy(rows[0]));
  })
);

router.delete(
  '/strategies/:id',
  asyncHandler(async (req, res) => {
    const strategy = await findStrategy(req.params.id);
    if (!strategy) throw new HttpError(404, 'Stratégie introuvable.');
    await getDb().query(`DELETE FROM strategies WHERE id = $1`, [req.params.id]);
    await recordAudit('strategie.suppression', strategy.name, 'warning', clientIp(req));
    res.status(204).end();
  })
);

router.post(
  '/strategies/:id/rotate-secret',
  asyncHandler(async (req, res) => {
    const secret = newWebhookSecret();
    const { rows } = await getDb().query(
      `UPDATE strategies SET webhook_secret = $2 WHERE id = $1 RETURNING *`,
      [req.params.id, secret]
    );
    if (!rows[0]) throw new HttpError(404, 'Stratégie introuvable.');
    await recordAudit('webhook.rotation_secret', rows[0].name, 'warning', clientIp(req));
    res.json(mapStrategy(rows[0]));
  })
);

/* --------------------------------- Connections --------------------------------- */

router.get(
  '/connections',
  asyncHandler(async (_req, res) => res.json(await listConnections()))
);

router.post(
  '/connections',
  asyncHandler(async (req, res) => {
    const input = connectionFormSchema.parse(req.body);
    const { rows } = await getDb().query(
      `INSERT INTO connections
        (id, name, broker, env, status, currency, buying_power, equity, allowed_instruments,
         api_key_cipher, api_secret_cipher, last_test_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now()) RETURNING *`,
      [
        uid('conn'),
        input.name,
        input.broker,
        input.env,
        input.status,
        input.currency,
        input.buyingPower,
        input.equity,
        JSON.stringify(input.allowedInstruments),
        encrypt(input.apiKey),
        encrypt(input.apiSecret),
      ]
    );
    await recordAudit('connexion.creation', input.name, 'info', clientIp(req));
    res.status(201).json(mapConnection(rows[0]));
  })
);

router.put(
  '/connections/:id',
  asyncHandler(async (req, res) => {
    const input = connectionInputSchema.parse(req.body);
    const { rows } = await getDb().query(
      `UPDATE connections SET name=$2, broker=$3, env=$4, status=$5, currency=$6,
         buying_power=$7, equity=$8, allowed_instruments=$9
       WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        input.name,
        input.broker,
        input.env,
        input.status,
        input.currency,
        input.buyingPower,
        input.equity,
        JSON.stringify(input.allowedInstruments),
      ]
    );
    if (!rows[0]) throw new HttpError(404, 'Connexion introuvable.');
    await recordAudit('connexion.modification', input.name, 'info', clientIp(req));
    res.json(mapConnection(rows[0]));
  })
);

router.delete(
  '/connections/:id',
  asyncHandler(async (req, res) => {
    const connection = await findConnection(req.params.id);
    if (!connection) throw new HttpError(404, 'Connexion introuvable.');
    await getDb().query(`DELETE FROM connections WHERE id = $1`, [req.params.id]);
    await recordAudit('connexion.suppression', connection.name, 'warning', clientIp(req));
    res.status(204).end();
  })
);

router.post(
  '/connections/:id/test',
  asyncHandler(async (req, res) => {
    const connection = await findConnection(req.params.id);
    if (!connection) throw new HttpError(404, 'Connexion introuvable.');
    const reachable = connection.status !== 'expire';
    const { rows } = await getDb().query(
      `UPDATE connections SET status = $2, last_test_at = now() WHERE id = $1 RETURNING *`,
      [connection.id, reachable ? 'actif' : 'expire']
    );
    await recordAudit(
      'connexion.test',
      `${connection.name} → ${reachable ? 'actif' : 'expire'}`,
      reachable ? 'info' : 'warning',
      clientIp(req)
    );
    await pushNotification({
      type: 'connexion',
      title: reachable ? 'Connexion opérationnelle' : 'Échec du test',
      message: reachable
        ? `${connection.name} a répondu correctement.`
        : `${connection.name} : identifiants expirés, renouvelez la clé API.`,
      severity: reachable ? 'success' : 'error',
    });
    res.json({ reachable, connection: mapConnection(rows[0]) });
  })
);

router.post(
  '/connections/:id/status',
  asyncHandler(async (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    const { rows } = await getDb().query(
      `UPDATE connections SET status = $2 WHERE id = $1 RETURNING *`,
      [req.params.id, enabled ? 'actif' : 'indisponible']
    );
    if (!rows[0]) throw new HttpError(404, 'Connexion introuvable.');
    await recordAudit(
      'connexion.changement_etat',
      `${rows[0].name} → ${enabled ? 'actif' : 'indisponible'}`,
      'warning',
      clientIp(req)
    );
    res.json(mapConnection(rows[0]));
  })
);

/* -------------------------------- Subscriptions -------------------------------- */

router.get(
  '/subscriptions',
  asyncHandler(async (_req, res) => res.json(await listSubscriptions()))
);

router.post(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const input = subscriptionInputSchema.parse(req.body);
    const { rows } = await getDb().query(
      `INSERT INTO subscriptions
        (id, strategy_id, connection_id, enabled, execution_mode, sizing_method,
         sizing_value, max_order_size, max_exposure, allow_short, ticker_override)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        uid('sub'),
        input.strategyId,
        input.connectionId,
        input.enabled,
        input.executionMode,
        input.sizingMethod,
        input.sizingValue,
        input.maxOrderSize,
        input.maxExposure,
        input.allowShort,
        input.tickerOverride ?? null,
      ]
    );
    await recordAudit('abonnement.creation', rows[0].id, 'info', clientIp(req));
    res.status(201).json(mapSubscription(rows[0]));
  })
);

router.put(
  '/subscriptions/:id',
  asyncHandler(async (req, res) => {
    const input = subscriptionInputSchema.parse(req.body);
    const { rows } = await getDb().query(
      `UPDATE subscriptions SET strategy_id=$2, connection_id=$3, enabled=$4, execution_mode=$5,
         sizing_method=$6, sizing_value=$7, max_order_size=$8, max_exposure=$9,
         allow_short=$10, ticker_override=$11
       WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        input.strategyId,
        input.connectionId,
        input.enabled,
        input.executionMode,
        input.sizingMethod,
        input.sizingValue,
        input.maxOrderSize,
        input.maxExposure,
        input.allowShort,
        input.tickerOverride ?? null,
      ]
    );
    if (!rows[0]) throw new HttpError(404, 'Abonnement introuvable.');
    await recordAudit('abonnement.modification', req.params.id, 'info', clientIp(req));
    res.json(mapSubscription(rows[0]));
  })
);

router.delete(
  '/subscriptions/:id',
  asyncHandler(async (req, res) => {
    await getDb().query(`DELETE FROM subscriptions WHERE id = $1`, [req.params.id]);
    await recordAudit('abonnement.suppression', req.params.id, 'warning', clientIp(req));
    res.status(204).end();
  })
);

/* ------------------------------------ Orders ----------------------------------- */

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { limit, offset } = pageParams(req.query, 200);
    const [items, total] = await Promise.all([listOrders(limit, offset), countRows('orders')]);
    res.json({ items, total, limit, offset });
  })
);

const transitions: Record<string, { status: string; audit: string }> = {
  approve: { status: 'soumis', audit: 'ordre.approuve' },
  reject: { status: 'rejete', audit: 'ordre.rejete' },
  cancel: { status: 'annule', audit: 'ordre.annule' },
  retry: { status: 'envoi_en_cours', audit: 'ordre.reessaye' },
};

router.post(
  '/orders/:id/actions',
  asyncHandler(async (req, res) => {
    const { action, reason } = orderActionSchema.parse(req.body);
    const order = await findOrder(req.params.id);
    if (!order) throw new HttpError(404, 'Ordre introuvable.');
    if (order.status === 'execute') {
      throw new HttpError(409, 'Un ordre exécuté ne peut plus être modifié.');
    }

    const target = transitions[action];
    const { rows } = await getDb().query(
      `UPDATE orders
         SET status = $2,
             rejection_reason = $3,
             submitted_at = CASE WHEN $2 IN ('soumis','envoi_en_cours') THEN now() ELSE submitted_at END
       WHERE id = $1 RETURNING *`,
      [order.id, target.status, action === 'reject' ? reason ?? 'Rejet manuel.' : null]
    );
    await recordAudit(
      target.audit,
      `${order.ticker} (${order.id})`,
      action === 'reject' || action === 'cancel' ? 'warning' : 'info',
      clientIp(req)
    );
    res.json(rows[0] ? { id: rows[0].id, status: rows[0].status } : null);
  })
);

/* ---------------------------------- Positions ---------------------------------- */

router.get(
  '/positions',
  asyncHandler(async (_req, res) => res.json(await listPositions()))
);

router.delete(
  '/positions/:id',
  asyncHandler(async (req, res) => {
    const positions = await listPositions();
    const position = positions.find((p) => p.id === req.params.id);
    if (!position) throw new HttpError(404, 'Position introuvable.');

    await getDb().query(`DELETE FROM positions WHERE id = $1`, [req.params.id]);
    await recordRealizedTrade({
      id: uid('trade'),
      ticker: position.ticker,
      connectionName: position.connectionName,
      quantity: position.qty,
      pnl: position.pnl,
    });
    await recordAudit('position.cloture', position.ticker, 'info', clientIp(req));
    res.status(204).end();
  })
);

/* ------------------------------------- Risk ------------------------------------ */

router.get(
  '/risk/rules',
  asyncHandler(async (_req, res) => res.json(await listRiskRules()))
);

router.put(
  '/risk/rules/:id',
  asyncHandler(async (req, res) => {
    const input = riskRuleUpdateSchema.parse(req.body);
    const { rows } = await getDb().query(
      `UPDATE risk_rules SET value = $2, enabled = $3 WHERE id = $1 RETURNING *`,
      [req.params.id, input.value, input.enabled]
    );
    if (!rows[0]) throw new HttpError(404, 'Règle introuvable.');
    await recordAudit('risque.regle_modifiee', rows[0].label, 'info', clientIp(req));
    res.json(mapRiskRule(rows[0]));
  })
);

router.get(
  '/risk/kill-switch',
  asyncHandler(async (_req, res) => res.json({ active: await getKillSwitch() }))
);

router.post(
  '/risk/kill-switch',
  asyncHandler(async (req, res) => {
    const { active } = killSwitchSchema.parse(req.body);
    await setKillSwitch(active);
    await recordAudit(
      active ? 'risque.coupe_circuit_active' : 'risque.coupe_circuit_desactive',
      'Plateforme',
      'critical',
      clientIp(req)
    );
    await pushNotification({
      type: 'risque',
      title: active ? 'Coupe-circuit activé' : 'Coupe-circuit désactivé',
      message: active
        ? 'Toutes les exécutions sont suspendues jusqu’à réarmement.'
        : 'Les exécutions reprennent normalement.',
      severity: active ? 'error' : 'success',
    });
    res.json({ active });
  })
);

/* --------------------------------- Journal ------------------------------------- */

router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { limit, offset } = pageParams(req.query, 300);
    const [items, total] = await Promise.all([
      listAuditLogs(limit, offset),
      countRows('audit_logs'),
    ]);
    res.json({ items, total, limit, offset });
  })
);

router.get(
  '/signal-logs',
  asyncHandler(async (req, res) => {
    const { limit, offset } = pageParams(req.query, 200);
    const [items, total] = await Promise.all([
      listSignalLogs(limit, offset),
      countRows('signal_logs'),
    ]);
    res.json({ items, total, limit, offset });
  })
);

router.get(
  '/notifications',
  asyncHandler(async (_req, res) => res.json(await listNotifications()))
);

router.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    await getDb().query(`UPDATE notifications SET read = true WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  })
);

router.post(
  '/notifications/read-all',
  asyncHandler(async (_req, res) => {
    await getDb().query(`UPDATE notifications SET read = true WHERE read = false`);
    res.status(204).end();
  })
);
