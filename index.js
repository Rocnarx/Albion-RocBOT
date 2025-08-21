// index.js
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  PermissionFlagsBits,
  bold,
  time,
} from 'discord.js';

// Intents mínimos: Guilds para slash & componentes
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// Estado en memoria (puedes persistir a disco si quieres)
const eventsState = new Map(); // messageId -> { creatorId, roles: Map(role -> { limit, users: Set(userId) }), locked: bool, title, note }

function parseRoles(input) {
  // "Tank=2,Healer=1,DPS=4,Scout"
  // => [{name, limit: number|null}]
  return input.split(',').map(s => s.trim()).filter(Boolean).map(p => {
    const [nameRaw, limitRaw] = p.split('=').map(x => x?.trim());
    const name = nameRaw;
    const limit = limitRaw !== undefined && limitRaw !== '' ? Number(limitRaw) : null;
    if (limit !== null && (Number.isNaN(limit) || limit < 0)) {
      throw new Error(`Cupo inválido para rol "${name}": ${limitRaw}`);
    }
    return { name, limit };
  });
}

function buildEmbed({ title, note, rolesMap, locked, creatorId }) {
  const embed = new EmbedBuilder()
    .setTitle(`📣 ${title}`)
    .setDescription(note ? note : null)
    .setColor(locked ? 0x808080 : 0x00b894)
    .setFooter({ text: locked ? 'Inscripciones cerradas' : 'Toca un botón para anotarte / quitarte' });

  const lines = [];
  for (const [roleName, data] of rolesMap.entries()) {
    const { limit, users } = data;
    const count = users.size;
    const head = limit === null ? `${roleName} (${count})` : `${roleName} (${count}/${limit})`;
    const list = [...users].map(u => `<@${u}>`).join(', ') || '_Vacante_';
    lines.push(`${bold(head)}\n${list}`);
  }

  embed.addFields(
    { name: 'Estado', value: locked ? '🔒 Cerrado' : '🟢 Abierto', inline: true },
    { name: 'Creador', value: `<@${creatorId}>`, inline: true },
  );

  embed.addFields({ name: '\u200B', value: lines.join('\n\n') || '_Sin roles_' });

  return embed;
}

function buildButtons(rolesMap, locked) {
  const rows = [];
  if (!locked) {
    // una fila por hasta 5 botones (Discord limita 5 por fila)
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const roleName of rolesMap.keys()) {
      const btn = new ButtonBuilder()
        .setCustomId(`signup:${roleName}`)
        .setLabel(roleName)
        .setStyle(ButtonStyle.Primary);
      currentRow.addComponents(btn);
      btnCount++;
      if (btnCount === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        btnCount = 0;
      }
    }
    if (btnCount > 0) rows.push(currentRow);
  }

  // Fila de control (Cerrar)
  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_lock')
      .setLabel(locked ? 'Reabrir' : 'Cerrar')
      .setStyle(locked ? ButtonStyle.Secondary : ButtonStyle.Danger),
  );

  rows.push(controlRow);
  return rows;
}

async function updatePanelMessage(interactionOrMessage, state) {
  const embed = buildEmbed({
    title: state.title,
    note: state.note,
    rolesMap: state.roles,
    locked: state.locked,
    creatorId: state.creatorId,
  });
  const components = buildButtons(state.roles, state.locked);
  if ('editReply' in interactionOrMessage) {
    await interactionOrMessage.editReply({ embeds: [embed], components });
  } else {
    await interactionOrMessage.edit({ embeds: [embed], components });
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Conectado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'evento') {
        const title = interaction.options.getString('titulo', true);
        const rolesStr = interaction.options.getString('roles', true);
        const note = interaction.options.getString('nota') ?? '';

        let parsed;
        try {
          parsed = parseRoles(rolesStr);
        } catch (err) {
          await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
          return;
        }

        const rolesMap = new Map();
        for (const r of parsed) {
          rolesMap.set(r.name, { limit: r.limit, users: new Set() });
        }

        await interaction.deferReply();
        const msg = await interaction.editReply({
          embeds: [buildEmbed({ title, note, rolesMap, locked: false, creatorId: interaction.user.id })],
          components: buildButtons(rolesMap, false),
        });

        eventsState.set(msg.id, {
          creatorId: interaction.user.id,
          title,
          note,
          locked: false,
          roles: rolesMap,
        });
      }
      return;
    }

    // Botones
    if (interaction.isButton()) {
      const messageId = interaction.message.id;
      const state = eventsState.get(messageId);
      if (!state) {
        await interaction.reply({ content: '⚠️ Este panel ya no está activo.', ephemeral: true });
        return;
      }

      const isOwner = interaction.user.id === state.creatorId;

      if (interaction.customId === 'toggle_lock') {
        // Solo el creador puede cerrar/abrir
        if (!isOwner) {
          await interaction.reply({ content: 'Solo el creador puede cerrar o reabrir el panel.', ephemeral: true });
          return;
        }
        state.locked = !state.locked;
        await interaction.deferUpdate();
        await updatePanelMessage(interaction, state);
        return;
      }

      const [prefix, roleName] = interaction.customId.split(':');
      if (prefix !== 'signup') return;

      if (state.locked) {
        await interaction.reply({ content: '🔒 Inscripciones cerradas.', ephemeral: true });
        return;
      }

      const role = state.roles.get(roleName);
      if (!role) {
        await interaction.reply({ content: 'Rol no encontrado.', ephemeral: true });
        return;
      }

      const uid = interaction.user.id;

      // Si ya está en ese rol → quitarse
      if (role.users.has(uid)) {
        role.users.delete(uid);
        await interaction.deferUpdate();
        await updatePanelMessage(interaction, state);
        return;
      }

      // Quitar al usuario de otros roles antes de agregar (1 rol por persona)
      for (const [, data] of state.roles.entries()) {
        data.users.delete(uid);
      }

      // Verificar cupo
      if (role.limit !== null && role.users.size >= role.limit) {
        await interaction.reply({ content: `⛔ No hay cupos en **${roleName}**.`, ephemeral: true });
        return;
      }

      role.users.add(uid);
      await interaction.deferUpdate();
      await updatePanelMessage(interaction, state);
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({ content: '❌ Ocurrió un error.', ephemeral: true });
      } catch {}
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
