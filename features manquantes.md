voir dossier non versionné features manquantes avec des screenshots des deltas
se référer au code original pour implémenter ces features
attention, j'ai eu l'appli qui s'est lancée en anglais, aucun moyen de la repasser en français, faut bien porter la version française.

# priorité 1
- notion de status sur les poules pour des joueurs, coche verte dans le cas nominal, quels sont les 2 autres status?
- possibilité de programmer les poules soit par nombre de poule, soit par taille (6 ou 7, 7 ou 8)
- système de latecomer (a voir les controles de cohérence à appliquer et dans quelles modalités)
- sur les pages de match de tableau, il va manquer le champ signature
- fenced places: éclaircir pourquoi l'ancienne application avait 3 options
- liste plus fine des catégories (M20 etc...)
- data affichable. Pour simplifier le fonctionnement, demander lors de la création du tournoi de cocher les informations a demander sous forme d'un tableau ou d'abord on peut cocher si c'est demandé, si c'est affiché sur le rapport de présence des joueurs, sur les fiches de match et sur le tableau des résultats. Comme ça pas besoin de le coder à plein d'endroits dans l'application. Mettre par défaut comme dans l'ancienne app
- automatic score stuffing => c'est quoi? C'est incompréhensible à quoi ça sert dans l'ancienne app
- règle de taille d'équipe. Si une équipe est inférieur à la taille minimum paramétrée dans la compétition, elle ne peut pas être considérée présente. Du coup le réglage n'est possible qu'en compétition de type tournoi


# priorité 2
- système de "carreau pique, trèfle coeur" non identifié, semble être pour cibler des poules
- report des ligues, régions et licences
- export final au format FFF
- critères de swapping lors de la répartition des poules (a voir quel intérêt ça a)
- header de couleur configurable affiché d'une part dans l'interface de l'appli (au niveau du fil d'ariane avec possibilié de passer d'une compétition a une autre au sein d'un tournoi) et en header des imprimables

# priorité 3
- dans le fichier des poules, il y a bien le tableau, les signatures sont à côté. L'appli doit permettre de configurer les infos affichées sur la feuille de poule. Lorsque trop d'infos sont affichées, le contenu est réduit pour tenir dans une a4.
- création d'un rapport pdf et html
- team classification: manually assigned vs derived from fencer
