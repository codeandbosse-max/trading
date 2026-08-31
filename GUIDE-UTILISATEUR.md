# Guide utilisateur — SignalDesk

Ce guide s'adresse aux **utilisateurs métiers** : traders, gérants et opérateurs qui pilotent la plateforme au quotidien. Il n'aborde ni l'installation ni la technique — pour cela, voir le [manuel technique](MANUEL.md).

> **À lire avant de commencer.** Par défaut, SignalDesk **ne transmet aucun ordre à un courtier réel** : les exécutions sont simulées. Le routage vers un vrai compte existe mais doit être activé explicitement par votre équipe technique. Voir [Ce que la plateforme ne fait pas encore](#9-ce-que-la-plateforme-ne-fait-pas-encore).

---

## Sommaire

1. [Le vocabulaire en une minute](#1-le-vocabulaire-en-une-minute)
2. [Prise en main : votre première automatisation](#2-prise-en-main--votre-première-automatisation)
3. [Les écrans au quotidien](#3-les-écrans-au-quotidien)
4. [Comprendre les statuts](#4-comprendre-les-statuts)
5. [Mon signal a été refusé : que faire ?](#5-mon-signal-a-été-refusé--que-faire-)
6. [Sécurité au quotidien](#6-sécurité-au-quotidien)
7. [Routines conseillées](#7-routines-conseillées)
8. [Exports et reporting](#8-exports-et-reporting)
9. [Ce que la plateforme ne fait pas encore](#9-ce-que-la-plateforme-ne-fait-pas-encore)
10. [Questions fréquentes](#10-questions-fréquentes)

---

## 1. Le vocabulaire en une minute

Quatre notions suffisent pour tout comprendre.

| Terme | En clair |
|---|---|
| **Stratégie** | Votre règle de jeu. Elle reçoit les signaux d'une source (votre indicateur, votre script) et définit ce qui est autorisé : quels instruments, quelles actions, quels plafonds. |
| **Connexion** | Un compte de courtage. C'est là que les ordres partiraient. |
| **Abonnement** | Le branchement entre une stratégie et un compte. Il décide **combien** acheter ou vendre sur ce compte précis, et si vous validez à la main ou non. |
| **Signal** | Le message reçu de votre source, qui dit par exemple « achète AAPL ». |

**La règle d'or :** une stratégie seule ne fait rien. C'est l'abonnement qui la relie à un compte et qui déclenche les ordres.

```
Votre indicateur  →  Signal  →  Stratégie  →  Abonnement  →  Ordre  →  Position
                                (filtre)      (dimensionne)
```

Si une stratégie est branchée à trois comptes, un seul signal peut créer trois ordres — un par compte.

---

## 2. Prise en main : votre première automatisation

Comptez une quinzaine de minutes. Suivez les étapes dans l'ordre.

### Étape 0 — Créer votre compte

À la première visite, vous arrivez sur l'écran de connexion.

- **Si personne n'a encore de compte**, un message vous l'indique : l'onglet **Inscription** est ouvert et le premier compte créé devient **administrateur**.
- **Sinon**, l'inscription demande un **code d'invitation** à réclamer à votre administrateur. Sans ce code, les inscriptions sont fermées.

Le mot de passe doit faire au moins 12 caractères et mêler majuscule, minuscule et chiffre. Vous restez connecté 7 jours ; le bouton de déconnexion se trouve en haut à droite.

> Vos actions sont tracées à votre nom dans le journal d'audit. Ne partagez pas votre compte.

### Étape 1 — Déclarer un compte

Écran **Connexions** → bouton **Ajouter une connexion**.

Renseignez le nom, le courtier, l'environnement (**choisissez « Simulation »** pour vos premiers essais), la devise, vos identifiants API, le capital et le pouvoir d'achat.

> Vos identifiants sont chiffrés et ne sont plus jamais réaffichés. Conservez-les de votre côté.

Cliquez ensuite sur **Tester** : la carte doit passer au vert et afficher « Actif ». Une connexion qui n'est pas active bloque tous ses ordres.

### Étape 2 — Créer une stratégie

Écran **Stratégies** → **Créer une stratégie**.

Les champs qui comptent vraiment :

- **Statut** — laissez **Brouillon** pour l'instant. Une stratégie en brouillon reçoit les signaux mais ne crée aucun ordre : c'est votre filet de sécurité.
- **Actions autorisées** — ne cochez que ce dont vous avez besoin. Si votre indicateur n'envoie jamais de vente à découvert, ne l'autorisez pas.
- **Liste blanche** — les seuls instruments acceptés, séparés par des virgules (`AAPL, MSFT, NVDA`). **Laissée vide, elle autorise tout.** C'est votre garde-fou le plus efficace : remplissez-la.
- **Liste noire** — les instruments explicitement interdits.
- **Volume maximum** et **Exposition maximum** — les plafonds par ordre. Commencez petit.
- **Rejeter les doublons** — laissez activé : si votre source envoie deux fois le même signal, le second est ignoré.

### Étape 3 — Brancher la stratégie sur le compte

Cliquez sur la carte de votre stratégie pour ouvrir le panneau de détail, puis **Associer**.

- **Mode d'exécution** — commencez par **Validation manuelle**. Chaque ordre attendra votre approbation. Vous passerez en **Automatique** une fois en confiance.
- **Méthode de dimensionnement** — c'est ce qui détermine la quantité :

| Méthode | Ce qu'elle fait |
|---|---|
| Quantité fixe | Toujours le même nombre d'unités. Le plus simple pour débuter. |
| Taille du signal | Utilise la quantité envoyée par votre indicateur. |
| Pourcentage du capital | Investit un pourcentage du capital du compte. |
| Montant monétaire | Investit une somme fixe, convertie en quantité selon le prix. |
| Risque par trade | Se comporte aujourd'hui comme le pourcentage du capital. |

- **Taille maximale d'ordre** et **Exposition maximale** — les plafonds propres à ce compte.
- **Autoriser la vente à découvert** — à laisser désactivé si vous n'en faites pas.

### Étape 4 — Récupérer l'adresse de réception

Écran **Webhooks**. Chaque stratégie a sa propre adresse et son propre **secret**.

Copiez l'adresse, puis affichez le secret avec l'icône en forme d'œil et copiez-le également. Transmettez les deux à la personne qui configure votre source de signaux.

> **Important.** Chaque message doit être **signé** avec ce secret, sinon il est refusé. TradingView ne sait pas le faire seul : il faut un intermédiaire technique entre TradingView et SignalDesk. Voyez cela avec votre équipe technique avant de brancher une source.

### Étape 5 — Tester à blanc

Toujours sur l'écran **Webhooks**, cliquez sur **Signal de test** pour votre stratégie. La plateforme fabrique un signal, l'envoie réellement, et vous dit ce qui s'est passé.

Comme la stratégie est en brouillon, le résultat attendu est un refus avec le motif « Stratégie brouillon, signal ignoré ». C'est normal : cela prouve que la chaîne fonctionne de bout en bout.

Vérifiez la trace dans le **journal des appels**, en bas du même écran.

### Étape 6 — Passer en service

Retournez sur **Stratégies**, ouvrez votre stratégie, cliquez sur **Activer**.

Relancez un **Signal de test**. Cette fois, un ordre doit être créé. Rendez-vous sur l'écran **Ordres** : il apparaît en « En attente » (puisque vous avez choisi la validation manuelle). Ouvrez-le et cliquez sur **Approuver**. Quelques secondes plus tard, il passe en « Exécuté » et une position apparaît sur l'écran **Positions**.

Votre automatisation est opérationnelle.

---

## 3. Les écrans au quotidien

### Vue d'ensemble
Votre point d'entrée le matin. Signaux reçus, taux d'acceptation, nombre d'ordres, P&L, et trois graphiques. Une bannière vous rappelle l'état du coupe-circuit.

**Flux temps réel** accélère le rafraîchissement de l'écran — pratique pendant une séance active.

### Stratégies
Vue d'ensemble de vos règles. Le panneau de détail permet de modifier, **dupliquer** (pour créer une variante sans toucher à l'originale), suspendre, ou supprimer.

> Suspendre une stratégie l'arrête immédiatement sans rien effacer. **Préférez toujours « Suspendre » à « Supprimer » :** la suppression efface aussi tous les branchements vers vos comptes, et l'adresse de réception cesse définitivement de fonctionner.

### Webhooks
Les adresses de réception, les secrets, et le journal des appels entrants. C'est ici que vous diagnostiquez les problèmes de réception.

### Ordres
Le suivi complet. Filtrez par texte (instrument, stratégie, compte) et par statut. Cliquez sur une ligne pour voir la chronologie, le prix d'exécution et, en cas d'échec, le motif.

Selon l'état de l'ordre, vous pouvez **Approuver**, **Rejeter**, **Annuler** ou **Réessayer**. Un ordre déjà exécuté ne peut plus être modifié.

### Connexions
L'état de vos comptes : capital, pouvoir d'achat, nombre de positions. Le bouton **Tester** vérifie qu'un compte répond. L'interrupteur permet de le mettre hors service sans le supprimer.

### Positions
Ce que vous détenez, avec le P&L par ligne. **Clôturer** retire la position.

### Risque
Le **coupe-circuit** et les seuils globaux. Voir le chapitre suivant.

### Historique
Deux journaux : la trace de toutes les actions sensibles (qui a fait quoi, quand) et l'historique des signaux reçus. Les deux sont exportables.

### En haut de l'écran
- **Recherche globale** : `Ctrl + K` — retrouve instantanément une stratégie, un ordre, un compte ou une position.
- **Cloche** : vos notifications. Un clic les marque comme lues.
- **Lune / soleil** : mode clair ou sombre.

---

## 4. Comprendre les statuts

**Vos signaux**

| Ce que vous voyez | Ce que ça veut dire |
|---|---|
| Accepté | Au moins un ordre a été créé. |
| Rejeté | Aucun ordre. Le motif est affiché juste à côté. |
| Dupliqué | Ce signal avait déjà été reçu. Il a été ignoré volontairement. |

**Vos ordres**

| Ce que vous voyez | Ce que ça veut dire | Ce que vous pouvez faire |
|---|---|---|
| En attente | Attend votre approbation. | Approuver ou Rejeter |
| Soumis | Parti vers le courtier. | Annuler |
| Exécuté | Terminé, la position est mise à jour. | Rien |
| Validé | Créé en mode simulation. Il sera exécuté sur le compte simulé. | Annuler |
| Annulé / Rejeté / Erreur | Terminé sans exécution. | Réessayer |

---

## 5. Mon signal a été refusé : que faire ?

Le motif exact est toujours affiché sur l'écran **Webhooks** (journal des appels) et dans **Historique**.

| Motif affiché | Cause | Que faire |
|---|---|---|
| Coupe-circuit actif | Le coupe-circuit global est enclenché. | Écran Risque → désactiver, après vérification. |
| Stratégie brouillon / suspendue | La stratégie n'est pas active. | Écran Stratégies → Activer. |
| Abonnement désactivé | Le branchement vers le compte est éteint. | Ouvrir la stratégie → modifier l'abonnement. |
| Action non autorisée | Votre source envoie une action que vous n'avez pas cochée. | Cocher l'action dans la stratégie, ou corriger la source. |
| Instrument absent de la liste blanche | L'instrument n'est pas dans la liste autorisée. | L'ajouter, ou vérifier que la source n'envoie pas n'importe quoi. |
| Instrument sur liste noire | Interdiction explicite. | Comportement voulu, en principe. |
| Vente à découvert interdite | L'abonnement ne l'autorise pas. | L'activer dans l'abonnement si c'est souhaité. |
| Volume / taille / exposition au-dessus du plafond | La quantité calculée dépasse un plafond. | Baisser le dimensionnement ou relever le plafond. |
| Notionnel supérieur à la règle globale | Le montant dépasse « Montant maximal par ordre » (écran Risque). | Ajuster la règle ou la taille. |
| Quantité supérieure au maximum autorisé | Dépasse « Quantité maximale par ordre ». | Ajuster la règle ou le dimensionnement. |
| Exposition sur … au-dessus du plafond | Dépasse « Position maximale par ticker ». | Réduire la taille ou clôturer une partie. |
| Exposition du compte au-dessus du plafond | Dépasse « Exposition maximale par compte ». | Réduire l'exposition du compte. |
| Quota d'ordres journalier atteint | Dépasse « Ordres par jour ». | Attendre le lendemain ou relever la règle. |
| Perte journalière maximale atteinte | Les pertes réalisées du jour ont atteint le seuil. | Arrêt volontaire : analysez avant de relancer. |
| Pertes consécutives | Trop de trades perdants d'affilée. | Arrêt volontaire : révisez la stratégie. |
| Stop-loss obligatoire | Signal futures ou crypto sans stop-loss. | Faire envoyer un `stopLoss` par la source. |
| Hors de la plage horaire autorisée | Signal reçu en dehors des heures configurées. | Ajuster « Plage horaire autorisée » ou attendre. |
| Connexion indisponible | Le compte n'est pas actif. | Écran Connexions → Tester, puis Activer. |
| Pouvoir d'achat insuffisant | Pas assez de liquidités sur le compte. | Réduire la taille ou approvisionner le compte. |
| Aucun abonnement éligible | La stratégie n'est branchée à aucun compte. | Ouvrir la stratégie → Associer. |

**Cas particulier : aucune trace du tout.** Si vous ne voyez ni acceptation ni refus, le message n'est jamais arrivé jusqu'aux règles. C'est presque toujours un problème d'adresse ou de secret. Vérifiez auprès de votre équipe technique — et souvenez-vous qu'un secret régénéré invalide immédiatement l'ancien.

---

## 6. Sécurité au quotidien

### Le coupe-circuit

Écran **Risque**, gros bouton en haut. Une fois enclenché, **plus aucun ordre n'est créé**, sur aucune stratégie et aucun compte. Les signaux continuent d'être reçus et tracés, ce qui vous permet d'analyser après coup ce qui se serait passé.

Utilisez-le sans hésiter en cas de doute : marché erratique, comportement anormal d'un indicateur, incident chez un courtier. Le réarmement est tout aussi immédiat.

Son état est visible en permanence en bas de la barre latérale.

### Les seuils globaux

Toujours sur l'écran **Risque**, dix seuils sont proposés. Vous pouvez les activer, les désactiver et modifier leur valeur (icône crayon, `Entrée` pour valider).

**Les dix seuils sont appliqués** à chaque signal :

| Seuil | Effet |
|---|---|
| Montant maximal par ordre | Refuse les ordres dont la valeur dépasse le seuil. |
| Quantité maximale par ordre | Refuse au-delà d'un nombre d'unités. |
| Position maximale par ticker | Plafonne l'exposition totale sur un instrument. |
| Exposition maximale par compte | Plafonne la valeur des positions d'un compte. |
| Ordres par jour | Bloque une fois le quota du jour atteint. |
| Perte journalière maximale | Coupe les exécutions quand les pertes du jour atteignent le seuil. |
| Pertes consécutives maximales | Coupe après N trades perdants d'affilée. |
| Stop-loss obligatoire | Refuse les signaux futures et crypto sans stop-loss. |
| Validation manuelle au-delà de | **Ne refuse pas** : bascule l'ordre en attente d'approbation. |
| Plage horaire autorisée | Refuse hors des heures de marché configurées. |

> Le seuil « Plage horaire autorisée » est actif par défaut (09:30–16:00 heure de New York). Si vous testez le soir, vos signaux seront refusés : c'est normal. Désactivez-le le temps de vos essais.

### Les alertes

Au-delà de la cloche dans l'application, les événements importants peuvent être poussés vers **Slack, Discord, une URL de votre choix ou par e-mail**. Le seuil de déclenchement est réglable (par défaut : avertissements et erreurs). Demandez la configuration à votre équipe technique.

### Les secrets

Chaque stratégie a un secret qui authentifie les messages entrants. Régénérez-le si vous suspectez une fuite, si un prestataire cesse d'intervenir, ou périodiquement par précaution.

> Régénérer un secret coupe immédiatement la source qui utilise l'ancien. Prévenez avant, et prévoyez la mise à jour dans la foulée.

### La validation manuelle

Le mode le plus sûr. Chaque ordre attend votre feu vert. Recommandé pour toute nouvelle stratégie, pour les montants importants, et à chaque modification significative d'un indicateur.

---

## 7. Routines conseillées

**En début de séance**
- Vue d'ensemble : le coupe-circuit est-il bien désactivé ?
- Connexions : tous les comptes sont-ils actifs ? Le pouvoir d'achat est-il suffisant ?
- Ordres : reste-t-il des ordres en attente de la veille ?

**Pendant la séance**
- Activez **Flux temps réel** sur la Vue d'ensemble.
- Traitez les ordres « En attente » sans les laisser vieillir : un ordre approuvé trop tard part à un prix qui n'a plus rien à voir avec le signal.
- Surveillez le taux d'acceptation : une chute soudaine signale un problème de source ou une règle trop restrictive.

**En fin de séance**
- Positions : revue des positions ouvertes et du P&L.
- Webhooks : parcourez les signaux refusés, cherchez les motifs récurrents.
- Enclenchez le coupe-circuit si vous ne souhaitez aucune exécution pendant la nuit.

**Chaque semaine**
- Historique : relisez le journal d'audit.
- Ajustez les plafonds des stratégies au vu des refus observés.
- Exportez ordres et positions pour votre suivi.

---

## 8. Exports et reporting

Quatre exports au format CSV, ouvrables directement dans Excel :

| Écran | Bouton | Contenu |
|---|---|---|
| Ordres | Exporter (CSV) | Les lignes **actuellement filtrées** |
| Positions | Exporter (CSV) | Les positions ouvertes |
| Historique | Exporter le journal | Le journal d'audit filtré |
| Historique | Exporter (section Signaux) | L'historique des signaux |

> Astuce : filtrez **avant** d'exporter depuis l'écran Ordres. L'export reprend exactement ce que vous voyez à l'écran.

Les écrans Ordres et Historique n'affichent que les entrées les plus récentes. Un bouton **Charger plus** apparaît en bas de liste dès qu'il reste des éléments plus anciens, avec le total disponible.

---

## 9. Ce que la plateforme ne fait pas encore

Points à connaître avant d'engager de l'argent réel.

1. **Aucun écran d'administration des comptes.** Les nouveaux utilisateurs s'inscrivent avec un code d'invitation ; changer le rôle de quelqu'un demande une intervention technique.
2. **Un seul courtier branché.** Seul Alpaca dispose d'un connecteur. Toute autre connexion reste simulée, quel que soit l'environnement choisi.
3. **Les prix affichés sont simulés.** La valorisation des positions et le P&L reposent sur une variation aléatoire, pas sur une source de cotation réelle. Ils servent à valider vos règles, pas à mesurer une performance.
4. **Les exécutions partielles** sont affichées mais le reliquat n'est pas suivi séparément.
5. **Le suivi des pertes consécutives** est global à la plateforme, pas par stratégie ni par compte.
---

## 10. Questions fréquentes

**Ma stratégie est active, mais rien ne se passe.**
Elle n'est probablement branchée à aucun compte. Ouvrez-la et vérifiez la section « Souscriptions ».

**Un signal a créé trois ordres au lieu d'un.**
Normal : la stratégie est branchée à trois comptes. Un ordre est créé par compte.

**Puis-je envoyer le même signal à plusieurs comptes avec des tailles différentes ?**
Oui. Créez un abonnement par compte, chacun avec son propre dimensionnement.

**Comment mettre une stratégie en pause sans rien perdre ?**
Ouvrez-la et cliquez sur **Suspendre**. Tout est conservé, y compris les branchements.

**Un ordre reste en « Soumis » sans avancer.**
Il progresse dès que quelqu'un consulte le tableau de bord. Ouvrez la Vue d'ensemble et patientez quelques secondes. Si cela persiste, signalez-le à votre équipe technique.

**Comment tester sans risque ?**
Trois niveaux cumulables : environnement « Simulation » sur la connexion, statut « Brouillon » sur la stratégie, mode « Validation manuelle » sur l'abonnement.

**J'ai supprimé une stratégie par erreur.**
Elle n'est pas récupérable, pas plus que ses abonnements. Il faut la recréer, et la source de signaux devra être reconfigurée avec la nouvelle adresse et le nouveau secret.

**Que se passe-t-il si mon indicateur envoie deux fois le même signal ?**
Avec « Rejeter les doublons » activé, le second est ignoré et marqué « Dupliqué ». Cela suppose que votre source envoie un identifiant de signal stable.

**Les chiffres de P&L sont-ils fiables ?**
Non, ils reposent sur des prix simulés. Ils permettent de valider le fonctionnement de vos règles, pas d'évaluer une performance.

**Mes signaux sont refusés le soir ou le week-end.**
Le seuil « Plage horaire autorisée » est actif par défaut sur 09:30–16:00 heure de New York. Désactivez-le sur l'écran Risque, ou élargissez la plage.

**Un ordre est passé en « En attente » alors que mon abonnement est automatique.**
C'est le seuil « Validation manuelle au-delà de » qui s'est appliqué : le montant dépassait la limite. Approuvez-le, ou relevez le seuil.

**Je suis renvoyé vers l'écran de connexion en pleine session.**
Votre session a expiré (7 jours) ou a été fermée ailleurs. Reconnectez-vous : aucune donnée n'est perdue.

**Un collègue n'arrive pas à s'inscrire.**
Les inscriptions exigent un code d'invitation dès qu'un compte existe. Transmettez-lui celui fourni par votre administrateur.

**Je ne peux rien modifier, tous les boutons échouent.**
Votre compte est probablement en rôle « lecture », qui autorise la consultation mais aucune modification. Demandez un changement de rôle.
