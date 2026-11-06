/**
 * Schémas de validation (zod) des données reçues des clients.
 * Toute entrée utilisateur est validée avant traitement.
 */
import { z } from 'zod';

export const arretSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const optimizeSchema = z.object({
  depart: arretSchema,
  destinations: z.array(arretSchema).min(1, 'Ajoutez au moins une destination.'),
  arrivee: arretSchema.nullable().optional().default(null),
  prefererOsrm: z.boolean().optional().default(true),
});

const resultatSchema = z.object({
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
});

export type OptimizeInput = z.infer<typeof optimizeSchema>;
export type SauvegardeInput = z.infer<typeof sauvegardeSchema>;
export type ProfilInput = z.infer<typeof profilSchema>;
