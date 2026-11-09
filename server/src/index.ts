/**
 * Point d'entrée de l'API RouteBénin (Express).
 */
import { app } from './app.js';
import { env } from './lib/env.js';

app.listen(env.PORT, () => {
  console.log(`✅ API RouteBénin démarrée sur http://localhost:${env.PORT}${env.COMPTES ? ' (comptes activés)' : ''}`);
});
