#!/usr/bin/env python3
"""
scripts/prepare-pcg-dataset.py — Préparation du sous-ensemble PhysioNet/CinC Challenge 2016

Sélectionne 120 enregistrements PCG cliniques équilibrés (60 normaux, 60 anormaux),
télécharge les fichiers WAV individuels depuis PhysioNet, les convertit en MP3 légers 64 kbps,
extrait les annotations S1/S2 et génère data/pcg-trainer-database.js.
"""

import os
import sys
import io
import csv
import zipfile
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import scipy.io

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_AUDIO_DIR = os.path.join(BASE_DIR, "assets", "audio", "auscultation", "pcg")
OUTPUT_DB_FILE = os.path.join(BASE_DIR, "data", "pcg-trainer-database.js")
ANNOTATIONS_ZIP = r"C:\Users\Louaï\.gemini\antigravity\brain\582f5cd0-27bc-4076-975f-ad0612f9f953\scratch\annotations.zip"

os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)

# Quotas par set pour total = 120 clips (60 normaux, 60 anormaux)
TARGET_QUOTAS = {
    "training-a": {"normal": 10, "abnormal": 10},
    "training-b": {"normal": 10, "abnormal": 10},
    "training-c": {"normal": 7, "abnormal": 7},
    "training-d": {"normal": 10, "abnormal": 10},
    "training-e": {"normal": 13, "abnormal": 13},
    "training-f": {"normal": 10, "abnormal": 10},
}

DIAGNOSIS_TRANSLATIONS = {
    "Normal": "Sujet témoin sain (bruits cardiaques physiologiques)",
    "Normal ": "Sujet témoin sain (bruits cardiaques physiologiques)",
    "Normal: NHC": "Sujet témoin sain (cohorte de référence 18-40 ans)",
    "Normal: MARS500": "Volontaire sain (programme spatial MARS500)",
    "MVP": "Prolapsus de la valve mitrale (MVP)",
    "Benign": "Souffle bénin / anorganique fonctionnel",
    "AD": "Affections aortiques / valvulopathie aortique",
    "AS": "Rétrécissement aortique (sténose aortique)",
    "MR": "Insuffisance mitrale (régurgitation mitrale)",
    "CAD": "Coronaropathie documentée (maladie coronarienne)",
    "MPC": "Cardiopathie pathologique complexe",
    "Pathologic": "Cardiopathie valvulaire ou congénitale pathologique"
}

SITE_TRANSLATIONS = {
    "Apex": "Apex cardiaque (foyer mitral)",
    "Left of parasternum": "Bord parasternal gauche (foyer pulmonaire / tricuspide)",
    "Parasternum when sit": "Bord parasternal en position assise",
    "Parasternum when squat": "Bord parasternal en position accroupie",
    "Pulmonary area": "Foyer pulmonaire (2e espace intercostal gauche)",
    "Aortic area": "Foyer aortique (2e espace intercostal droit)",
    "Tricuspid area": "Foyer tricuspide",
    "Mitral area": "Foyer mitral / apex"
}

def clean_text(s):
    if not s:
        return ""
    return " ".join(s.replace("\r", " ").replace("\n", " ").split())

def translate_site(raw_site):
    raw = clean_text(raw_site)
    for k, v in SITE_TRANSLATIONS.items():
        if k.lower() in raw.lower():
            return v
    return raw if raw else "Précorde standard"

def translate_diagnosis(diag):
    clean = clean_text(diag)
    return DIAGNOSIS_TRANSLATIONS.get(clean, clean if clean else "Évaluation clinique")

def score_candidate(row):
    """Calcule un score de qualité pour privilégier les enregistrements exploitables."""
    score = 100
    # Nombre de battements nécessitant correction manuelle (0 est idéal)
    hand_corr = row.get("# Beats requiring hand correction", "0").strip()
    try:
        score -= int(hand_corr) * 2
    except ValueError:
        pass

    # Bruit ambiant (2 = aucun, 3 = insignifiant)
    amb_noise = row.get("Ambient noise (2=None 3=Insignificant 4=Weak Rec. BG<2 s 5=Weak Rec. BG<3 s 6=Weak Rec. BG <4 s 7=Weak Rec. BG >4 s 8=BG. Noise<2 s 9=BG. Noise<3 s 10= BG. noise <4 s 11=BG. Noise >4 s 12=Powerfull BG. Noise<2 s 13=Powerfull BG. Noise<3 s 14=Powerfull BG. noise <4 s  15=Powerfull BG. Noise >4 s 16=Dont know 17=Weak BG. Noise<1 s  18=BG.Noise<1 s 19=Powerfull BG. Noise<1 s)", "2")
    try:
        amb_val = int(amb_noise)
        if amb_val > 4:
            score -= (amb_val - 4) * 3
    except ValueError:
        pass

    # Durée / nombre de battements suffisant (au moins 15-20 battements)
    beats = row.get("# Beat (automated algorithm)", "20").strip()
    try:
        b_val = int(beats)
        if b_val < 15:
            score -= 20
        elif b_val >= 20:
            score += 10
    except ValueError:
        pass

    return score

def select_candidates(zip_file):
    appendix_data = zip_file.read("annotations/Online Appendix_training set.csv").decode("latin1")
    reader = csv.DictReader(io.StringIO(appendix_data))
    
    candidates = {}
    for db in TARGET_QUOTAS:
        candidates[db] = {"normal": [], "abnormal": []}

    mat_names = set(n.split("/")[-1] for n in zip_file.namelist() if n.endswith(".mat") and not "MACOSX" in n)

    for row in reader:
        db = clean_text(row.get("Database", ""))
        rec = clean_text(row.get("Challenge record name", ""))
        cls = clean_text(row.get("Class (-1=normal 1=abnormal)", ""))
        
        if db not in TARGET_QUOTAS:
            continue

        mat_filename = f"{rec}_StateAns.mat"
        if mat_filename not in mat_names:
            continue

        label = "normal" if cls == "-1" else ("abnormal" if cls == "1" else None)
        if not label:
            continue

        q_score = score_candidate(row)
        candidates[db][label].append((q_score, rec, row))

    selected = []
    for db, quotas in TARGET_QUOTAS.items():
        for label, needed in quotas.items():
            pool = candidates[db][label]
            # Trier par qualité décroissante
            pool.sort(key=lambda x: x[0], reverse=True)
            chosen = pool[:needed]
            if len(chosen) < needed:
                print(f"Attention: {db} {label} n'a que {len(chosen)}/{needed} clips disponibles", file=sys.stderr)
            for q_score, rec, row in chosen:
                selected.append({
                    "db": db,
                    "rec": rec,
                    "label": label,
                    "row": row,
                    "mat_path": f"annotations/hand_corrected/{db}_StateAns/{rec}_StateAns.mat"
                })

    return selected

def extract_annotations(zip_file, mat_path):
    try:
        data = zip_file.read(mat_path)
        mat = scipy.io.loadmat(io.BytesIO(data))
        arr = mat["state_ans"]

        import numpy as np
        events = []
        for i in range(len(arr)):
            sample = int(np.array(arr[i][0]).squeeze())
            lbl = str(np.array(arr[i][1]).squeeze()).strip("[]' ")
            events.append((sample, lbl))

        s1_intervals = []
        s2_intervals = []
        for i in range(len(events)):
            sample, lbl = events[i]
            next_sample = events[i+1][0] if i+1 < len(events) else sample + 200
            t_start = round(sample / 2000.0, 3)
            t_end = round(next_sample / 2000.0, 3)
            if lbl == "S1":
                s1_intervals.append([t_start, t_end])
            elif lbl == "S2":
                s2_intervals.append([t_start, t_end])

        return {"s1": s1_intervals, "s2": s2_intervals}
    except Exception as e:
        print(f"Erreur extraction annotations pour {mat_path}: {e}", file=sys.stderr)
        return {"s1": [], "s2": []}

def download_and_convert(item):
    rec = item["rec"]
    db = item["db"]
    wav_url = f"https://physionet.org/files/challenge-2016/1.0.0/{db}/{rec}.wav"
    mp3_filename = f"{rec}.mp3"
    mp3_path = os.path.join(OUTPUT_AUDIO_DIR, mp3_filename)
    wav_temp_path = os.path.join(OUTPUT_AUDIO_DIR, f"{rec}_temp.wav")

    # Si le MP3 existe déjà et est valide, on passe
    if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 1000:
        return rec, True, mp3_path

    try:
        # Téléchargement WAV
        req = urllib.request.Request(wav_url, headers={"User-Agent": "MedGame-PCG-Builder/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(wav_temp_path, "wb") as out_f:
            out_f.write(resp.read())

        # Conversion ffmpeg en MP3 64 kbps mono 22050 Hz avec normalisation
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", wav_temp_path,
            "-ac", "1",
            "-ar", "22050",
            "-b:a", "64k",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            mp3_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(wav_temp_path):
            os.remove(wav_temp_path)

        if res.returncode != 0 or not os.path.exists(mp3_path):
            print(f"Erreur ffmpeg pour {rec}: {res.stderr}", file=sys.stderr)
            return rec, False, None

        return rec, True, mp3_path
    except Exception as e:
        if os.path.exists(wav_temp_path):
            os.remove(wav_temp_path)
        print(f"Erreur download/convert pour {rec}: {e}", file=sys.stderr)
        return rec, False, None

def generate_clinical_explanation(item, diag_fr, site_fr):
    is_normal = item["label"] == "normal"
    rec = item["rec"]
    db = item["db"]

    if is_normal:
        return (
            f"Phonocardiogramme physiologique ({rec}, cohorte {db}). "
            f"Les bruits B1 et B2 sont bien individualisés, sans dédoublement pathologique, "
            f"ni souffle systolique ou diastolique. "
            f"Chez ce patient asymptomatique ausculté au niveau : {site_fr.lower()}, "
            f"aucun signe de valvulopathie n'est décelable : pas d'indication à référer en cardiologie."
        )
    else:
        return (
            f"Phonocardiogramme pathologique ({rec}, cohorte {db}) : {diag_fr}. "
            f"L'enregistrement révèle une anomalie acoustique (souffle intra-systolique ou bruits surajoutés) "
            f"captée au niveau : {site_fr.lower()}. "
            f"Dans le cadre d'un dépistage clinique, toute auscultation suspecte impose d'adresser le patient "
            f"en consultation cardiologique spécialisée pour réalisation d'une échocardiographie-Doppler transthoracique (ETT)."
        )

def main():
    print(f"Ouverture de l'archive d'annotations: {ANNOTATIONS_ZIP}")
    z = zipfile.ZipFile(ANNOTATIONS_ZIP)

    print("Sélection du sous-ensemble équilibré...")
    selected_items = select_candidates(z)
    print(f"Total sélectionné : {len(selected_items)} clips.")

    norm_count = sum(1 for x in selected_items if x["label"] == "normal")
    abnorm_count = sum(1 for x in selected_items if x["label"] == "abnormal")
    print(f"  Normaux: {norm_count} | Anormaux: {abnorm_count}")

    print("Téléchargement et conversion en MP3 légers (parallèle)...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(download_and_convert, selected_items))

    failed = [r for r, ok, _ in results if not ok]
    if failed:
        print(f"Échec sur {len(failed)} fichiers: {failed}", file=sys.stderr)
        sys.exit(1)

    print("Extraction des annotations et structuration des cas...")
    database = []
    total_audio_bytes = 0

    for item in selected_items:
        rec = item["rec"]
        db = item["db"]
        row = item["row"]
        mp3_rel_path = f"assets/audio/auscultation/pcg/{rec}.mp3"
        mp3_full_path = os.path.join(BASE_DIR, mp3_rel_path)

        if os.path.exists(mp3_full_path):
            total_audio_bytes += os.path.getsize(mp3_full_path)

        ann = extract_annotations(z, item["mat_path"])
        diag_raw = clean_text(row.get("Diagnosis", ""))
        diag_fr = translate_diagnosis(diag_raw)
        site_raw = clean_text(row.get("Transducer site on body", ""))
        site_fr = translate_site(site_raw)
        explanation = generate_clinical_explanation(item, diag_fr, site_fr)

        gender = clean_text(row.get("Gender", "Inconnu"))
        age = clean_text(row.get("Age (year)", ""))
        patient_info = []
        if gender in ["Male", "1"]:
            patient_info.append("Homme")
        elif gender in ["Female", "0"]:
            patient_info.append("Femme")
        if age and age != "0":
            patient_info.append(f"{age} ans")
        patient_str = ", ".join(patient_info) if patient_info else "Patient adulte"

        database.append({
            "id": f"pcg_{rec}",
            "record": rec,
            "set": db,
            "label": item["label"],
            "file": mp3_rel_path,
            "patient": f"{patient_str} • Auscultation : {site_fr}",
            "diagnosis": diag_fr,
            "transducerSite": site_fr,
            "annotations": ann,
            "explanation": explanation,
            "clinicalDecision": "Surveillance standard" if item["label"] == "normal" else "Référer au cardiologue (ETT recommandée)"
        })

    # Trier la base pour alterner sets et types de manière équilibrée
    database.sort(key=lambda x: (x["set"], x["label"], x["record"]))

    print(f"Génération de {OUTPUT_DB_FILE}...")
    import json
    json_content = json.dumps(database, ensure_ascii=False, indent=2)

    js_code = f"""/**
 * data/pcg-trainer-database.js — Base d'entraînement au dépistage PCG (Normal vs Anormal)
 *
 * Source : PhysioNet / Computing in Cardiology Challenge 2016
 * Licence : Open Data Commons Attribution License v1.0 (ODC-BY)
 * Citation : Liu C, Springer D, et al. Physiol Meas 2016;37(12):2181-2213.
 *
 * Total : {len(database)} clips réels équilibrés ({norm_count} normaux, {abnorm_count} anormaux)
 * Couverture : training-a à training-f avec annotations S1/S2 précises.
 */

const PCG_TRAINER_DATABASE = {json_content};

if (typeof window !== 'undefined') {{
    window.PCG_TRAINER_DATABASE = PCG_TRAINER_DATABASE;
}}
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ PCG_TRAINER_DATABASE }};
}}
"""

    with open(OUTPUT_DB_FILE, "w", encoding="utf-8") as f:
        f.write(js_code)

    mb_size = total_audio_bytes / (1024 * 1024)
    print(f"Succès ! {len(database)} clips traités.")
    print(f"Poids total audio ajouté : {mb_size:.2f} Mo dans assets/audio/auscultation/pcg/")

if __name__ == "__main__":
    main()
