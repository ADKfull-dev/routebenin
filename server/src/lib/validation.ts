/**
 * Schémas de validation (zod) des données reçues des clients.
 * Toute entrée utilisateur est validée avant traitement.
 */
import { z } from 'zod';

const HEURE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const arretSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  fenetre: z
    .object({
      debut: z.string().regex(HEURE, 'Heure invalide (format HH:MM).').nullable(),
      fin: z.string().regex(HEURE, 'Heure invalide (format HH:MM).').nullable(),
    })
    .nullable()
    .optional(),
  colis: z.number().int().min(0).max(999).optional(),
});

export const optimizeSchema = z.object({
  depart: arretSchema,
  destinations: z.array(arretSchema).min(1, 'Ajoutez au moins une destination.'),
  arrivee: arretSchema.nullable().optional().default(null),
  prefererOsrm: z.boolean().optional().default(true),
  nombreLivreurs: z.number().int().min(1).max(6).optional().default(1),
  critereLivreurs: z.enum(['equilibre', 'arrets']).optional().default('equilibre'),
  minutesParLivraison: z.number().int().min(0).max(120).optional().default(5),
  heureDepart: z.string().regex(HEURE, 'Heure de départ invalide (format HH:MM).').nullable().optional(),
  capaciteVehicule: z.number().int().min(1, 'La capacité doit être d’au moins 1 colis.').max(9999).nullable().optional(),
});

const resultatBaseSchema = z.object({
  etapes: z.array(z.object({ position: z.number(), arret: arretSchema })),
  distanceInitiale: z.number(),
  distanceOptimisee: z.number(),
  gainMetres: z.number(),
  gainPourcent: z.number(),
  dureeSecondes: z.number().nullable(),
  nombreDestinations: z.number(),
  source: z.enum(['osrm', 'haversine']),
  geometrie: z.array(z.tuple([z.number(), z.number()])).nullable(),
  geometrieInitiale: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
  horaires: z
    .object({
      heureDepart: z.number(),
      heureFin: z.number(),
      passages: z.array(z.object({ arrivee: z.number(), attente: z.number(), retard: z.number() })),
      retards: z.number(),
      retardTotal: z.number(),
      attenteTotale: z.number(),
      charge: z.number(),
      capacite: z.number().nullable(),
      avecFenetres: z.boolean(),
      estime: z.boolean(),
    })
    .nullable()
    .optional(),
});

const resultatSchema = resultatBaseSchema.extend({
  livreurs: z.array(resultatBaseSchema).max(6).nullable().optional(),
  critereLivreurs: z.enum(['equilibre', 'arrets']).nullable().optional(),
  minutesParLivraison: z.number().int().min(0).max(120).nullable().optional(),
});

export const sauvegardeSchema = z.object({
  nom: z.string().min(1, 'Donnez un nom à la tournée.').max(120),
  depart: arretSchema,
  arrivee: arretSchema.nullable().optional().default(null),
  destinations: z.array(arretSchema).min(1),
  resultat: resultatSchema,
});

export const profilSchema = z.object({
  nomUtilisateur: z.string().max(120).nullable().optional(),
  nomEntreprise: z.string().max(120).nullable().optional(),
  ville: z.string().max(120).nullable().optional(),
  prefererOsrm: z.boolean().optional(),
  minutesParLivraison: z.number().int().min(0, 'Le temps par livraison ne peut pas être négatif.').max(120, 'Au plus 120 minutes par livraison.').optional(),
});

export type OptimizeInput = z.infer<typeof optimizeSchema>;
export type SauvegardeInput = z.infer<typeof sauvegardeSchema>;
export type ProfilInput = z.infer<typeof profilSchema>;
