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

// ====== Helpers ======
function normalizarNombre(t) {
  return (t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}
function modoToPrefix(modo) {
  const m = (modo || '').toLowerCase();
  if (m === 'zvz') return 'ZvZ';
  if (m === 'roads') return 'Roads';
  if (m === 'pvp') return 'PvP';
  return m ? m[0].toUpperCase() + m.slice(1) : 'General';
}

// eventos: Map<eventMessageId, {
//   creador, modo,
//   roles: string[],                                   // etiquetas visibles ("Bastón X HEALER")
//   roleMeta: Record<string,{ arma:string, tag:string, cap:number, miembros:string[] }>
// }>
const eventos = new Map();

client.once('clientReady', () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
});

function buildRolesText(ev) {
  if (!ev.roles.length) return '*—*';
  return ev.roles.map(et => {
    const meta = ev.roleMeta?.[et];
    if (!meta) return `- ${et}`;
    const cap = meta.cap ?? 1;
    const count = meta.miembros?.length ?? 0;
    const lista = count ? ` · ${meta.miembros.map(uid => `<@${uid}>`).join(', ')}` : '';
    return `- ${et} (${count}/${cap})${lista}`;
  }).join('\n');
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
      roleMeta: {},
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

      // Mostrar solo roles que no estén llenos o que ya sean del usuario
      const actualDelUser = ev.roles.find(r => ev.roleMeta?.[r]?.miembros?.includes(interaction.user.id));
      const opciones = ev.roles
        .filter(r => {
          const meta = ev.roleMeta?.[r];
          if (!meta) return true;
          const lleno = (meta.miembros?.length ?? 0) >= (meta.cap ?? 1);
          const esMio = meta.miembros?.includes(interaction.user.id);
          return !lleno || esMio;
        })
        .map(r => {
          const meta = ev.roleMeta?.[r];
          const count = meta?.miembros?.length ?? 0;
          const cap = meta?.cap ?? 1;
          const etiqueta = (actualDelUser === r) ? `${r} (tu rol actual)` : `${r} (${count}/${cap})`;
          return { label: etiqueta, value: r };
        });

      if (actualDelUser) opciones.push({ label: 'Quitar participación', value: '__leave__' });

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

    await interaction.update({
      content: `Categoría seleccionada: **${categoria}**. Ahora elige el arma:`,
      components: [selectArmas],
    });
    return;
  }

  // ====== SELECT: Arma -> pedir Tag (DPS/HEALER/SUPPORT) ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectRoleWeap-')) {
    const [, eventMessageId] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    if (interaction.user.id !== ev.creador) {
      return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
    }

    const armaBase = interaction.values[0];

    const tagOptions = [
      { label: 'DPS', value: `tag|${armaBase}|DPS` },
      { label: 'HEALER', value: `tag|${armaBase}|HEALER` },
      { label: 'SUPPORT', value: `tag|${armaBase}|SUPPORT` },
    ];

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`selectRoleTag-${eventMessageId}`)
        .setPlaceholder(`Elige etiqueta para ${armaBase}: DPS / HEALER / SUPPORT`)
        .addOptions(tagOptions)
    );

    await interaction.update({
      content: `Arma seleccionada: **${armaBase}**. Elige la etiqueta del rol:`,
      components: [row],
    });
    return;
  }

  // ====== SELECT: Tag -> pedir Capacidad (1-5) y crear rol ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectRoleTag-')) {
    const [, eventMessageId] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    if (interaction.user.id !== ev.creador) {
      return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
    }

    const selected = interaction.values[0]; // "tag|<armaBase>|<TAG>"
    const [, armaBase, tag] = selected.split('|');

    // Selector de capacidad 1..5
    const caps = [1,2,3,4,5].map(n => ({ label: `${n} jugador${n>1?'es':''}`, value: `cap|${armaBase}|${tag}|${n}` }));
    const rowCap = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`selectRoleCap-${eventMessageId}`)
        .setPlaceholder(`Capacidad para ${armaBase} ${tag}`)
        .addOptions(caps)
    );

    await interaction.update({
      content: `Etiqueta seleccionada: **${armaBase} ${tag}**. Elige la **capacidad**:`,
      components: [rowCap],
    });
    return;
  }

  // ====== SELECT: Capacidad -> crear rol arma+tag con cap ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selectRoleCap-')) {
    const [, eventMessageId] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    if (interaction.user.id !== ev.creador) {
      return interaction.reply({ content: '❌ Solo el creador puede agregar roles.', flags: 64 });
    }

    const selected = interaction.values[0]; // "cap|<armaBase>|<tag>|<n>"
    const [, armaBase, tag, nStr] = selected.split('|');
    const cap = Math.max(1, Math.min(5, Number(nStr) || 1));

    const etiqueta = `${armaBase} ${tag}`; // ej: "Bastón de Escarcha HEALER"

    if (ev.roles.includes(etiqueta)) {
      await interaction.update({ content: '⚠️ Ese rol ya existe.', components: [] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
      return;
    }

    ev.roles.push(etiqueta);
    ev.roleMeta[etiqueta] = { arma: armaBase, tag, cap, miembros: [] };

    await refreshEventMessage(interaction.channel, eventMessageId);
    await interaction.update({ content: `✅ Rol **${etiqueta}** agregado (capacidad ${cap}).`, components: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
    return;
  }

  // ====== SELECT: Elegir/cambiar/salir rol (todos) ======
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pickRoleSelect-')) {
    const [, eventMessageId] = interaction.customId.split('-');
    const ev = eventos.get(eventMessageId);
    if (!ev) return;

    const etiqueta = interaction.values[0];

    if (etiqueta === '__leave__') {
      const anterior = ev.roles.find(r => ev.roleMeta?.[r]?.miembros?.includes(interaction.user.id));
      if (anterior) {
        ev.roleMeta[anterior].miembros = ev.roleMeta[anterior].miembros.filter(id => id !== interaction.user.id);
        await refreshEventMessage(interaction.channel, eventMessageId);
      }
      await interaction.update({ content: '👋 Has salido del evento.', components: [] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 1500);
      return;
    }

    const meta = ev.roleMeta?.[etiqueta];
    if (!meta) {
      return interaction.reply({ content: '⚠️ Rol inválido.', flags: 64 });
    }

    const lleno = (meta.miembros?.length ?? 0) >= (meta.cap ?? 1);
    const yaEstoy = meta.miembros?.includes(interaction.user.id);

    if (lleno && !yaEstoy) {
      return interaction.reply({ content: '⚠️ Ese rol ya está completo.', flags: 64 });
    }

    // liberar rol anterior si tenía
    const anterior = ev.roles.find(r => ev.roleMeta?.[r]?.miembros?.includes(interaction.user.id));
    if (anterior && anterior !== etiqueta) {
      ev.roleMeta[anterior].miembros = ev.roleMeta[anterior].miembros.filter(id => id !== interaction.user.id);
    }

    // agregar a este rol si no estaba
    if (!yaEstoy) {
      meta.miembros = meta.miembros || [];
      meta.miembros.push(interaction.user.id);
    }

    await refreshEventMessage(interaction.channel, eventMessageId);

    // URL de build <Modo>_<Arma>_<TAG>.jpg
    const modo = modoToPrefix(ev.modo || 'General');
    const armaNorm = normalizarNombre(meta.arma || etiqueta);
    const tag = meta.tag || 'DPS';
    const urlBuild = `https://raw.githubusercontent.com/Rocnarx/Albion-RocBOT/master/${modo}_${armaNorm}_${tag}.png`;

    await interaction.update({
      content: `✅ Te uniste como **${etiqueta}**.\n\n📸 Tu build sugerida:\n${urlBuild}`,
      components: [],
    });
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
