# Premier test TradingView avec SignalDesk

Ce guide explique, pas à pas, comment envoyer une alerte TradingView vers SignalDesk et vérifier qu'elle crée un ordre **simulé**. Il ne nécessite aucun courtier réel.

> **Avant de commencer.** Le test passe par une connexion SignalDesk en environnement **Simulation**. Aucun ordre réel n'est envoyé. Gardez `ALLOW_LIVE_TRADING=false` dans la configuration technique.

---

## Ce qu'il vous faut

- Un accès à SignalDesk.
- Un compte TradingView avec la possibilité de créer une alerte webhook. TradingView réserve les webhooks aux abonnements qui incluent cette fonction.
- Dix minutes environ.

## Résultat attendu

À la fin, vous aurez ce parcours :

```text
Alerte TradingView
  -> Relais TradingView SignalDesk
  -> Contrôles de risque
  -> Ordre simulé
  -> Position simulée
```

---

## Étape 1 - Ouvrir SignalDesk

1. Ouvrez votre tableau de bord SignalDesk.
2. Dans le menu de gauche, choisissez **Connexions**.
3. Vérifiez qu'une connexion en **Simulation** est disponible et marquée **Active**.

Si aucune connexion n'existe :

1. Cliquez sur **Ajouter une connexion**.
2. Donnez-lui un nom clair, par exemple `Test TradingView`.
3. Choisissez l'environnement **Simulation**.
4. Renseignez un capital et un pouvoir d'achat fictifs, par exemple `100000`.
5. Enregistrez, puis cliquez sur **Tester**.

> Pour ce premier test, ne créez pas de connexion en environnement « Réel ».

---

## Étape 2 - Créer une stratégie de test

1. Ouvrez **Stratégies**.
2. Cliquez sur **Créer une stratégie**.
3. Utilisez ces valeurs simples :

| Champ | Valeur conseillée |
|---|---|
| Nom | `Test TradingView AAPL` |
| Description | `Test de réception d'alertes TradingView sur AAPL.` |
| Statut | `Active` |
| Classe d'actifs | `Actions` |
| Actions autorisées | cochez `buy` et `sell` |
| Liste blanche | `AAPL` |
| Liste noire | laissez vide |
| Délai max. du signal | `300` secondes |
| Volume max. | `10` |
| Exposition max. | `5000` |
| Type d'ordre par défaut | `market` |
| Rejeter les doublons | activé |

4. Cliquez sur **Créer la stratégie**.

> La liste blanche `AAPL` est volontaire : elle garantit que seul Apple peut être accepté pendant cet essai.

---

## Étape 3 - Associer la stratégie à votre connexion simulée

1. Cliquez sur la carte **Test TradingView AAPL**.
2. Dans le panneau de détail, section **Souscriptions**, cliquez sur **Associer**.
3. Sélectionnez la stratégie et la connexion en Simulation créée ou choisie à l'étape 1.
4. Choisissez ces réglages :

| Champ | Valeur conseillée |
|---|---|
| Mode d'exécution | `Validation manuelle` |
| Méthode de dimensionnement | `Quantité fixe` |
| Valeur | `1` |
| Taille max. d'ordre | `1` |
| Exposition max. | `5000` |
| Vente à découvert | désactivée |
| Abonnement actif | activé |

5. Cliquez sur **Créer**.

Le mode **Validation manuelle** est important : l'alerte créera un ordre, mais vous déciderez vous-même de l'approuver ou le rejeter.

---

## Étape 4 - Désactiver temporairement la plage horaire

Par défaut, SignalDesk n'accepte les signaux que de **09:30 à 16:00, heure de New York**. Pour tester le soir, le week-end ou depuis un autre fuseau :

1. Ouvrez l'écran **Risque**.
2. Repérez la ligne **Plage horaire autorisée**.
3. Désactivez l'interrupteur à droite.

> Réactivez cette règle après vos essais et adaptez ses horaires à votre marché.

---

## Étape 5 - Copier les informations TradingView

1. Ouvrez l'écran **Webhooks**.
2. Repérez votre stratégie `Test TradingView AAPL`.
3. Dans le bloc **Relais TradingView** :
   - copiez l'**URL TradingView** ;
   - cliquez sur **Copier le message TradingView**.

Le message ressemble à ceci :

```json
{
  "passphrase": "whsec_...",
  "signalId": "{{timenow}}-{{ticker}}",
  "ticker": "{{ticker}}",
  "action": "buy",
  "price": "{{close}}",
  "timestamp": "{{timenow}}"
}
```

Ne modifiez pas `passphrase`. C'est la phrase secrète qui protège votre relais. Vous pouvez modifier `action` en `sell` pour un test de vente.

---

## Étape 6 - Créer l'alerte dans TradingView

1. Dans TradingView, ouvrez le graphique **NASDAQ:AAPL**.
2. Cliquez sur l'icône **Alerte** (horloge) ou utilisez `Alt + A`.
3. Choisissez une condition simple que vous pouvez déclencher, par exemple :
   - `AAPL` ;
   - **Croise** ;
   - un niveau de prix proche du cours actuel.
4. Choisissez une fréquence adaptée à vos essais, par exemple **Une seule fois**.
5. Dans la zone **Notifications**, cochez **Webhook URL**.
6. Collez l'URL copiée depuis SignalDesk à l'étape 5.
7. Dans le champ **Message**, collez le JSON copié depuis SignalDesk.
8. Vérifiez que le JSON est valide et que `action` vaut `buy` ou `sell`.
9. Cliquez sur **Créer**.

> TradingView doit envoyer le message au format JSON. Si vous avez ajouté du texte avant ou après les accolades, l'alerte sera refusée.

---

## Étape 7 - Déclencher l'alerte

Attendez que la condition de prix choisie soit atteinte. TradingView peut mettre quelques secondes à livrer le webhook.

Pour vérifier la réception :

1. Retournez dans SignalDesk, écran **Webhooks**.
2. Descendez jusqu'au **Journal des appels**.
3. Cherchez une ligne `AAPL` avec la source `TradingView`.

Vous devez obtenir le statut **Accepté**. Si le statut est **Rejeté**, lisez le motif et consultez le tableau de dépannage ci-dessous.

---

## Étape 8 - Valider l'ordre simulé

1. Ouvrez **Ordres**.
2. Cherchez l'ordre `AAPL` le plus récent.
3. Son statut doit être **En attente**.
4. Cliquez sur la ligne pour ouvrir le détail.
5. Vérifiez le ticker, l'action, la quantité `1`, la stratégie et le compte de test.
6. Cliquez sur **Approuver**.
7. Patientez quelques secondes, puis actualisez si nécessaire.

L'ordre passe à **Exécuté**. Ouvrez ensuite **Positions** : une position AAPL simulée doit être visible.

Vous venez de réaliser un cycle complet TradingView -> SignalDesk -> ordre simulé.

---

## Dépannage rapide

| Ce que vous observez | Cause probable | Action à faire |
|---|---|---|
| Rien n'apparaît dans le journal SignalDesk | L'URL est erronée, l'alerte TradingView n'est pas déclenchée, ou votre plan TradingView n'autorise pas les webhooks. | Vérifiez l'historique de l'alerte dans TradingView et recopiez l'URL. |
| `Phrase secrète invalide` | La valeur `passphrase` a été modifiée ou le secret de la stratégie a été régénéré. | Copiez à nouveau le message TradingView depuis SignalDesk et mettez à jour l'alerte. |
| `Alerte TradingView invalide` | Le JSON est mal formé ou un champ obligatoire est absent. | Recopiez le message généré par SignalDesk sans ajout de texte. |
| `AAPL absent de la liste blanche` | Le graphique TradingView n'est pas AAPL, ou le ticker reçu diffère. | Testez avec AAPL ou ajoutez le ticker reçu dans la liste blanche. |
| `Hors de la plage horaire autorisée` | Le test a lieu hors des horaires définis. | Désactivez temporairement « Plage horaire autorisée » dans Risque. |
| `Stratégie brouillon` ou `suspendue` | La stratégie n'est pas active. | Ouvrez la stratégie et cliquez sur **Activer**. |
| `Abonnement désactivé` ou `Aucun abonnement éligible` | La stratégie n'est pas reliée à une connexion active. | Créez ou activez l'abonnement de l'étape 3. |
| Ordre bloqué en `En attente` | C'est le mode validation manuelle. | Ouvrez l'ordre et cliquez sur **Approuver** ou **Rejeter**. |
| Ordre bloqué en `Soumis` | Le tableau de bord n'a pas été consulté depuis la soumission. | Ouvrez SignalDesk et attendez quelques secondes. |

---

## Après le test

Avant de tester un autre instrument :

1. Suspendez ou supprimez votre stratégie de test si vous ne l'utilisez plus.
2. Réactivez la règle **Plage horaire autorisée**.
3. Vérifiez que le coupe-circuit est dans l'état souhaité.
4. N'utilisez pas une connexion réelle tant que vous n'avez pas validé plusieurs cycles en simulation.

Pour aller plus loin, consultez le [guide utilisateur](GUIDE-UTILISATEUR.md) et le [manuel technique](MANUEL.md).
