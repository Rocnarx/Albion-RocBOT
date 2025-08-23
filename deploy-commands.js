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
        type: 3, // STRING
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
        ],
      },
      {
        name: 'nombre',
        description: 'Nombre del evento',
        type: 3,
        required: true,
      },
      {
        name: 'tier_arma',
        description: 'Ejemplo: Arma T8',
        type: 3,
        required: true,
      },
      {
        name: 'tier_armadura',
        description: 'Ejemplo: Armadura T7',
        type: 3,
        required: true,
      },
      {
        name: 'hora',
        description: 'Hora del evento en formato UTC (ejemplo: 2025-08-28 12:00)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🚀 Registrando slash commands...');

    // 🚨 Guild commands (instantáneo)
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID,
      ),
      { body: commands },
    );

    console.log('✅ Comandos actualizados en el servidor!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
    process.exit(1);
  }
})();
