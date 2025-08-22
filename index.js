import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Events,
} from 'discord.js';
import 'dotenv/config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ====== Catálogo de armas por categoría (Albion Online) ======
const armasPorCategoria = {
  ESPADAS: [
    "Espada Ancha", "Claymore", "Espadas Dobles", "Espada Clarent",
    "Espada Carving", "Pares de Galatina", "Espada del Rey",
  ],
  HACHAS: [
    "Hacha de Batalla", "Gran Hacha", "Alabarda", "Portador de Carroña",
    "Guadaña Infernal", "Garras de Oso",
  ],
  MAZAS: [
    "Maza", "Maza Pesada", "Lucero del Alba", "Maza de Roca",
    "Maza Íncubo", "Maza de Camlann", "Guardianes del Juramento",
  ],
  MARTILLOS: [
    "Martillo", "Martillo de Pértiga", "Gran Martillo", "Martillo de Tumba",
    "Guardián del Bosque", "Martillos de Forja", "Mano de la Justicia",
  ],
  LANZAS: [
    "Lanza", "Pica", "Guja", "Lanza de Garza",
    "Cazador de Espíritus", "Lanza Trina", "Rompealba",
  ],
  ARCOS: [
    "Arco", "Arco de Guerra", "Arco Largo", "Arco Susurrante",
    "Arco del Lamento", "Arco de Badon", "Perforanieblas",
  ],
  BALLESTAS: [
    "Ballesta", "Ballesta Pesada", "Ballesta Ligera",
    "Ballesta Sollozante", "Lanzarrayos", "Ballesta de Asedio", "Moldeador de Energía",
  ],
  NATURALEZA: [
    "Bastón de Naturaleza", "Gran Bastón de Naturaleza", "Bastón Salvaje",
    "Bastón Druídico", "Bastón de Plaga", "Bastón Exuberante", "Bastón Raíz de Hierro",
  ],
  SAGRADO: [
    "Bastón Sagrado", "Gran Bastón Sagrado", "Bastón Divino",
    "Toque de Vida", "Bastón Caído", "Bastón Redentor", "Santificación",
  ],
  FUEGO: [
    "Bastón de Fuego", "Gran Bastón de Fuego", "Bastón Infernal",
    "Fuego Salvaje", "Bastón de Azufre", "Canción del Alba",
  ],
  ESCARCHA: [
    "Bastón de Escarcha", "Gran Bastón de Escarcha", "Bastón Glacial",
    "Escarcha de Hojarasca", "Prisma de Permafrost", "Bastón de Carámbano", "Aullido Helado",
  ],
  MALDITO: [
    "Bastón Maldito", "Gran Bastón Maldito", "Bastón Demoníaco",
    "Maldición de Vida", "Invocador de Sombras", "Bastón de Condena", "Calavera Maldita",
  ],
  ARCANO: [
    "Bastón Arcano", "Gran Bastón Arcano", "Bastón Enigmático",
    "Bastón Oculto", "Bastón de la Hechicería", "Locus Malévolo", "Canto del Crepúsculo",
  ],
  GUANTES: [
    "Guantes de Peleador", "Brazales de Batalla", "Guanteletes con Púas",
    "Cestus del Cuervo", "Manos de Fuego Infernal", "Desgarradores Ursinos", "Puños de Avalon",
  ],
};


// eventos: Map<eventMessageId, { creador, modo, roles[], asignaciones{rol->userId} }>
const eventos = new Map();

client.once('clientReady', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

function buildRolesText(ev) {
  if (!ev.roles.length) return '*—*';
  return ev.roles
    .map(r => (ev.asignaciones[r] ? `- ${r} · <@${ev.asignaciones[r]}>` : `- ${r}`))
    .join('\n');
}

async function refreshEventMessage(channel, eventMessageId) {
  const ev = eventos.get(eventMessageId);
  if (!ev) return;

  const msg = await channel.messages.fetch(eventMessageId);
  const embedOriginal = EmbedBuilder.from(
    msg.embeds?.[0] ?? new EmbedBuilder().setTitle('Evento')
  );

  let fields = Array.isArray(embedOriginal.data?.fields)
    ? embedOriginal.data.fields
    : [];

  const rolesText = buildRolesText(ev);
  const hasRolesField = fields.some(f => f.name === 'Roles');
  if (hasRolesField) {
    fields = fields.map(f => (f.name === 'Roles' ? { ...f, value: rolesText } : f));
  } else {
    fields.push({ name: 'Roles', value: rolesText, inline: false });
  }
  embedOriginal.setFields(fields);

  const mainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`addRole-${ev.creador}-${eventMessageId}`)
      .setLabel('➕ Agregar Rol')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pickRole-${eventMessageId}`)
      .setLabel('🎯 Elegir Rol')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`closeEvent-${ev.creador}`)
      .setLabel('❌ Cerrar')
      .setStyle(ButtonStyle.Danger),
  );

  await msg.edit({ embeds: [embedOriginal], components: [mainRow] });
}

client.on(Events.InteractionCreate, async (interaction) => {
  // ====== SLASH /evento ======
  if (interaction.isChatInputCommand() && interaction.commandName === 'evento') {
    const nombre = interaction.options.getString('nombre');
    const modo = interaction.options.getString('modo'); // general | pvp | zvz | roads...
    const tierArma = interaction.options.getString('tier_arma');
    const tierArmadura = interaction.options.getString('tier_armadura');
    const horaInput = interaction.options.getString('hora'); // "YYYY-MM-DD HH:mm" UTC

    let horaTexto = '—';
    if (horaInput) {
      try {
        const [fechaStr, horaStr] = horaInput.split(' ');
        const [y, m, d] = fechaStr.split('-').map(Number);
        const [H, M] = horaStr.split(':').map(Number);
        const fechaUTC = new Date(Date.UTC(y, m - 1, d, H, M));
        const unix = Math.floor(fechaUTC.getTime() / 1000);
        horaTexto = `<t:${unix}:F>`;
      } catch {
        horaTexto = '❌ Hora inválida (usa formato YYYY-MM-DD HH:mm en UTC)';
      }
    }

    const eventoData = {
      creador: interaction.user.id,
      modo,
      roles: [],
      asignaciones: {},
    };

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${nombre}`)
      .setColor('Blue')
      .addFields(
        { name: 'Estado', value: '🟢 Abierto', inline: true },
        { name: 'Creador', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Modo', value: modo, inline: true },
        { name: 'Tier Arma', value: tierArma, inline: true },
        { name: 'Tier Armadura', value: tierArmadura, inline: true },
        { name: 'Hora', value: horaTexto, inline: false },
        { name: 'Roles', value: '*—*', inline: false },
      )
      .setFooter({ text: `Evento creado por ${interaction.user.tag}` });

    const tempRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('placeholder').setLabel('➕ Agregar Rol').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('placeholder2').setLabel('🎯 Elegir Rol').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`closeEvent-${interaction.user.id}`).setLabel('❌ Cerrar').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [tempRow] });
    const sentMessage = await interaction.fetchReply();

    const fixedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`addRole-${interaction.user.id}-${sentMessage.id}`).setLabel('➕ Agregar Rol').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`pickRole-${sentMessage.id}`).setLabel('🎯 Elegir Rol').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`closeEvent-${interaction.user.id}`).setLabel('❌ Cerrar').setStyle(ButtonStyle.Danger),
    );

    eventos.set(sentMessage.id, eventoData);
    await sentMessage.edit({ components: [fixedRow] });

    // @everyone al crear
    await interaction.channel.send(`@everyone 📢 ¡Se ha creado un nuevo evento **${nombre}**!`);

    return;
  }

  // ====== BOTONES ======
  if (interaction.isButton()) {
    const parts = interaction.customId.split('-');
    const action = parts[0];

    // ➕ Agregar Rol (solo creador) -> Seleccionar categoría
    if (action === 'addRole') {
      const creatorId = parts[1];
      const eventMessageId = parts[2];

      if (interaction.user.id !== creatorId) {
        return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
      }
      const eventoData = eventos.get(eventMessageId);
      if (!eventoData) {
        return interaction.reply({ content: '⚠️ No encuentro los datos del evento.', flags: 64 });
      }

      // Menú de categorías (siempre <= 25 opciones)
      const categorias = Object.keys(armasPorCategoria);
      const catOptions = categorias.map(c => ({ label: c, value: c }));

      const selectCategorias = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`selectRoleCat-${eventMessageId}`)
          .setPlaceholder('Elige una CATEGORÍA de arma')
          .addOptions(catOptions)
      );

      return interaction.reply({
        content: 'Selecciona una **categoría** de arma para agregar un rol al evento:',
        components: [selectCategorias],
        flags: 64,
      });
    }

    // 🎯 Elegir Rol (todos)
    if (action === 'pickRole') {
      const eventMessageId = parts[1];
      const ev = eventos.get(eventMessageId);
      if (!ev) return interaction.reply({ content: '⚠️ No encuentro el evento.', flags: 64 });
      if (!ev.roles.length) return interaction.reply({ content: '⚠️ Aún no hay roles disponibles.', flags: 64 });

      const yaTengo = Object.entries(ev.asignaciones).find(([, uid]) => uid === interaction.user.id)?.[0];
      const libres = ev.roles.filter(r => !ev.asignaciones[r] || ev.asignaciones[r] === interaction.user.id);

      const opciones = libres.map(r => ({
        label: ev.asignaciones[r] === interaction.user.id ? `${r} (tu rol actual)` : r,
        value: r,
      }));
      if (yaTengo) opciones.push({ label: 'Quitar participación', value: '__leave__' });

      const select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`pickRoleSelect-${eventMessageId}`)
          .setPlaceholder('Elige tu rol para unirte')
          .addOptions(opciones)
      );

      return interaction.reply({
        content: 'Elige un rol para unirte al evento:',
        components: [select],
        flags: 64,
      });
    }

    // ❌ Cerrar (solo creador)
    if (action === 'closeEvent') {
      const creatorId = parts[1];
      if (interaction.user.id !== creatorId) {
        return interaction.reply({ content: '❌ Solo el creador puede cerrar este evento.', flags: 64 });
      }

      const embed = EmbedBuilder.from(interaction.message.embeds?.[0] ?? new EmbedBuilder());
      const fields = embed.data.fields ?? [];
      if (fields.length > 0 && fields[0]?.name === 'Estado') {
        fields[0] = { name: 'Estado', value: '🔴 Cerrado', inline: true };
        embed.setFields(fields);
      } else {
        embed.addFields({ name: 'Estado', value: '🔴 Cerrado', inline: true });
      }

      await interaction.message.edit({ embeds: [embed], components: [] });
      return interaction.reply({ content: '✅ Evento cerrado.', flags: 64 });
    }
  }

  // ====== SELECT: Categoría -> mostrar armas de esa categoría ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectRoleCat-')) {
    const [, eventMessageId] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    if (interaction.user.id !== ev.creador) {
      return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
    }

    const categoria = interaction.values[0];
    const armas = armasPorCategoria[categoria] || [];

    const opcionesArmas = armas.map(a => ({ label: a, value: a }));

    const selectArmas = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`selectRoleWeap-${eventMessageId}-${categoria}`)
        .setPlaceholder(`Elige un arma de ${categoria}`)
        .addOptions(opcionesArmas)
    );

    // Reemplazamos el selector de categorías por el de armas
    await interaction.update({
      content: `Categoría seleccionada: **${categoria}**. Ahora elige el arma:`,
      components: [selectArmas],
    });
    return;
  }

  // ====== SELECT: Arma -> agregar rol al evento (solo creador) ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectRoleWeap-')) {
    const [, eventMessageId /* , categoria */] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    if (interaction.user.id !== ev.creador) {
      return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
    }

    const arma = interaction.values[0];

    if (ev.roles.includes(arma)) {
      await interaction.update({ content: '⚠️ Ese rol ya existe en el evento.', components: [] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
      return;
    }

    ev.roles.push(arma);
    await refreshEventMessage(interaction.channel, eventMessageId);

    await interaction.update({
      content: `✅ Rol **${arma}** agregado al evento.`,
      components: [],
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
    return;
  }

  // ====== SELECT: Elegir/cambiar/salir rol (todos) ======
if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pickRoleSelect-')) {
  const [, eventMessageId] = interaction.customId.split('-');
  const ev = eventos.get(eventMessageId);
  if (!ev) return;

  const choice = interaction.values[0];

  if (choice === '__leave__') {
    const actual = Object.entries(ev.asignaciones).find(([, uid]) => uid === interaction.user.id)?.[0];
    if (actual) delete ev.asignaciones[actual];

    await refreshEventMessage(interaction.channel, eventMessageId);
    await interaction.update({ content: '👋 Has salido del evento.', components: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
    return;
  }

  const ocupadoPor = ev.asignaciones[choice];
  if (ocupadoPor && ocupadoPor !== interaction.user.id) {
    return interaction.reply({ content: '⚠️ Ese rol ya está ocupado.', flags: 64 });
  }

  const rolActual = Object.entries(ev.asignaciones).find(([, uid]) => uid === interaction.user.id)?.[0];
  if (rolActual && rolActual !== choice) delete ev.asignaciones[rolActual];

  ev.asignaciones[choice] = interaction.user.id;

  await refreshEventMessage(interaction.channel, eventMessageId);

  // 🔥 Construir la URL de la build
  const normalizar = (texto) =>
    texto
      .normalize("NFD")                     // quitar acentos
      .replace(/[\u0300-\u036f]/g, "")      // quitar tildes
      .replace(/\s+/g, "_")                 // espacios por guiones bajos
      .replace(/[^A-Za-z0-9_]/g, "");       // quitar caracteres raros

  const modo = ev.modo ? ev.modo.charAt(0).toUpperCase() + ev.modo.slice(1).toLowerCase() : "General";
  const rolFormateado = normalizar(choice);
  const urlBuild = `https://github.com/Rocnarx/Albion-RocBOT/blob/master/${modo}_${rolFormateado}.jpg`;

  await interaction.update({ content: `✅ Te uniste como **${choice}**.\n\n📸 Tu build sugerida:\n${urlBuild}`, components: [] });
  setTimeout(() => interaction.deleteReply().catch(() => {}), 30000); // se borra a los 30s
  return;
}

});

client.login(process.env.DISCORD_TOKEN);
