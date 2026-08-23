# 🏆 Guide Max Badges — DocteurWu

## État actuel (23/08/2026)
- Profil: https://github.com/DocteurWu → **1 achievement** (`Pull Shark` uniquement), 12 repos, 1 follower
- Repo `medgame` → 5 badges → **passé à 22 badges** (patch `README.md:1-35` fait)

## 1. Badges README (`shields.io`) — ✅ FAIT en local

`README.md` contient maintenant 4 lignes de badges:

| Ligne | Badges |
|---|---|
| Ligne 7-11 | CI, License, Version, Stars, Forks |
| Ligne 13-18 | Issues, PRs, Last Commit, Contributors, Repo Size, Code Size |
| Ligne 20-27 | Three.js, Vanilla JS, Supabase, Docker, Node 20, PRs Welcome, Maintained |
| Ligne 29-34 | Top Language, Commit Activity, PWA, 120+ Cases |

**À faire pour les activer:** `git add README.md .github/workflows/codeql.yml .github/workflows/badge-metrics.yml && git commit -m "badges: max shields 22 badges" && git push`

Les 2 nouveaux workflows donnent 2 badges supplémentaires automatiques dès le 1er push sur `master`.

## 2. Profil README — Template prêt

Fichier `PROFILE_README_TEMPLATE.md` créé (stats, streak, trophies, views, stack).

**Installation 30s:**
1. Va sur https://github.com/new → Repository name = `DocteurWu` (exactement ton username)
2. Coche `Public` + `Add a README`
3. `Create repository`
4. Ouvre `README.md` du nouveau repo → colle tout le contenu de `PROFILE_README_TEMPLATE.md` (ce repo)
5. Commit → https://github.com/DocteurWu affiche instantanément les stats dynamiques

Inclut: `github-readme-stats`, `streak-stats`, `profile-trophy`, `komarev views` — = 4 badges dynamiques + 7 shields stack.

## 3. Achievements GitHub — À farmer (7 manquants)

Ce sont les hexagones sur https://github.com/DocteurWu?tab=achievements

| Badge | Condition | Commande ultra-rapide (5 min chacun) |
|---|---|---|
| **Quickdraw** | Fermer Issue/PR <5min après ouverture | `gh issue create --title "fix: typo" --body "test" --repo DocteurWu/medgame` puis `gh issue close 123` dans la minute |
| **YOLO** | Merger PR sans review | Settings → Branches → désactive protection `master` 2min → `gh pr create` → `gh pr merge --merge --admin` |
| **Pair Extraordinaire** | PR mergée avec `Co-authored-by` | `git commit -m "feat: badges" --trailer "Co-authored-by: Alice <alice@example.com>"` → push → PR → merge |
| **Galaxy Brain** | Réponse acceptée en Discussions | Repo Settings → `☑️ Discussions` → crée Discussion → réponds avec 2e compte → `Mark as answer` |
| **Starstruck** | Repo atteint 16/128/512 stars | Partage `medgame` sur Twitter/Discord med. Demande 15 stars à tes potes = niveau 1 direct |
| **Public Sponsor** | Sponsoriser qqn | https://github.com/sponsors → Sponsor 1$ (remboursable) |
| **Pull Shark x2/x3/x4** | 2/16/128 PRs mergées | Tu as déjà 1 PR → refais 1 PR dummy → niveau 2 débloqué |

**Script tout-en-un (si `gh` installé + `gh auth login`):**
```powershell
# 1. Quickdraw
gh issue create --title "chore: quickdraw test" --body "close me" --repo DocteurWu/medgame
# → note le numéro, puis:
gh issue close <num> --repo DocteurWu/medgame

# 2. Pair Extraordinaire + Pull Shark
git checkout -b farm/badges
echo "# farm" >> BADGES_GUIDE.md
git commit -am "farm: pair badge" --trailer "Co-authored-by: Test <test@test.com>"
git push -u origin farm/badges
gh pr create --title "farm: pair" --body "test" --repo DocteurWu/medgame
gh pr merge --merge --admin --repo DocteurWu/medgame

# 3. YOLO (même PR si pas de review required = YOLO auto)
```

**Arctic Code Vault / Mars 2020** = legacy, plus attribués depuis 2020-2021 — impossible à farmer.

## 4. Badges supplémentaires faciles (optionnel)

- **CodeQL** → déjà ajouté `.github/workflows/codeql.yml` → badge Security dispo: `https://github.com/DocteurWu/medgame/actions/workflows/codeql.yml/badge.svg`
- **GitHub Pages** → Settings → Pages → Deploy from branch → badge `https://img.shields.io/github/deployments/DocteurWu/medgame/github-pages?label=Pages&style=for-the-badge`
- **License + Contributors** déjà présents

## Checklist finale

- [x] README medgame 22 badges (fait, à push)
- [ ] Créer repo `DocteurWu/DocteurWu` + coller PROFILE_README_TEMPLATE.md
- [ ] `git push` medgame → CI + CodeQL passent → badges verts
- [ ] Farmer Quickdraw + YOLO + Pair (15 min)
- [ ] Activer Discussions → Galaxy Brain (5 min)
- [ ] Sponsor 1$ → Public Sponsor
- [ ] Demander 15 stars → Starstruck

Une fois pushé, ton profil passe de 1 à ~7-8 achievements + 25+ shields visibles.
test
