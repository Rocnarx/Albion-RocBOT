// deploy-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Crea un panel de inscripción por roles')
    .addStringOption(o => o
      .setName('titulo')
      .setDescription('Título del evento (Ej: Ava Road 20:00)')
      .setRequired(true))
    .addStringOption(o => o
      .setName('roles')
      .setDescription('Roles y cupos (Ej: Tank=2,Healer=1,DPS=4 o Scout)')
      .setRequired(true))
    .addStringOption(o => o
      .setName('nota')
      .setDescription('Texto adicional (Ej: IP mínimo, loot rules, etc.)')
      .setRequired(false)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands },
    );
    console.log('✅ Comandos desplegados');
  } catch (err) {
    console.error(err);
  }
})();
