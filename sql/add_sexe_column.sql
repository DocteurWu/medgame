-- Migration pour ajouter la colonne sexe à la table profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sexe text DEFAULT 'M';
