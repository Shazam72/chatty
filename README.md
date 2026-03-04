### Objectif du projet
Développer une application de messagerie instantanée permettant des discussions en groupe et des messages privés (DMs) entre utilisateurs connectés.

#### Stack Technique

- Serveur : Node.js & Express
- Communication : Socket.io (WebSockets)
- Base de données : MongoDB ou PostgreSQL (pour l'historique)
- Frontend : React ou HTML/JS classique

#### Fonctionnalités à implémenter

##### 1. Gestion de la Présence
  - Système d'identification simple (Pseudo/Login).
  - Affichage en temps réel de la liste des utilisateurs connectés dans une barre latérale.
  - Mise à jour automatique de la liste lors d'une déconnexion.

##### 2. Système de Salons (Rooms)
  - Salon Général : Un espace commun où tout le monde peut lire et écrire dès la connexion.
  - Groupes Thématiques : Possibilité de rejoindre des salons spécifiques par nom.
  - Messages Privés (DMs) : Création de salons isolés entre deux utilisateurs uniquement.

##### 3. Persistance des Données
  - Sauvegarde des messages en base de données.
  - Chargement de l'historique récent lorsqu'un utilisateur rejoint une discussion.

#### Étapes de Développement (Roadmap)
- Phase 1 : Setup Socket.io
  
  Établir la connexion de base. Le serveur doit logger chaque nouvel arrivant et lui attribuer une identité temporaire.

- Phase 2 : Diffusion des Utilisateurs:
  
  Le serveur doit envoyer la liste des pseudos actifs à tous les clients dès qu'un changement survient (entrée/sortie).

- Phase 3 : Logique des Messages Privés:
  
  Implémenter un système de "room ID" unique pour les DMs. L'astuce consiste à générer un identifiant basé sur les deux pseudos (ex: user1_user2) pour s'assurer qu'ils se retrouvent dans le même canal privé.

- Phase 4 : Base de Données:
  
  Relier les événements d'envoi de message à une insertion en base de données pour éviter la perte de données au rafraîchissement de la page.
