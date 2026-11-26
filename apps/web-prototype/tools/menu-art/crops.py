# The menu icons are the user's own mock-up artwork (the 21 Nov 2026 menu brief), cut out of the
# reference pictures. name: (reference picture, (left, top, right, bottom)) in that picture's pixels.
CROPS = {
  # 1 - Home
  'academy':   ('1 - Home.png', (195, 362, 398, 575)),
  'quick':     ('1 - Home.png', (660, 360, 822, 515)),
  'journey':   ('1 - Home.png', (1130, 365, 1305, 505)),
  'puzzle':    ('1 - Home.png', (650, 545, 778, 641)),
  'friend':    ('1 - Home.png', (940, 548, 1078, 647)),
  'minis':     ('1 - Home.png', (1255, 548, 1385, 665)),
  'missions':  ('1 - Home.png', (150, 760, 245, 868)),
  'season':    ('1 - Home.png', (805, 758, 975, 875)),
  'rank':      ('1 - Home.png', (912, 135, 1015, 240)),
  # 2 - Play
  'online':    ('2 - Play.png', (1120, 490, 1265, 665)),
  'variants':  ('2 - Play.png', (230, 730, 372, 850)),
  'friend2':   ('2 - Play.png', (665, 495, 845, 665)),
  'puzzle2':   ('2 - Play.png', (905, 735, 1055, 850)),
  'goal':      ('2 - Play.png', (908, 118, 962, 168)),
  'playmedal': ('2 - Play.png', (176, 86, 296, 202)),
  # pop-ups
  'medals':    ('2.2.1 - Play a Friend - Create a Table.png', (425, 58, 695, 208)),
  'join':      ('2.2.1 - Play a Friend - Create a Table.png', (200, 385, 350, 510)),
  'create':    ('2.2.1 - Play a Friend - Create a Table.png', (470, 380, 650, 505)),
  'turns':     ('2.2.1 - Play a Friend - Create a Table.png', (760, 372, 935, 495)),
  'watch':     ('2.2.1 - Play a Friend - Create a Table.png', (200, 932, 340, 1080)),
  'joindoor':  ('2.2.2.1 - Play a Friend - Enter Table Code.png', (200, 375, 355, 497)),
  'crowns':    ('2.3 - Play Online.png', (455, 55, 665, 170)),
  'king':      ('2.3.2 - Play Online - Host an Online Table.png', (432, 360, 682, 612)),
  'surprise':  ('2.1 - Play vs AI.png', (922, 135, 1015, 190)),
  # Journey
  'passport':  ('3 - Journey.png', (68, 155, 188, 275)),
  'laurel':    ('3 - Journey.png', (108, 68, 250, 165)),
}

# Pictures kept whole (no cut-out): they fill a card's side and fade into it.
PLAIN = {
  'var-chaturanga': ('2.4 - Chess Variation.png', (27, 232, 222, 398)),
  'var-chess960':   ('2.4 - Chess Variation.png', (441, 232, 628, 398)),
  'var-koth':       ('2.4 - Chess Variation.png', (852, 232, 1046, 398)),
  'var-threecheck': ('2.4 - Chess Variation.png', (1263, 232, 1440, 398)),
  'var-xiangqi':    ('2.4 - Chess Variation.png', (27, 421, 222, 580)),
  'banner-chaturanga': ('2.4.1 - Chess Variation - Play.png', (900, 22, 1372, 252)),
  'vhero':          ('2.4 - Chess Variation.png', (1030, 62, 1640, 215)),
}
# The era cards on the Journey: the left scene of each era friend's reference sheet
# (/mnt/project-files/characters-ref/<animal>.png), in that sheet's pixels.
ERA_SCENE = (18, 18, 590, 600)
