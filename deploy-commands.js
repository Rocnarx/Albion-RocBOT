// deploy-commands.js
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const commands = [
  {
    name: 'evento',
    description: 'Crea un evento',
    options: [
      {
        name: 'modo',
        description: 'Selecciona el modo',
        type: 3,
        required: true,
        choices: [
          { name: 'Roaming', value: 'roaming' },
          { name: 'Rastreo', value: 'rastreo' },
          { name: 'Gankeo', value: 'gankeo' },
          { name: 'PvP', value: 'pvp' },
          { name: 'ZvZ', value: 'zvz' },
          { name: 'Dorados', value: 'dorados' },
          { name: 'Estatica', value: 'estatica' },
          { name: 'Ava', value: 'ava' },
          { name: 'Grupales', value: 'grupales' },
        ],
      },
      { name: 'nombre', description: 'Nombre del evento', type: 3, required: true },
      { name: 'tier_arma', description: 'Ejemplo: Arma T8', type: 3, required: true },
      { name: 'tier_armadura', description: 'Ejemplo: Armadura T7', type: 3, required: true },
      { name: 'hora', description: 'Hora UTC (YYYY-MM-DD HH:mm)', type: 3, required: true },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Registrando slash commands (guild)…');

    // 1) Registrar SOLO en el servidor (guild)
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands },
    );
    console.log('✅ Guild commands actualizados');

    // 2) (IMPORTANTE) Borrar comandos GLOBALS para evitar duplicados
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: [] },                           // ← vacía la lista global
    );
    console.log('🧹 Global commands eliminados');

    console.log('🎉 Listo');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
    process.exit(1);
  }
})();
