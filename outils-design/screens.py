# Les aperçus de l'application : chaque fonction renvoie le contenu de la zone principale (x 206 → 940, y 66 → 610).
from kit import *

X0, X1 = 214, 936          # zone utile
CW = X1 - X0               # 722


def head(title, sub, y=84, right=''):
    return t(X0, y, title, 22, C['text'], 800) + t(X0, y + 20, sub, 12, C['muted']) + right


# ───────────────────────── 1. Tableau de bord
def dash():
    b = [head('Bonjour Awa', "Voici l'état de votre entreprise ce mardi")]
    kw = 166; gap = 19
    k = [('Demandes ouvertes', '12', '+3 depuis hier', C['pink'], [4, 6, 5, 8, 7, 10, 12]), ('Projets en cours', '5', '2 en retard', C['blue'], [3, 3, 4, 4, 5, 5, 5]),
         ('Solde du mois', '315 000', '+18 % vs septembre', C['green'], [120, 150, 170, 160, 230, 260, 315]), ('Équipe', '8', '2 en congé', C['amber'], [6, 7, 8, 8, 8, 8, 8])]
    for i, (lb, v, d, col, sp) in enumerate(k):
        b.append(kpi(X0 + i * (kw + gap), 128, kw, 98, lb, v, d, col, sp))
    # graphique
    b.append(card(X0, 242, 452, 220) + t(X0 + 18, 268, 'Entrées et sorties', 13.5, C['text'], 700) + t(X0 + 18, 285, '6 derniers mois, en FCFA', 11, C['muted']))
    b.append(area_chart(X0 + 22, 304, 408, 124, [([210, 260, 240, 330, 310, 420, 480], C['green'], False), ([150, 170, 190, 200, 230, 240, 260], C['pink'], True)], labels=['Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct']))
    b.append('<circle cx="%d" cy="272" r="4" fill="%s"/>' % (X0 + 300, C['green']) + t(X0 + 310, 276, 'Entrées', 10.5, C['muted']) + '<circle cx="%d" cy="272" r="4" fill="%s"/>' % (X0 + 366, C['pink']) + t(X0 + 376, 276, 'Sorties', 10.5, C['muted']))
    # point de situation IA
    b.append(card(X0 + 468, 242, 254, 220, fill=C['panel2']) + icon('ai', X0 + 484, 258, 18, C['amber']) + t(X0 + 510, 272, 'Point de situation IA', 13, C['text'], 700))
    ia = [('3 factures en retard : 412 000 FCFA à relancer', C['red']), ('Stock critique : tissu wax rouge (4 restants)', C['amber']), ('Marie demande 2 jours de congé vendredi', C['blue']), ('Les ventes ont progressé de 18 %', C['green'])]
    for i, (s, col) in enumerate(ia):
        yy = 298 + i * 34
        b.append(f'<circle cx="{X0+490}" cy="{yy}" r="4" fill="{col}"/>' + t(X0 + 502, yy + 4, s, 11, C['text'], 500))
    b.append(btn(X0 + 486, 428, 120, 'Voir les alertes', False, 26, 11) + btn(X0 + 614, 428, 96, 'Demander', True, 26, 11))
    # à faire
    b.append(card(X0, 478, CW, 118) + t(X0 + 18, 504, "À faire aujourd'hui", 13.5, C['text'], 700))
    todo = [('Valider la commande de tissu (fournisseur Wax Douala)', 'Stock', C['amber']), ('Répondre à M. Njoya : devis boutique en ligne', 'Clients', C['blue']), ('Relancer la facture F-2026-0031 (échue depuis 9 jours)', 'Ventes', C['pink'])]
    for i, (s, tag, col) in enumerate(todo):
        yy = 526 + i * 24
        b.append(f'<circle cx="{X0+26}" cy="{yy}" r="7" fill="none" stroke="{C["line2"]}" stroke-width="1.5"/>' + t(X0 + 44, yy + 4, s, 11.5, C['text'], 500) + chip(X0 + CW - 18, yy - 10, tag, col, 20, 10, True, 'end')[0])
    return ''.join(b)


# ───────────────────────── 2. Service client
def support():
    b = [head('Service client', '12 demandes ouvertes, 3 urgentes', right=btn(X1 - 140, 74, 140, '+ Nouvelle demande', True, 30, 11.5))]
    b.append(card(X0, 128, 300, 468))
    rows = [('Kofi Mensah', 'Livraison en retard', 'WhatsApp', C['green'], 'Urgent', C['red'], 'KM', C['pink']), ('Njoya SARL', 'Devis boutique en ligne', 'Formulaire', C['blue'], 'Normal', C['amber'], 'NS', C['blue']),
            ('Aïcha Bello', 'Changer une couleur', 'WhatsApp', C['green'], 'Normal', C['amber'], 'AB', C['purple']), ('Paul Fotso', 'Facture à renvoyer', 'E-mail', C['amber'], 'Bas', C['muted'], 'PF', C['green']), ('Grace Tamba', 'Question sur les prix', 'Messenger', C['blue'], 'Normal', C['amber'], 'GT', C['amber']),
            ('Hamidou Y.', 'Réclamation produit', 'WhatsApp', C['green'], 'Urgent', C['red'], 'HY', C['pink'])]
    for i, (n, s, ch, cc, pr, pc, ini, ac) in enumerate(rows):
        yy = 142 + i * 72
        if i == 0:
            b.append(rect(X0 + 8, yy, 284, 66, 12, '#4a7bff22', '#6f9bff55'))
        b.append(avatar(X0 + 34, yy + 33, ini, ac, 16) + t(X0 + 60, yy + 28, n, 12.5, C['text'], 700) + t(X0 + 60, yy + 46, s, 11, C['muted']) + chip(X0 + 284, yy + 12, pr, pc, 18, 9.5, True, 'end')[0] + chip(X0 + 284, yy + 38, ch, cc, 18, 9.5, False, 'end')[0])
    # détail
    dx = X0 + 316; dw = CW - 316
    b.append(card(dx, 128, dw, 468))
    b.append(avatar(dx + 30, 160, 'KM', C['pink'], 16) + t(dx + 56, 156, 'Kofi Mensah', 13.5, C['text'], 700) + t(dx + 56, 173, 'WhatsApp · il y a 12 min', 10.5, C['muted']) + chip(dx + dw - 18, 150, 'Urgent', C['red'], 22, 10.5, True, 'end')[0])
    b.append(f'<line x1="{dx+18}" y1="188" x2="{dx+dw-18}" y2="188" stroke="#ffffff12"/>')
    b.append(rect(dx + 18, 202, 330, 78, 14, '#ffffff0f') + t(dx + 34, 226, "Bonjour, ma commande de lundi n'est toujours pas", 11.5, C['text']) + t(dx + 34, 244, 'arrivée. Elle devait être livrée hier à Bonamoussadi.', 11.5, C['text']) + t(dx + 34, 262, 'Pouvez-vous me dire où elle est ?', 11.5, C['text']))
    b.append(rect(dx + 18, 296, dw - 36, 190, 14, '#4a7bff1f', '#6f9bff44') + icon('ai', dx + 32, 308, 16, C['blue']) + t(dx + 54, 321, 'Brouillon rédigé par l\'IA', 12, C['blue'], 700) + chip(dx + dw - 32, 306, 'à relire', C['amber'], 20, 10, True, 'end')[0])
    lines = ["Bonjour M. Mensah,", "Je suis désolé pour ce retard. Votre commande C-2026-0048 est", "partie ce matin avec notre livreur et arrivera avant 17 h.", "Je vous écris dès qu'elle est remise. Merci de votre patience.", "", "L'équipe Boutique Awa"]
    for i, s in enumerate(lines):
        b.append(t(dx + 34, 348 + i * 20, s, 11.5, C['text'], 400 if i not in (0, 5) else 600))
    b.append(btn(dx + 32, 450, 90, 'Modifier', False, 28, 11.5) + btn(dx + 130, 450, 130, 'Envoyer la réponse', True, 28, 11.5))
    b.append(t(dx + 18, 514, "L'IA propose, vous validez : rien ne part sans votre clic.", 11, C['muted']) + t(dx + 18, 534, 'Historique : 3 messages · client depuis mars 2026', 11, C['dim']))
    b.append(chip(dx + 18, 552, 'Commande C-2026-0048', C['blue'], 22, 10.5)[0] + chip(dx + 160, 552, '2 robes wax · 30 000 FCFA', C['green'], 22, 10.5, False)[0])
    return ''.join(b)


# ───────────────────────── 3. Projets
def projets():
    b = [head('Lancer la boutique en ligne', 'Projet · échéance 30 novembre · 7 tâches sur 12 terminées', right=chip(X1, 76, '58 %', C['green'], 26, 12, True, 'end')[0])]
    b.append(progress(X0, 118, CW, 58, C['green'], 8))
    cols = [('À faire', C['muted'], [('Choisir le nom de domaine', 'Haute', C['red'], 'AB', C['purple'], '8 nov.', 0), ('Photographier 20 produits', 'Normale', C['amber'], 'KM', C['pink'], '12 nov.', 0), ('Rédiger les conditions de vente', 'Basse', C['muted'], 'PF', C['green'], '20 nov.', 0)]),
            ('En cours', C['blue'], [('Créer la page catalogue', 'Haute', C['red'], 'AT', C['amber'], '10 nov.', 60), ('Brancher le paiement Mobile Money', 'Haute', C['red'], 'PF', C['green'], '14 nov.', 35), ('Écrire les fiches produits', 'Normale', C['amber'], 'GT', C['amber'], '16 nov.', 70)]),
            ('Terminé', C['green'], [('Définir le catalogue de prix', 'Normale', C['amber'], 'AT', C['amber'], '2 nov.', 100), ('Choisir la livraison', 'Normale', C['amber'], 'KM', C['pink'], '3 nov.', 100), ('Ouvrir le compte Mobile Money', 'Haute', C['red'], 'AB', C['purple'], '4 nov.', 100)])]
    cw = 228; gap = 19
    for i, (name, col, cards) in enumerate(cols):
        x = X0 + i * (cw + gap)
        b.append(rect(x, 140, cw, 456, 16, '#ffffff08', C['line']) + f'<circle cx="{x+20}" cy="166" r="5" fill="{col}"/>' + t(x + 34, 170, name, 13, C['text'], 700) + chip(x + cw - 14, 156, str(len(cards)), col, 20, 10, True, 'end')[0])
        for j, (title, pr, pc, who, wc, due, pct) in enumerate(cards):
            y = 188 + j * 134
            b.append(card(x + 12, y, cw - 24, 120, 12, C['panel2']) + t(x + 26, y + 26, title, 12, C['text'], 700) + chip(x + 26, y + 38, pr, pc, 18, 9.5)[0])
            if pct:
                b.append(progress(x + 26, y + 72, cw - 52, pct, col if pct < 100 else C['green'], 5) + t(x + cw - 26, y + 66, f'{pct} %', 10, C['muted'], 600, 'end'))
            b.append(avatar(x + 38, y + 98, who, wc, 11) + icon('clock', x + cw - 100, y + 90, 13, C['muted']) + t(x + cw - 82, y + 101, due, 10.5, C['muted'], 500))
    return ''.join(b)


# ───────────────────────── 4. Budget
def budget():
    b = [head('Budget', 'Octobre 2026 · Boutique Awa', right=btn(X1 - 120, 74, 120, '+ Ajouter', True, 30, 11.5))]
    kw = 232; gap = 13
    for i, (lb, v, col, d) in enumerate([('Entrées', '1 250 000', C['green'], '+12 % vs sept.'), ('Sorties', '935 000', C['pink'], '+4 % vs sept.'), ('Solde du mois', '315 000', C['blue'], 'Objectif : 300 000')]):
        b.append(kpi(X0 + i * (kw + gap), 128, kw, 92, lb, v + ' FCFA', d, col))
    b.append(card(X0, 236, 380, 230) + t(X0 + 18, 262, 'Entrées par mois', 13.5, C['text'], 700) + t(X0 + 18, 279, 'en milliers de FCFA', 11, C['muted']))
    b.append(bars(X0 + 24, 298, 332, 130, [820, 910, 760, 1040, 1120, 1250], C['blue'], ['Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct'], 0.4, C['green']))
    b.append(card(X0 + 396, 236, 326, 230) + t(X0 + 414, 262, 'Dépenses par catégorie', 13.5, C['text'], 700))
    b.append(donut(X0 + 480, 366, 52, [(380, C['blue']), (250, C['amber']), (180, C['pink']), (125, C['purple'])], 17) + t(X0 + 480, 362, '935 k', 17, C['text'], 800, 'middle') + t(X0 + 480, 378, 'FCFA', 10, C['muted'], 600, 'middle'))
    for i, (lb, v, col) in enumerate([('Achats', '40 %', C['blue']), ('Salaires', '27 %', C['amber']), ('Loyer', '19 %', C['pink']), ('Divers', '14 %', C['purple'])]):
        yy = 318 + i * 32
        b.append(f'<circle cx="{X0+570}" cy="{yy}" r="5" fill="{col}"/>' + t(X0 + 582, yy + 4, lb, 11.5, C['text'], 500) + t(X0 + 706, yy + 4, v, 11.5, C['muted'], 700, 'end'))
    b.append(card(X0, 482, CW, 114) + t(X0 + 18, 506, 'Derniers mouvements', 13, C['text'], 700))
    rows = [('Paiement F-2026-0027', 'Ventes', '+ 119 250', C['green']), ('Commande #14 : tissu wax', 'Achats', '− 240 000', C['pink']), ('Loyer octobre', 'Loyer', '− 150 000', C['pink'])]
    for i, (lb, cat, am, col) in enumerate(rows):
        yy = 530 + i * 22
        b.append(t(X0 + 18, yy, lb, 11.5, C['text'], 500) + t(X0 + 300, yy, cat, 11, C['muted']) + t(X0 + CW - 18, yy, am + ' FCFA', 11.5, col, 700, 'end'))
    return ''.join(b)


# ───────────────────────── 5. Organisation
def organisation():
    b = [head('Organisation', 'Qui fait quoi, et qui manque', right=btn(X1 - 190, 74, 190, "Proposer des postes (IA)", True, 30, 11.5))]

    def node(cx, y, name, role, col, ini, w=170, dashed=False):
        x = cx - w / 2
        s = card(x, y, w, 64, 14, C['panel2'] if not dashed else '#ffffff08')
        if dashed:
            s = f'<rect x="{x+.5}" y="{y+.5}" width="{w-1}" height="63" rx="14" fill="#ffffff06" stroke="{col}" stroke-dasharray="5 5" opacity=".9"/>'
        return s + avatar(x + 28, y + 32, ini, col, 16) + t(x + 54, y + 29, name, 12, C['text'], 700) + t(x + 54, y + 46, role, 10.5, C['muted'])
    cx = X0 + CW / 2
    b.append(node(cx, 132, 'Awa Tchoua', 'Directrice générale', C['amber'], 'AT', 190))
    xs = [X0 + 120, cx, X0 + CW - 120]
    for x in xs:
        b.append(f'<path d="M{cx} 196 V222 H{x} V244" fill="none" stroke="#ffffff30" stroke-width="1.6"/>')
    b.append(node(xs[0], 244, 'Paul Fotso', 'Resp. ventes', C['green'], 'PF', 190) + node(xs[1], 244, 'Marie Kamga', 'Resp. stock', C['blue'], 'MK', 190) + node(xs[2], 244, 'Poste à créer', 'Resp. comptabilité', C['pink'], '+', 190, True))
    for x, kids in [(xs[0], [('Kofi M.', 'Vendeur', C['pink'], 'KM'), ('Aïcha B.', 'Vendeuse', C['purple'], 'AB')]), (xs[1], [('Hamidou Y.', 'Magasinier', C['green'], 'HY')])]:
        for j, (n, r, col, ini) in enumerate(kids):
            yy = 330 + j * 76
            b.append(f'<path d="M{x-60} 308 V{yy+32} H{x-48}" fill="none" stroke="#ffffff30" stroke-width="1.5"/>' + node(x + 38, yy, n, r, col, ini, 172))
    b.append(card(X0, 498, CW, 98, 16, C['panel2']) + icon('ai', X0 + 16, 510, 17, C['amber']) + t(X0 + 40, 523, "Suggestions de l'IA", 12.5, C['text'], 700))
    sug = [('Créer un poste de comptable', 'Trois personnes saisissent déjà des chiffres :', 'un seul responsable évitera les erreurs.', C['pink']), ('Nommer un adjoint aux ventes', 'Paul encadre 6 personnes : au-delà,', 'le suivi se dégrade.', C['blue'])]
    for i, (h1, l1, l2, col) in enumerate(sug):
        x = X0 + 14 + i * 346
        b.append(f'<rect x="{x}" y="534" width="334" height="52" rx="12" fill="#ffffff0a"/>' + t(x + 14, 553, h1, 11.5, col, 700) + t(x + 14, 568, l1, 10, C['muted']) + t(x + 14, 580, l2, 10, C['muted']))
    return ''.join(b)


# ───────────────────────── 6. Fonctionnement (procédures)
def fonctionnement():
    b = [head('Fonctionnement', 'Les procédures de votre entreprise', right=btn(X1 - 170, 74, 170, '+ Nouvelle procédure', True, 30, 11.5))]
    b.append(card(X0, 128, 250, 468))
    procs = [('Accueil d\'un client', 'Ventes', True), ('Réception du stock', 'Stock', False), ('Clôture de caisse', 'Budget', False), ('Traitement d\'une réclamation', 'Service client', False), ('Intégrer un employé', 'RH', False)]
    for i, (n, cat, on) in enumerate(procs):
        yy = 142 + i * 78
        if on:
            b.append(rect(X0 + 8, yy, 234, 70, 12, '#4a7bff22', '#6f9bff55'))
        b.append(icon('projets', X0 + 22, yy + 14, 18, C['blue'] if on else C['muted']) + t(X0 + 50, yy + 28, n, 12, C['text'], 700) + chip(X0 + 50, yy + 38, cat, C['blue'] if on else C['muted'], 20, 10)[0])
    dx = X0 + 266; dw = CW - 266
    b.append(card(dx, 128, dw, 468) + t(dx + 22, 158, "Accueil d'un client", 17, C['text'], 800) + chip(dx + 22, 170, 'Ventes', C['blue'], 22, 10.5)[0] + t(dx + 96, 185, 'Mise à jour il y a 2 jours · par Awa', 11, C['muted']))
    b.append(donut(dx + dw - 56, 168, 28, [(5, C['green']), (2, '#ffffff18')], 7) + t(dx + dw - 56, 173, '5/7', 12, C['text'], 800, 'middle'))
    steps = [('Saluer le client avec un sourire', True), ("Demander ce qu'il cherche", True), ('Proposer deux articles adaptés', True), ('Annoncer le prix exact', True), ('Proposer le paiement Mobile Money', True), ("Noter ses coordonnées pour la fidélisation", False), ("Le remercier et l'inviter à revenir", False)]
    for i, (s, ok) in enumerate(steps):
        yy = 224 + i * 44
        b.append(rect(dx + 18, yy, dw - 36, 36, 10, '#ffffff08'))
        if ok:
            b.append(f'<circle cx="{dx+40}" cy="{yy+18}" r="10" fill="{C["green"]}"/>' + icon('check', dx + 33, yy + 11, 14, '#06251a', 2.6))
        else:
            b.append(f'<circle cx="{dx+40}" cy="{yy+18}" r="10" fill="none" stroke="{C["line2"]}" stroke-width="1.6"/>')
        b.append(t(dx + 62, yy + 22, s, 12, C['text'] if not ok else C['muted'], 500 if not ok else 400))
    b.append(icon('ai', dx + 22, 540, 16, C['amber']) + t(dx + 44, 553, "Décrivez, l'IA rédige la procédure.", 11.5, C['muted']) + btn(dx + dw - 138, 534, 120, "Générer (IA)", False, 28, 11))
    return ''.join(b)


# ───────────────────────── 7. Équipe et antennes
def equipe():
    b = [head('Équipe et antennes', '8 personnes · 2 antennes', right=btn(X1 - 150, 74, 150, '+ Inviter quelqu\'un', True, 30, 11.5))]
    b.append(card(X0, 128, 440, 468) + t(X0 + 18, 154, 'Membres', 13.5, C['text'], 700))
    mem = [('Awa Tchoua', 'Propriétaire', C['amber'], 'AT', 'Douala'), ('Paul Fotso', 'Administrateur', C['green'], 'PF', 'Douala'), ('Marie Kamga', 'Responsable', C['blue'], 'MK', 'Douala'), ('Kofi Mensah', 'Membre', C['pink'], 'KM', 'Yaoundé'), ('Aïcha Bello', 'Membre', C['purple'], 'AB', 'Yaoundé'), ('Hamidou Yaya', 'Membre', C['green'], 'HY', 'Douala'), ('Grace Tamba', 'Membre', C['amber'], 'GT', 'Yaoundé')]
    for i, (n, role, col, ini, ant) in enumerate(mem):
        yy = 170 + i * 58
        b.append(rect(X0 + 12, yy, 416, 50, 12, '#ffffff08') + avatar(X0 + 40, yy + 25, ini, col, 16) + t(X0 + 66, yy + 22, n, 12.5, C['text'], 700) + t(X0 + 66, yy + 38, ant, 10.5, C['muted']) + chip(X0 + 416, yy + 15, role, col, 22, 10.5, True, 'end')[0])
    rx = X0 + 456; rw = CW - 456
    b.append(card(rx, 128, rw, 190) + t(rx + 18, 154, 'Antennes', 13.5, C['text'], 700))
    for i, (n, loc, cnt, col) in enumerate([('Douala · Akwa', 'Siège', '5 personnes', C['blue']), ('Yaoundé · Bastos', 'Boutique', '3 personnes', C['green'])]):
        yy = 170 + i * 66
        b.append(rect(rx + 12, yy, rw - 24, 58, 12, '#ffffff0a') + f'<circle cx="{rx+38}" cy="{yy+29}" r="14" fill="{col}" opacity=".2"/>' + icon('structure' if 'structure' in ICON else 'stock', rx + 30, yy + 21, 16, col) + t(rx + 62, yy + 26, n, 12, C['text'], 700) + t(rx + 62, yy + 43, loc + ' · ' + cnt, 10.5, C['muted']))
    b.append(card(rx, 334, rw, 262, 16, C['panel2']) + t(rx + 18, 360, 'Inviter par lien', 13.5, C['text'], 700) + t(rx + 18, 378, 'Le lien expire dans 7 jours et ne sert qu\'une fois.', 10.5, C['muted']))
    b.append(rect(rx + 18, 396, rw - 36, 40, 12, '#00000040', C['line2']) + t(rx + 32, 421, 'manager-ia.com/rejoindre/Kq9x…', 11.5, C['muted'], 500) + btn(rx + rw - 96, 402, 70, 'Copier', True, 28, 11))
    b.append(t(rx + 18, 462, 'Rôle de la personne invitée', 11, C['muted'], 600))
    for i, (r, col, on) in enumerate([('Membre', C['blue'], True), ('Responsable', C['green'], False), ('Admin', C['amber'], False)]):
        b.append(chip(rx + 18 + i * 92, 474, r, col, 26, 11, on)[0])
    b.append(t(rx + 18, 530, 'Chaque rôle voit seulement ce qui le concerne :', 11, C['muted']) + t(rx + 18, 548, 'les salaires, par exemple, ne sont visibles que', 11, C['muted']) + t(rx + 18, 566, 'par les administrateurs et la propriétaire.', 11, C['muted']))
    return ''.join(b)


# ───────────────────────── 8. Stock et achats
def stock():
    b = [head('Stock et achats', '2 articles critiques · 1 commande à valider', right=btn(X1 - 150, 74, 150, '+ Ajouter un article', True, 30, 11.5))]
    b.append(card(X0, 128, 440, 468) + t(X0 + 18, 154, 'Articles', 13.5, C['text'], 700))
    b.append(t(X0 + 18, 178, 'ARTICLE', 9.5, C['dim'], 700) + t(X0 + 190, 178, 'STOCK', 9.5, C['dim'], 700) + t(X0 + 416, 178, 'ÉTAT', 9.5, C['dim'], 700, 'end'))
    items = [('Tissu wax rouge', 4, 40, 'Critique', C['red']), ('Tissu wax bleu', 9, 40, 'Critique', C['red']), ('Fil de couture', 22, 60, 'Bas', C['amber']), ('Boutons nacrés', 140, 200, 'OK', C['green']), ('Sacs en papier', 310, 300, 'OK', C['green']), ('Étiquettes', 520, 400, 'OK', C['green']), ('Cintres', 86, 120, 'Bas', C['amber'])]
    for i, (n, q, mx, st, col) in enumerate(items):
        yy = 192 + i * 56
        b.append(rect(X0 + 12, yy, 416, 48, 12, '#ffffff08') + t(X0 + 28, yy + 21, n, 12.5, C['text'], 700) + t(X0 + 28, yy + 37, f'seuil : {mx}', 10, C['dim']) + progress(X0 + 190, yy + 21, 84, min(100, q / mx * 100), col, 7) + t(X0 + 288, yy + 26, str(q), 12, C['text'], 700) + chip(X0 + 416, yy + 14, st, col, 22, 10.5, True, 'end')[0])
    rx = X0 + 456; rw = CW - 456
    b.append(card(rx, 128, rw, 468, 16, C['panel2']) + icon('ai', rx + 18, 144, 18, C['amber']) + t(rx + 44, 158, 'Commande à valider', 13.5, C['text'], 700) + t(rx + 44, 175, "Proposée par l'IA", 10.5, C['amber'], 600))
    b.append(t(rx + 18, 204, 'Tissu wax rouge · 120 pièces', 13, C['text'], 800) + t(rx + 18, 222, 'Stock : 4 · seuil : 40 · ventes : 35/mois', 10.5, C['muted']))
    for i, (f, p, d, best) in enumerate([('Wax Douala', '2 000 / pièce', '2 jours', True), ('Textiles du Wouri', '2 150 / pièce', '5 jours', False), ('Import Lagos', '1 900 / pièce', '12 jours', False)]):
        yy = 238 + i * 62
        b.append(rect(rx + 14, yy, rw - 28, 54, 12, '#4a7bff22' if best else '#ffffff08', '#6f9bff66' if best else None) + t(rx + 28, yy + 22, f, 12, C['text'], 700) + t(rx + 28, yy + 40, p + ' · livraison ' + d, 10.5, C['muted']) + (chip(rx + rw - 26, yy + 15, 'Conseillé', C['green'], 22, 10, True, 'end')[0] if best else ''))
    b.append(rect(rx + 14, 434, rw - 28, 62, 12, '#ffffff0c') + t(rx + 28, 458, 'Total estimé', 11, C['muted']) + t(rx + 28, 482, '240 000 FCFA', 17, C['text'], 800) + t(rx + rw - 28, 482, 'Livraison 22 oct.', 10.5, C['muted'], 500, 'end'))
    b.append(btn(rx + 14, 512, 118, 'Valider', True, 32, 12) + btn(rx + 142, 512, 100, 'Refuser', False, 32, 12))
    b.append(t(rx + 18, 565, "Aucune commande ne part sans l'accord", 10.5, C['dim']) + t(rx + 18, 580, "d'une autre personne que le demandeur.", 10.5, C['dim']))
    return ''.join(b)


# ───────────────────────── 9. Clients et ventes
def clients():
    b = [head('Clients et ventes', 'Devis, factures et paiements', right=btn(X1 - 130, 74, 130, '+ Nouvelle facture', True, 30, 11.5))]
    kw = 232; gap = 13
    for i, (lb, v, col, d) in enumerate([('Facturé ce mois', '2 480 000', C['blue'], '+9 %'), ('Encaissé', '1 868 000', C['green'], '75 % du facturé'), ('Impayés', '412 000', C['red'], '3 factures en retard')]):
        b.append(kpi(X0 + i * (kw + gap), 128, kw, 92, lb, v + ' FCFA', d, col))
    b.append(card(X0, 236, 430, 360) + t(X0 + 18, 262, 'Factures', 13.5, C['text'], 700))
    b.append(t(X0 + 18, 286, 'NUMÉRO · CLIENT', 9.5, C['dim'], 700) + t(X0 + 412, 286, 'MONTANT · ÉTAT', 9.5, C['dim'], 700, 'end'))
    inv = [('F-2026-0031', 'Njoya SARL', '119 250', 'En retard', C['red']), ('F-2026-0030', 'Grace Tamba', '45 000', 'Envoyée', C['blue']), ('F-2026-0029', 'Kofi Mensah', '30 000', 'Payée', C['green']), ('F-2026-0028', 'Boutique Kilo', '212 500', 'En retard', C['red']), ('F-2026-0027', 'Aïcha Bello', '119 250', 'Payée', C['green']), ('F-2026-0026', 'Paul Fotso', '78 000', 'Payée', C['green'])]
    for i, (n, cl, am, st, col) in enumerate(inv):
        yy = 298 + i * 48
        b.append(rect(X0 + 12, yy, 406, 42, 10, '#ffffff08') + t(X0 + 26, yy + 18, n, 12, C['text'], 700) + t(X0 + 26, yy + 33, cl, 10.5, C['muted']) + t(X0 + 270, yy + 25, am, 11.5, C['text'], 700, 'end') + chip(X0 + 406, yy + 11, st, col, 20, 10, True, 'end')[0])
    rx = X0 + 446; rw = CW - 446
    b.append(card(rx, 236, rw, 360, 16, C['panel2']) + icon('ai', rx + 16, 252, 17, C['blue']) + t(rx + 40, 265, 'Relance rédigée par l\'IA', 12.5, C['text'], 700))
    b.append(t(rx + 16, 296, 'Facture F-2026-0031 · Njoya SARL', 10.5, C['muted'], 600))
    msg = ['Bonjour M. Njoya,', '', 'Sauf erreur de notre part, la facture', 'F-2026-0031 (119 250 FCFA) est', 'arrivée à échéance le 6 octobre.', '', 'Pourriez-vous régler par Mobile', 'Money cette semaine ? Je reste', 'disponible pour toute question.', '', 'Cordialement, Awa Tchoua']
    for i, s in enumerate(msg):
        b.append(t(rx + 18, 322 + i * 19, s, 11, C['text'], 400))
    b.append(chip(rx + 16, 540, 'WhatsApp', C['green'], 22, 10.5)[0] + chip(rx + 92, 540, 'E-mail', C['blue'], 22, 10.5, False)[0] + btn(rx + rw - 94, 536, 78, 'Envoyer', True, 28, 11.5))
    return ''.join(b)


# ───────────────────────── 10. Ressources humaines
def rh():
    b = [head('Ressources humaines', 'Semaine du 13 au 19 octobre', right=btn(X1 - 150, 74, 150, '+ Ajouter un horaire', True, 30, 11.5))]
    b.append(card(X0, 128, CW, 308))
    days = ['Lun 13', 'Mar 14', 'Mer 15', 'Jeu 16', 'Ven 17', 'Sam 18', 'Dim 19']
    gx = X0 + 130; gw = (CW - 142) / 7
    for i, d in enumerate(days):
        b.append(t(gx + i * gw + gw / 2, 152, d, 10.5, C['muted'] if i < 5 else C['dim'], 700, 'middle'))
    people = [('Paul Fotso', 'PF', C['green'], {0: '08–16', 1: '08–16', 2: '08–16', 3: '08–16', 4: '08–16'}), ('Marie Kamga', 'MK', C['blue'], {0: '09–17', 1: '09–17', 2: 'Congé', 3: '09–17', 4: '09–17', 5: '09–13'}),
              ('Kofi Mensah', 'KM', C['pink'], {1: '08–16', 2: '08–16', 3: '08–16', 4: 'Congé?', 5: '08–14'}), ('Aïcha Bello', 'AB', C['purple'], {0: '12–20', 1: '12–20', 2: '12–20', 3: '12–20', 4: '12–20'}), ('Hamidou Y.', 'HY', C['amber'], {0: '07–15', 2: '07–15', 3: '07–15', 5: '07–13', 6: '08–12'})]
    for r, (n, ini, col, sh) in enumerate(people):
        yy = 168 + r * 52
        b.append(f'<line x1="{X0+12}" y1="{yy-6}" x2="{X0+CW-12}" y2="{yy-6}" stroke="#ffffff0d"/>' + avatar(X0 + 36, yy + 20, ini, col, 14) + t(X0 + 58, yy + 24, n, 11.5, C['text'], 700))
        for d, v in sh.items():
            x = gx + d * gw + 4
            if v.startswith('Congé'):
                pend = '?' in v
                b.append(f'<rect x="{x}" y="{yy+4}" width="{gw-8}" height="34" rx="9" fill="{C["amber"]}" opacity="{.16 if pend else .26}"/><rect x="{x+.5}" y="{yy+4.5}" width="{gw-9}" height="33" rx="9" fill="none" stroke="{C["amber"]}" stroke-dasharray="{"4 3" if pend else "0"}" opacity=".7"/>' + t(x + (gw - 8) / 2, yy + 26, 'À traiter' if pend else 'Congé', 10.5, C['amber'], 700, 'middle'))
            else:
                b.append(f'<rect x="{x}" y="{yy+4}" width="{gw-8}" height="34" rx="9" fill="{col}" opacity=".2"/>' + t(x + (gw - 8) / 2, yy + 26, v, 10.5, col, 700, 'middle'))
    b.append(card(X0, 452, 350, 144, 16, C['panel2']) + t(X0 + 18, 478, 'Demande de congé', 13.5, C['text'], 700) + chip(X0 + 332, 464, 'À traiter', C['amber'], 22, 10.5, True, 'end')[0])
    b.append(avatar(X0 + 36, 512, 'KM', C['pink'], 16) + t(X0 + 62, 508, 'Kofi Mensah', 12.5, C['text'], 700) + t(X0 + 62, 525, 'Congé annuel · vendredi 17 octobre (1 jour)', 10.5, C['muted']))
    b.append(btn(X0 + 18, 546, 110, 'Accepter', True, 30, 12) + btn(X0 + 136, 546, 100, 'Refuser', False, 30, 12))
    b.append(card(X0 + 366, 452, CW - 366, 144, 16, '#4a7bff1f', '#6f9bff44') + icon('ai', X0 + 384, 466, 17, C['blue']) + t(X0 + 408, 479, "Avis de l'IA avant d'accepter", 12.5, C['text'], 700))
    b.append(t(X0 + 384, 508, 'Vendredi, Marie est déjà en poste et Paul aussi :', 11, C['muted']) + t(X0 + 384, 526, 'la boutique reste couverte (2 personnes sur 5).', 11, C['muted']) + t(X0 + 384, 552, 'Aucun conflit de planning détecté.', 11.5, C['green'], 700))
    return ''.join(b)


# ───────────────────────── 11. Assistant commercial (ventes en ligne)
def ventes():
    b = [head('Assistant commercial', 'Campagne « facebook-octobre » · 38 conversations cette semaine')]
    b.append(chip(X1 - 188, 76, 'WhatsApp', C['green'], 24, 11, True, 'end')[0] + chip(X1 - 92, 76, 'Messenger', C['blue'], 24, 11, True, 'end')[0] + chip(X1, 76, 'Instagram', C['pink'], 24, 11, True, 'end')[0])
    # téléphone
    px = X0 + 8
    b.append(rect(px, 126, 300, 470, 30, '#060d1f', C['line2']) + rect(px + 8, 134, 284, 454, 24, '#0e1a36'))
    b.append(rect(px + 8, 134, 284, 54, 24, '#16a34a33') + avatar(px + 40, 161, 'BA', C['green'], 15) + t(px + 64, 157, 'Boutique Awa', 12.5, C['text'], 700) + t(px + 64, 173, 'assistant · en ligne', 10, C['green'], 600))
    msgs = [('u', 'Bonjour, je vois votre pub. Vous avez', 'des robes wax ?'), ('a', 'Bonjour ! Oui, la robe wax Aïcha est à', '15 000 FCFA. Pour quand la voulez-vous ?'), ('u', 'Pour vendredi, 2 robes, à Douala', ''), ('a', 'Parfait ! Je récapitule : 2 robes wax,', 'livraison à Douala vendredi. Je confirme ?'), ('u', 'Oui, je confirme', ''), ('a', 'Commande C-2026-0012 enregistrée :', '30 000 FCFA. Nous vous appelons très vite.')]
    yy = 204
    for who, l1, l2 in msgs:
        h = 28 + (16 if l2 else 0)
        w = 232
        x = px + 20 if who == 'a' else px + 280 - w
        col = '#1d2f5c' if who == 'a' else '#2563eb'
        b.append(rect(x, yy, w, h, 14, col) + t(x + 12, yy + 19, l1, 10.5, '#fff', 500) + (t(x + 12, yy + 35, l2, 10.5, '#fff', 500) if l2 else ''))
        yy += h + 10
    b.append(rect(px + 18, 548, 220, 30, 15, '#ffffff10') + t(px + 34, 567, 'Écrivez un message…', 10.5, C['dim']) + f'<circle cx="{px+262}" cy="563" r="15" fill="url(#gBtn)"/>' + icon('send', px + 254, 555, 16, '#fff', 2))
    # côté équipe
    rx = X0 + 328; rw = CW - 328
    b.append(card(rx, 126, rw, 214, 16, C['panel2']) + t(rx + 18, 152, 'Commande à valider', 13.5, C['text'], 700) + chip(rx + rw - 16, 138, 'C-2026-0012', C['amber'], 22, 10.5, True, 'end')[0])
    b.append(t(rx + 18, 178, 'Paul Test · 6 77 11 22 33 · Douala', 11, C['muted']) + f'<line x1="{rx+18}" y1="190" x2="{rx+rw-18}" y2="190" stroke="#ffffff12"/>')
    b.append(t(rx + 18, 212, 'Robe wax Aïcha × 2', 12, C['text'], 600) + t(rx + rw - 18, 212, '30 000 FCFA', 12, C['text'], 700, 'end') + f'<line x1="{rx+18}" y1="226" x2="{rx+rw-18}" y2="226" stroke="#ffffff12"/>' + t(rx + 18, 250, 'Total (prix du catalogue)', 11, C['muted']) + t(rx + rw - 18, 250, '30 000 FCFA', 15, C['green'], 800, 'end'))
    b.append(btn(rx + 18, 280, 100, 'Confirmer', True, 30, 12) + btn(rx + 126, 280, 90, 'Refuser', False, 30, 12) + btn(rx + 224, 280, 118, 'Faire la facture', False, 30, 12))
    b.append(card(rx, 354, rw, 130) + t(rx + 18, 380, 'Fiche prospect', 13.5, C['text'], 700) + chip(rx + rw - 16, 366, 'Chaud', C['red'], 22, 10.5, True, 'end')[0])
    for i, (k, v) in enumerate([('Besoin', 'robes wax'), ('Quantité', '2 pièces'), ('Pour quand', 'vendredi'), ('Lieu', 'Douala')]):
        cx = rx + 18 + (i % 2) * 190; cy = 408 + (i // 2) * 34
        b.append(t(cx, cy, k.upper(), 9, C['dim'], 700) + t(cx, cy + 16, v, 12, C['text'], 600))
    b.append(card(rx, 498, rw, 98) + t(rx + 18, 524, 'Résultats de la campagne', 12.5, C['text'], 700))
    for i, (v, l, col) in enumerate([('38', 'conversations', C['blue']), ('21', 'prospects', C['amber']), ('9', 'commandes', C['green'])]):
        b.append(t(rx + 18 + i * 120, 560, v, 24, col, 800) + t(rx + 18 + i * 120, 578, l, 10.5, C['muted']))
    return ''.join(b)


# ───────────────────────── 12. Assistant IA intégré
def assistant():
    b = [head('Assistant MANAGER-IA', 'Posez une question, il connaît votre entreprise')]
    b.append(card(X0, 128, CW, 468))
    b.append(rect(X0 + CW - 360, 146, 342, 46, 16, '#2563eb') + t(X0 + CW - 344, 166, 'Quelles factures dois-je relancer', 12, '#fff', 500) + t(X0 + CW - 344, 182, 'en priorité cette semaine ?', 12, '#fff', 500))
    b.append(avatar(X0 + 34, 224, 'IA', C['blue'], 16))
    b.append(rect(X0 + 62, 208, 560, 240, 16, '#ffffff0d', C['line']) + t(X0 + 80, 234, 'Voici vos 3 priorités, de la plus ancienne à la plus récente :', 12, C['text'], 600))
    pr = [('1', 'F-2026-0028 · Boutique Kilo', '212 500 FCFA · échue depuis 17 jours', C['red']), ('2', 'F-2026-0031 · Njoya SARL', '119 250 FCFA · échue depuis 9 jours', C['red']), ('3', 'F-2026-0033 · Grace Tamba', '80 250 FCFA · échue depuis 2 jours', C['amber'])]
    for i, (n, t1, t2, col) in enumerate(pr):
        yy = 252 + i * 54
        b.append(rect(X0 + 78, yy, 528, 46, 12, '#ffffff0a') + f'<circle cx="{X0+102}" cy="{yy+23}" r="12" fill="{col}" opacity=".25"/>' + t(X0 + 102, yy + 27, n, 12, col, 800, 'middle') + t(X0 + 126, yy + 20, t1, 12, C['text'], 700) + t(X0 + 126, yy + 36, t2, 10.5, C['muted']) + chip(X0 + 596, yy + 13, 'Rédiger la relance', C['blue'], 22, 10, True, 'end')[0])
    b.append(t(X0 + 80, 430, "Total à récupérer : 412 000 FCFA. Je peux préparer les trois messages.", 11.5, C['muted']))
    b.append(rect(X0 + CW - 300, 466, 282, 30, 15, '#2563eb') + t(X0 + CW - 284, 485, 'Oui, prépare les trois messages', 11.5, '#fff', 500))
    b.append(avatar(X0 + 34, 530, 'IA', C['blue'], 16) + rect(X0 + 62, 514, 250, 34, 14, '#ffffff0d', C['line']) + t(X0 + 78, 536, 'Brouillons prêts : à relire et envoyer.', 11.5, C['text'], 500))
    for i, s in enumerate(['Résumé de la semaine', 'Stock à commander', 'Qui est en congé ?']):
        b.append(chip(X0 + 20 + i * 168, 562, s, C['blue'], 24, 11, False)[0])
    b.append(rect(X0 + 18, 590 - 0, 0, 0))
    return ''.join(b)


# ───────────────────────── 13. Comptabilité (nouveau)
def compta():
    b = [head('Comptabilité', 'Plan OHADA · Exercice 2026', right=btn(X1 - 160, 74, 160, 'Nouvelle écriture', True, 30, 11.5))]
    kw = 168; gap = 16
    for i, (lb, v, col, d) in enumerate([('Ventes (HT)', '8 420 000', C['green'], '+14 %'), ('Achats', '3 760 000', C['pink'], ''), ('Résultat', '1 905 000', C['blue'], 'bénéfice'), ('TVA à reverser', '412 000', C['amber'], 'estimée')]):
        b.append(kpi(X0 + i * (kw + gap), 128, kw, 92, lb, v, d, col))
    b.append(card(X0, 236, 420, 360) + t(X0 + 18, 262, 'Journal', 13.5, C['text'], 700) + chip(X0 + 402, 248, 'Écritures non modifiables', C['green'], 22, 10, True, 'end')[0])
    ent = [('VT-2026-00031', 'Facture F-2026-0031 · Njoya', [('411', 119250, 0), ('701', 0, 100000), ('4431', 0, 19250)]), ('CA-2026-00044', 'Encaissement F-2026-0027', [('571', 119250, 0), ('411', 0, 119250)]), ('AC-2026-00018', 'Achat #14 · tissu wax', [('601', 240000, 0), ('401', 0, 240000)])]
    b.append(t(X0 + 300, 286, 'DÉBIT', 9, C['dim'], 700, 'end') + t(X0 + 392, 286, 'CRÉDIT', 9, C['dim'], 700, 'end'))
    yy = 296
    for num, lb, lines in ent:
        h = 34 + len(lines) * 17
        b.append(rect(X0 + 12, yy, 396, h, 12, '#ffffff08') + t(X0 + 26, yy + 20, num, 11, C['blue'], 700) + t(X0 + 124, yy + 20, lb, 10.5, C['text'], 600))
        for j, (ac, d, c) in enumerate(lines):
            y2 = yy + 38 + j * 17
            b.append(t(X0 + 30, y2, ac, 10.5, C['muted'], 700) + t(X0 + 300, y2, f'{d:,}'.replace(',', ' ') if d else '', 10.5, C['text'], 600, 'end') + t(X0 + 392, y2, f'{c:,}'.replace(',', ' ') if c else '', 10.5, C['text'], 600, 'end'))
        yy += h + 10
    rx = X0 + 436; rw = CW - 436
    b.append(card(rx, 236, rw, 200) + t(rx + 18, 262, 'Compte de résultat', 13.5, C['text'], 700))
    for i, (lb, v, col) in enumerate([('Produits', '8 420 000', C['green']), ('Charges', '6 515 000', C['pink']), ('Résultat net', '1 905 000', C['blue'])]):
        yy = 292 + i * 40
        b.append(t(rx + 18, yy, lb, 11.5, C['muted'], 600) + t(rx + rw - 18, yy, v, 13, col, 800, 'end') + progress(rx + 18, yy + 10, rw - 36, [100, 77, 23][i], col, 5))
    b.append(card(rx, 452, rw, 144, 16, '#4a7bff1f', '#6f9bff44') + icon('ai', rx + 16, 466, 17, C['blue']) + t(rx + 40, 479, 'Décrivez, l\'IA écrit', 12.5, C['text'], 700))
    b.append(rect(rx + 16, 494, rw - 32, 32, 12, '#00000040', C['line2']) + t(rx + 28, 514, '« payé le loyer 150 000 en espèces »', 10.5, C['muted']) + t(rx + 18, 550, '→ 622 Loyer (débit) · 571 Caisse (crédit)', 11, C['green'], 700) + t(rx + 18, 568, 'Vous relisez, puis vous enregistrez.', 10.5, C['muted']))
    return ''.join(b)


# ───────────────────────── 14. Intégrations et canaux (nouveau)
def canaux():
    b = [head('Canaux et intégrations', 'Une seule IA, tous vos canaux')]
    cx = X0 + CW / 2; cy = 332
    left = [('WhatsApp', C['green'], 'Texte, vocaux, photos'), ('Messenger', C['blue'], 'Page Facebook'), ('Instagram', C['pink'], 'Messages privés')]
    right = [('Site web', C['amber'], 'Lien de pub et QR code'), ('E-mail', C['blue'], 'Devis, factures, relances'), ('Zapier · Make · n8n', C['purple'], 'API et webhooks signés')]
    nw = 206; ys = [190, 332, 474]
    b.append(f'<circle cx="{cx}" cy="{cy}" r="150" fill="none" stroke="#6f9bff" stroke-opacity=".10"/><circle cx="{cx}" cy="{cy}" r="104" fill="none" stroke="#6f9bff" stroke-opacity=".22" stroke-dasharray="3 7"/>')
    for k, (n, col, sub) in enumerate(left):
        b.append(f'<path d="M{X0+12+nw} {ys[k]} C{X0+12+nw+60} {ys[k]} {cx-120} {cy} {cx-66} {cy}" fill="none" stroke="{col}" stroke-opacity=".5" stroke-width="1.8" stroke-dasharray="5 6"/>')
    for k, (n, col, sub) in enumerate(right):
        b.append(f'<path d="M{X0+CW-12-nw} {ys[k]} C{X0+CW-12-nw-60} {ys[k]} {cx+120} {cy} {cx+66} {cy}" fill="none" stroke="{col}" stroke-opacity=".5" stroke-width="1.8" stroke-dasharray="5 6"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="66" fill="url(#gBtn)"/>' + icon('ai', cx - 20, cy - 34, 40, '#fff', 1.7) + t(cx, cy + 34, 'MANAGER-IA', 11, '#fff', 800, 'middle', extra='letter-spacing="1"'))
    for side, items, x in (('l', left, X0 + 12), ('r', right, X0 + CW - 12 - nw)):
        for k, (n, col, sub) in enumerate(items):
            y = ys[k]
            b.append(card(x, y - 34, nw, 68, 16, C['panel2']) + f'<circle cx="{x+30}" cy="{y}" r="16" fill="{col}" opacity=".22"/><circle cx="{x+30}" cy="{y}" r="5.5" fill="{col}"/>' + t(x + 56, y - 3, n, 12.5, C['text'], 700) + t(x + 56, y + 14, sub, 10, C['muted']))
    b.append(card(X0, 540, CW, 56, 14))
    cs = [('STOP respecté', C['green'], True), ("Clés d'API chiffrées", C['blue'], True), ('Webhooks signés', C['purple'], True), ('Rien ne part sans votre accord', C['amber'], False)]
    x = X0 + 16
    for lb, col, fill in cs:
        svg, w = chip(x, 556, lb, col, 24, 11, fill)
        b.append(svg); x += w + 12
    return ''.join(b)


SCREENS = [('gestion', 'dash', "Tableau de bord MANAGER-IA : demandes, projets, solde, graphique et point de situation de l'IA", dash),
           ('support', 'support', "Boîte de demandes clients avec un brouillon de réponse rédigé par l'IA", support),
           ('projets', 'projets', 'Tableau de tâches à faire, en cours et terminées avec avancement', projets),
           ('budget', 'budget', 'Budget avec entrées, sorties, solde et dépenses par catégorie', budget),
           ('organisation', 'equipe', 'Organigramme avec direction, responsables, postes et suggestions de l\'IA', organisation),
           ('fonctionnement', 'projets', 'Procédure en étapes cochées avec progression', fonctionnement),
           ('equipe', 'equipe', 'Équipe avec rôles, antennes et invitation par lien', equipe),
           ('stock', 'stock', 'Stock avec alertes de rupture et commande à valider comparant les fournisseurs', stock),
           ('clients', 'clients', 'Clients, factures, impayés et message de relance rédigé par l\'IA', clients),
           ('rh', 'rh', 'Planning de la semaine et demande de congé à traiter avec avis de l\'IA', rh),
           ('ventes-ligne', 'sales', 'Un prospect discute avec l\'assistant, est enregistré et passe une commande à valider', ventes),
           ('assistant', 'dash', 'Conversation avec l\'assistant intégré qui liste les factures à relancer', assistant),
           ('comptabilite', 'compta', 'Comptabilité : journal d\'écritures, compte de résultat et écriture proposée par l\'IA', compta),
           ('canaux', 'sales', 'Une seule IA pour WhatsApp, Messenger, Instagram, le site web, les e-mails et les intégrations', canaux)]
