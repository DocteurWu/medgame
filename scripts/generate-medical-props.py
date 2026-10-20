#!/usr/bin/env python3
"""
generate-medical-props.py — Génération procédurale d'assets 3D médicaux propres
Génère 8 modèles hospitaliers game-ready au format GLB (Y-up, échelle métrique, zéro texture).
"""

import os
import math
import numpy as np
import trimesh
from trimesh.creation import box, cylinder, icosphere

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "models", "props")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def create_wheel(radius=0.04, width=0.025):
    """Roulette hospitalière double avec chape et fixation"""
    wheel = cylinder(radius=radius, height=width, sections=16)
    # Orienter axe Z horizontal
    rot = trimesh.transformations.rotation_matrix(math.pi / 2, [0, 0, 1])
    wheel.apply_transform(rot)
    
    fork = box(extents=[0.015, width + 0.01, radius * 1.6])
    fork.apply_translation([0, 0, radius * 0.8])
    pin = cylinder(radius=0.008, height=0.03, sections=12)
    pin.apply_translation([0, 0, radius * 1.6 + 0.015])
    return trimesh.util.concatenate([wheel, fork, pin])

def generate_lit_examen():
    """1. Lit d'examen médical (Hero asset) : 2.05m x 0.65m, dossier incline, roulettes, paper roll"""
    parts = []
    
    # 4 Pieds et roulettes
    wheel_r = 0.045
    leg_h = 0.60
    leg_r = 0.02
    bed_w = 0.70
    bed_l = 2.00
    
    xs = [-bed_w/2 + 0.06, bed_w/2 - 0.06]
    zs = [-bed_l/2 + 0.15, bed_l/2 - 0.15]
    
    for x in xs:
        for z in zs:
            wh = create_wheel(radius=wheel_r)
            wh.apply_translation([x, wheel_r, z])
            parts.append(wh)
            
            leg = cylinder(radius=leg_r, height=leg_h, sections=14)
            leg.apply_translation([x, wheel_r * 2 + leg_h / 2, z])
            parts.append(leg)

    base_y = wheel_r * 2 + leg_h
    
    # Cadre acier tubulaire horizontal
    frame_outer = box(extents=[bed_w, 0.05, bed_l])
    frame_outer.apply_translation([0, base_y + 0.025, 0])
    parts.append(frame_outer)
    
    # Entretoises inférieures
    cross_bar1 = cylinder(radius=0.015, height=bed_w - 0.1, sections=12)
    cross_bar1.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    cross_bar1.apply_translation([0, wheel_r * 2 + 0.15, zs[0]])
    parts.append(cross_bar1)
    
    cross_bar2 = cylinder(radius=0.015, height=bed_w - 0.1, sections=12)
    cross_bar2.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    cross_bar2.apply_translation([0, wheel_r * 2 + 0.15, zs[1]])
    parts.append(cross_bar2)

    # Matelas principal (assise & jambes : 1.35m)
    mat_y = base_y + 0.05
    mat_main_l = 1.35
    mat_main = box(extents=[bed_w + 0.04, 0.12, mat_main_l])
    mat_main.apply_translation([0, mat_y + 0.06, -bed_l/2 + mat_main_l/2])
    parts.append(mat_main)

    # Dossier inclinable (0.65m incliné à 32 degrés)
    back_l = 0.65
    back_angle = math.radians(32)
    mat_back = box(extents=[bed_w + 0.04, 0.12, back_l])
    # Centrage sur le pivot
    mat_back.apply_translation([0, 0.06, back_l/2])
    rot_back = trimesh.transformations.rotation_matrix(-back_angle, [1, 0, 0])
    mat_back.apply_transform(rot_back)
    pivot_z = -bed_l/2 + mat_main_l
    mat_back.apply_translation([0, mat_y, pivot_z])
    parts.append(mat_back)

    # Oreiller ergonomique
    pillow = box(extents=[bed_w - 0.15, 0.06, 0.28])
    pillow.apply_translation([0, 0.03, 0.14])
    pillow.apply_transform(rot_back)
    pillow.apply_translation([0, mat_y + 0.10, pivot_z + 0.35])
    parts.append(pillow)

    # Porte-rouleau de drap d'examen (sous le dossier au bout du lit)
    roll_holder_l = cylinder(radius=0.01, height=0.15, sections=10)
    roll_holder_l.apply_translation([-bed_w/2, mat_y - 0.05, bed_l/2 - 0.05])
    parts.append(roll_holder_l)
    roll_holder_r = cylinder(radius=0.01, height=0.15, sections=10)
    roll_holder_r.apply_translation([bed_w/2, mat_y - 0.05, bed_l/2 - 0.05])
    parts.append(roll_holder_r)
    
    paper_roll = cylinder(radius=0.06, height=bed_w - 0.06, sections=20)
    paper_roll.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    paper_roll.apply_translation([0, mat_y - 0.10, bed_l/2 - 0.05])
    parts.append(paper_roll)

    # Drap papier déroulé sur le matelas
    sheet_main = box(extents=[bed_w - 0.08, 0.005, mat_main_l - 0.05])
    sheet_main.apply_translation([0, mat_y + 0.123, -bed_l/2 + mat_main_l/2])
    parts.append(sheet_main)

    # Barrières de lit rabattables (côté gauche et droit)
    for side in [-1, 1]:
        rail_base = box(extents=[0.02, 0.22, 0.90])
        rail_base.apply_translation([side * (bed_w/2 + 0.02), mat_y + 0.10, -0.15])
        parts.append(rail_base)

    mesh = trimesh.util.concatenate(parts)
    return mesh

def generate_chariot_mayo():
    """2. Chariot Mayo pour instruments chirurgicaux (inox, plateau ajustable, roulettes)"""
    parts = []
    # Base en H plate
    base_center = box(extents=[0.05, 0.04, 0.45])
    base_center.apply_translation([0, 0.06, 0])
    parts.append(base_center)
    
    leg_l = box(extents=[0.45, 0.04, 0.05])
    leg_l.apply_translation([0, 0.06, -0.20])
    parts.append(leg_l)
    
    leg_r = box(extents=[0.45, 0.04, 0.05])
    leg_r.apply_translation([0, 0.06, 0.20])
    parts.append(leg_r)

    # 4 roulettes
    for x in [-0.20, 0.20]:
        for z in [-0.20, 0.20]:
            wh = create_wheel(radius=0.035, width=0.02)
            wh.apply_translation([x, 0.035, z])
            parts.append(wh)

    # Colonne télescopique
    pole_outer = cylinder(radius=0.025, height=0.60, sections=16)
    pole_outer.apply_translation([0, 0.38, 0])
    parts.append(pole_outer)

    knob = cylinder(radius=0.035, height=0.03, sections=12)
    knob.apply_translation([0, 0.65, 0])
    parts.append(knob)

    pole_inner = cylinder(radius=0.018, height=0.45, sections=16)
    pole_inner.apply_translation([0, 0.85, 0])
    parts.append(pole_inner)

    # Plateau inox à rebord (0.60m x 0.40m)
    tray_bottom = box(extents=[0.60, 0.02, 0.40])
    tray_bottom.apply_translation([0, 1.05, 0])
    parts.append(tray_bottom)

    # Rebord surélevé
    lip_f = box(extents=[0.60, 0.03, 0.015])
    lip_f.apply_translation([0, 1.07, 0.192])
    parts.append(lip_f)
    lip_b = box(extents=[0.60, 0.03, 0.015])
    lip_b.apply_translation([0, 1.07, -0.192])
    parts.append(lip_b)
    lip_l = box(extents=[0.015, 0.03, 0.37])
    lip_l.apply_translation([-0.292, 1.07, 0])
    parts.append(lip_l)
    lip_r = box(extents=[0.015, 0.03, 0.37])
    lip_r.apply_translation([0.292, 1.07, 0])
    parts.append(lip_r)

    # Petit caisson à 2 tiroirs sous un côté
    drawer_unit = box(extents=[0.24, 0.14, 0.32])
    drawer_unit.apply_translation([0.15, 0.96, 0])
    parts.append(drawer_unit)

    return trimesh.util.concatenate(parts)

def generate_defibrillateur_dsa():
    """3. Défibrillateur / DSA sur chariot mobile"""
    parts = []
    # Base 5 branches à roulettes
    base_center = cylinder(radius=0.08, height=0.06, sections=16)
    base_center.apply_translation([0, 0.08, 0])
    parts.append(base_center)

    for i in range(5):
        angle = i * (2 * math.pi / 5)
        arm = box(extents=[0.04, 0.04, 0.28])
        arm.apply_translation([0, 0, 0.14])
        rot = trimesh.transformations.rotation_matrix(angle, [0, 1, 0])
        arm.apply_transform(rot)
        arm.apply_translation([0, 0.08, 0])
        parts.append(arm)

        wh = create_wheel(radius=0.035)
        wh.apply_translation([0.28 * math.sin(angle), 0.035, 0.28 * math.cos(angle)])
        parts.append(wh)

    # Mât support robuste
    pole = cylinder(radius=0.025, height=1.00, sections=16)
    pole.apply_translation([0, 0.58, 0])
    parts.append(pole)

    # Poignée arrière de transport
    handle_bar = box(extents=[0.30, 0.03, 0.03])
    handle_bar.apply_translation([0, 1.05, -0.16])
    parts.append(handle_bar)

    # Plateau support incliné
    tray = box(extents=[0.38, 0.03, 0.32])
    tray.apply_translation([0, 1.08, 0])
    parts.append(tray)

    # Boîtier principal DSA (défibrillateur)
    dsa_body = box(extents=[0.34, 0.24, 0.26])
    dsa_body.apply_translation([0, 1.22, 0])
    parts.append(dsa_body)

    # Écran incliné
    screen = box(extents=[0.24, 0.16, 0.015])
    screen.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), [1, 0, 0]))
    screen.apply_translation([0, 1.23, 0.135])
    parts.append(screen)

    # Bouton choc rouge saillant
    shock_btn = cylinder(radius=0.022, height=0.02, sections=16)
    shock_btn.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1, 0, 0]))
    shock_btn.apply_translation([0.10, 1.15, 0.14])
    parts.append(shock_btn)

    # Palettes de défibrillation clipsées sur les côtés
    for side in [-1, 1]:
        paddle_bracket = box(extents=[0.04, 0.14, 0.12])
        paddle_bracket.apply_translation([side * 0.19, 1.22, 0])
        parts.append(paddle_bracket)
        paddle_handle = cylinder(radius=0.016, height=0.12, sections=12)
        paddle_handle.apply_translation([side * 0.22, 1.22, 0])
        parts.append(paddle_handle)

    return trimesh.util.concatenate(parts)

def generate_paravent_medical():
    """4. Paravent / cloison d'intimité à 3 panneaux pliants (H 1.70m)"""
    parts = []
    panel_w = 0.58
    panel_h = 1.55
    tube_r = 0.014
    
    # 3 panneaux avec angles en accordéon (0, 25 deg, -20 deg)
    angles = [0, math.radians(28), math.radians(-25)]
    current_x = -panel_w
    
    for i, ang in enumerate(angles):
        p_group = []
        # Cadre tubulaire
        left_t = cylinder(radius=tube_r, height=panel_h, sections=12)
        left_t.apply_translation([-panel_w/2, panel_h/2 + 0.10, 0])
        p_group.append(left_t)
        
        right_t = cylinder(radius=tube_r, height=panel_h, sections=12)
        right_t.apply_translation([panel_w/2, panel_h/2 + 0.10, 0])
        p_group.append(right_t)
        
        top_t = cylinder(radius=tube_r, height=panel_w, sections=12)
        top_t.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
        top_t.apply_translation([0, panel_h + 0.10, 0])
        p_group.append(top_t)
        
        bot_t = cylinder(radius=tube_r, height=panel_w, sections=12)
        bot_t.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
        bot_t.apply_translation([0, 0.10, 0])
        p_group.append(bot_t)

        # Toile tendue en vinyle médical
        curtain = box(extents=[panel_w - 0.04, panel_h - 0.06, 0.008])
        curtain.apply_translation([0, panel_h/2 + 0.10, 0])
        p_group.append(curtain)

        # Pieds à roulettes sous les montants
        for px in [-panel_w/2, panel_w/2]:
            leg_base = box(extents=[0.03, 0.02, 0.24])
            leg_base.apply_translation([px, 0.08, 0])
            p_group.append(leg_base)
            for pz in [-0.10, 0.10]:
                wh = create_wheel(radius=0.03)
                wh.apply_translation([px, 0.03, pz])
                p_group.append(wh)

        p_mesh = trimesh.util.concatenate(p_group)
        # Rotation
        p_mesh.apply_transform(trimesh.transformations.rotation_matrix(ang, [0, 1, 0]))
        # Placement en chaîne
        p_mesh.apply_translation([current_x + panel_w/2, 0, i * 0.08])
        current_x += panel_w * math.cos(ang)
        parts.append(p_mesh)

    mesh = trimesh.util.concatenate(parts)
    # Recentrer
    mesh.apply_translation([-mesh.bounding_box.centroid[0], 0, -mesh.bounding_box.centroid[2]])
    return mesh

def generate_chariot_triage():
    """5. Chariot de triage / soins à 3 plateaux avec corbeille DASRI"""
    parts = []
    w, l, h = 0.50, 0.75, 0.90
    
    # 4 montants tubulaires
    for x in [-w/2 + 0.03, w/2 - 0.03]:
        for z in [-l/2 + 0.03, l/2 - 0.03]:
            wh = create_wheel(radius=0.04)
            wh.apply_translation([x, 0.04, z])
            parts.append(wh)
            
            pole = cylinder(radius=0.015, height=h - 0.08, sections=14)
            pole.apply_translation([x, 0.08 + (h - 0.08)/2, z])
            parts.append(pole)

    # 3 plateaux inox à rebords (bas, milieu, haut)
    shelf_y = [0.18, 0.52, 0.88]
    for y in shelf_y:
        shelf = box(extents=[w, 0.025, l])
        shelf.apply_translation([0, y, 0])
        parts.append(shelf)
        # Rebord anti-chute
        rim_f = box(extents=[w, 0.03, 0.015])
        rim_f.apply_translation([0, y + 0.02, l/2 - 0.008])
        parts.append(rim_f)
        rim_b = box(extents=[w, 0.03, 0.015])
        rim_b.apply_translation([0, y + 0.02, -l/2 + 0.008])
        parts.append(rim_b)

    # Poignée de manœuvre tubulaire courbée
    handle = cylinder(radius=0.014, height=w - 0.06, sections=12)
    handle.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    handle.apply_translation([0, h + 0.04, l/2 + 0.08])
    parts.append(handle)
    for side in [-1, 1]:
        arm = cylinder(radius=0.012, height=0.10, sections=10)
        arm.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [1, 0, 0]))
        arm.apply_translation([side * (w/2 - 0.05), h + 0.02, l/2 + 0.04])
        parts.append(arm)

    # Bac à aiguilles / DASRI accroché sur le côté
    bin_holder = box(extents=[0.16, 0.22, 0.16])
    bin_holder.apply_translation([w/2 + 0.10, 0.65, 0.12])
    parts.append(bin_holder)

    # Corbeille à déchets inférieure
    trash_bin = cylinder(radius=0.10, height=0.28, sections=16)
    trash_bin.apply_translation([-w/2 - 0.12, 0.30, -0.15])
    parts.append(trash_bin)

    return trimesh.util.concatenate(parts)

def generate_chaise_clinicien():
    """6. Chaise / tabouret de clinicien ergonomique à 5 branches"""
    parts = []
    # Base 5 branches
    base_c = cylinder(radius=0.06, height=0.05, sections=16)
    base_c.apply_translation([0, 0.08, 0])
    parts.append(base_c)

    radius_branch = 0.28
    for i in range(5):
        ang = i * (2 * math.pi / 5)
        arm = box(extents=[0.035, 0.03, radius_branch])
        arm.apply_translation([0, 0, radius_branch / 2])
        arm.apply_transform(trimesh.transformations.rotation_matrix(ang, [0, 1, 0]))
        arm.apply_translation([0, 0.08, 0])
        parts.append(arm)

        wh = create_wheel(radius=0.03)
        wh.apply_translation([radius_branch * math.sin(ang), 0.03, radius_branch * math.cos(ang)])
        parts.append(wh)

    # Vérin pneumatique chromé avec soufflet télescopique
    piston_outer = cylinder(radius=0.028, height=0.20, sections=16)
    piston_outer.apply_translation([0, 0.20, 0])
    parts.append(piston_outer)

    piston_inner = cylinder(radius=0.018, height=0.22, sections=16)
    piston_inner.apply_translation([0, 0.38, 0])
    parts.append(piston_inner)

    # Assise rembourrée (hauteur 0.48m)
    seat = cylinder(radius=0.21, height=0.09, sections=24)
    seat.apply_translation([0, 0.48, 0])
    parts.append(seat)

    # Levier de réglage sous l'assise
    lever = cylinder(radius=0.008, height=0.16, sections=8)
    lever.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    lever.apply_translation([0.14, 0.44, 0.08])
    parts.append(lever)

    # Montant dorsal incurvé
    back_pole = box(extents=[0.04, 0.35, 0.03])
    back_pole.apply_translation([0, 0.65, -0.22])
    parts.append(back_pole)

    # Dossier ergonomique lombaire
    backrest = box(extents=[0.38, 0.20, 0.06])
    backrest.apply_translation([0, 0.80, -0.20])
    parts.append(backrest)

    return trimesh.util.concatenate(parts)

def generate_chariot_informatique():
    """7. Chariot informatique médical sur roulettes (ordinateur portable / écran)"""
    parts = []
    # Base en Y inversé / H profilé extra-plat
    base_f = box(extents=[0.48, 0.04, 0.06])
    base_f.apply_translation([0, 0.07, 0.22])
    parts.append(base_f)

    base_b = box(extents=[0.48, 0.04, 0.06])
    base_b.apply_translation([0, 0.07, -0.22])
    parts.append(base_b)

    spine = box(extents=[0.08, 0.04, 0.44])
    spine.apply_translation([0, 0.07, 0])
    parts.append(spine)

    for x in [-0.21, 0.21]:
        for z in [-0.22, 0.22]:
            wh = create_wheel(radius=0.04)
            wh.apply_translation([x, 0.04, z])
            parts.append(wh)

    # Colonne centrale réglable
    col = box(extents=[0.08, 0.85, 0.08])
    col.apply_translation([0, 0.52, -0.08])
    parts.append(col)

    # Poignée ergonomique circulaire
    handle = cylinder(radius=0.014, height=0.42, sections=14)
    handle.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2, [0, 0, 1]))
    handle.apply_translation([0, 0.96, 0.24])
    parts.append(handle)

    # Plateau supérieur avec repose-poignets
    tray = box(extents=[0.54, 0.03, 0.42])
    tray.apply_translation([0, 0.95, 0.05])
    parts.append(tray)

    # Écran médical ou moniteur monté sur bras VESA
    arm = box(extents=[0.04, 0.22, 0.04])
    arm.apply_translation([0, 1.08, -0.12])
    parts.append(arm)

    screen_bezel = box(extents=[0.46, 0.30, 0.03])
    screen_bezel.apply_translation([0, 1.25, -0.10])
    parts.append(screen_bezel)

    screen_display = box(extents=[0.42, 0.26, 0.01])
    screen_display.apply_translation([0, 1.25, -0.082])
    parts.append(screen_display)

    # Souris et clavier posés sur le plateau
    keyboard = box(extents=[0.36, 0.015, 0.14])
    keyboard.apply_translation([0, 0.97, 0.05])
    parts.append(keyboard)

    mouse = box(extents=[0.06, 0.02, 0.10])
    mouse.apply_translation([0.21, 0.97, 0.05])
    parts.append(mouse)

    return trimesh.util.concatenate(parts)

def generate_banquette_medicale():
    """8. Banquette / fauteuil d'attente médical 2 places en similicuir"""
    parts = []
    w, d, h = 1.15, 0.65, 0.78
    
    # 4 pieds tubulaires inclinés légers
    leg_r = 0.016
    for x in [-w/2 + 0.08, w/2 - 0.08]:
        for z in [-d/2 + 0.08, d/2 - 0.08]:
            leg = cylinder(radius=leg_r, height=0.40, sections=12)
            leg.apply_translation([x, 0.20, z])
            parts.append(leg)

    # Traverses horizontales
    beam = box(extents=[w - 0.10, 0.03, d - 0.10])
    beam.apply_translation([0, 0.38, 0])
    parts.append(beam)

    # 2 assises rembourrées côte à côte
    seat_w = (w - 0.12) / 2
    for i, x in enumerate([-seat_w/2 - 0.02, seat_w/2 + 0.02]):
        cushion = box(extents=[seat_w, 0.10, 0.48])
        cushion.apply_translation([x, 0.45, 0.02])
        parts.append(cushion)

        back = box(extents=[seat_w, 0.32, 0.09])
        back.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-8), [1, 0, 0]))
        back.apply_translation([x, 0.65, -0.22])
        parts.append(back)

    # Accoudoirs latéraux
    for side in [-1, 1]:
        arm_v = box(extents=[0.03, 0.22, 0.03])
        arm_v.apply_translation([side * (w/2 - 0.02), 0.51, 0])
        parts.append(arm_v)

        arm_h = box(extents=[0.05, 0.03, 0.45])
        arm_h.apply_translation([side * (w/2 - 0.02), 0.62, 0])
        parts.append(arm_h)

    return trimesh.util.concatenate(parts)

PROPS = {
    "lit_examen": generate_lit_examen,
    "chariot_mayo": generate_chariot_mayo,
    "defibrillateur_dsa": generate_defibrillateur_dsa,
    "paravent_medical": generate_paravent_medical,
    "chariot_triage": generate_chariot_triage,
    "chaise_clinicien": generate_chaise_clinicien,
    "chariot_informatique": generate_chariot_informatique,
    "banquette_medicale": generate_banquette_medicale
}

def main():
    print(f"Génération des 8 props médicaux dans {OUTPUT_DIR}...")
    for name, gen_fn in PROPS.items():
        mesh = gen_fn()
        # Assurer que l'origine Y est au sol (min Z ou Y selon orientation)
        min_y = mesh.bounds[0][1]
        if min_y != 0:
            mesh.apply_translation([0, -min_y, 0])
            
        out_path = os.path.join(OUTPUT_DIR, f"{name}.glb")
        mesh.export(out_path)
        print(f"[OK] {name}.glb généré : {len(mesh.faces)} faces, {len(mesh.vertices)} sommets, bbox: {np.round(mesh.extents, 3)}")

if __name__ == "__main__":
    main()
