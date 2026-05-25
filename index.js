require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PANEL_CHANNEL_ID = "1508452405639909609";
const SUPPORT_ROLE_ID = "1508462799519612963";

const ticketData = new Map();

client.once("clientReady", async () => {
  console.log(`✅ מחובר בתור ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);

  if (!channel) {
    console.log("❌ לא מצאתי את החדר. תבדקי את PANEL_CHANNEL_ID");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🎫 מערכת טיקטים")
    .setDescription("בחרי סוג טיקט לפתיחה")
    .setColor("#5865F2");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("📩 בחרי סוג טיקט")
    .addOptions(
      {
        label: "טיקט בחינה",
        description: "עזרה לגבי מבחנים",
        emoji: "📘",
        value: "exam"
      },
      {
        label: "טיקט שאלה",
        description: "שאלה כללית",
        emoji: "❓",
        value: "question"
      }
    );

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  });
});

client.on("interactionCreate", async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const type = interaction.values[0];

    const ticketName =
      type === "exam"
        ? `בחינה-${interaction.user.username}`
        : `שאלה-${interaction.user.username}`;

    const ticketChannel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: SUPPORT_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });

    ticketData.set(ticketChannel.id, {
      ownerId: interaction.user.id,
      claimedBy: "אף אחד",
      closedBy: "לא נסגר"
    });

    const infoEmbed = new EmbedBuilder()
      .setTitle("🎫 טיקט נפתח")
      .setColor("#57F287")
      .addFields(
        {
          name: "👤 פתח את הטיקט",
          value: `${interaction.user}`,
          inline: true
        },
        {
          name: "🧑‍💼 לקח את הטיקט",
          value: "אף אחד",
          inline: true
        },
        {
          name: "🔒 סגר את הטיקט",
          value: "לא נסגר",
          inline: true
        }
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("לקחת טיקט")
        .setEmoji("🙋")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("add_user")
        .setLabel("להוסיף שחקן")
        .setEmoji("➕")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("סגור טיקט")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `${interaction.user} <@&${SUPPORT_ROLE_ID}>`,
      embeds: [infoEmbed],
      components: [buttons]
    });

    await interaction.reply({
      content: `✅ הטיקט נפתח: ${ticketChannel}`,
      ephemeral: true
    });
  }

  if (interaction.isButton() && interaction.customId === "claim_ticket") {
    const data = ticketData.get(interaction.channel.id);

    if (!data) {
      await interaction.reply({
        content: "❌ לא מצאתי מידע על הטיקט הזה.",
        ephemeral: true
      });
      return;
    }

    data.claimedBy = interaction.user.tag;

    const embed = new EmbedBuilder()
      .setTitle("🎫 טבלת טיקט")
      .setColor("#FEE75C")
      .addFields(
        {
          name: "👤 פתח",
          value: `<@${data.ownerId}>`,
          inline: true
        },
        {
          name: "🧑‍💼 לקח",
          value: `${interaction.user}`,
          inline: true
        },
        {
          name: "🔒 סגר",
          value: "לא נסגר",
          inline: true
        }
      );

    await interaction.reply({
      content: `✅ ${interaction.user} לקח את הטיקט`,
      embeds: [embed]
    });
  }

  if (interaction.isButton() && interaction.customId === "add_user") {
    const modal = new ModalBuilder()
      .setCustomId("add_user_modal")
      .setTitle("הוספת שחקן לטיקט");

    const input = new TextInputBuilder()
      .setCustomId("user_id")
      .setLabel("תכתבי ID של השחקן")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "add_user_modal") {
    const userId = interaction.fields.getTextInputValue("user_id");

    await interaction.channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    await interaction.reply(`✅ הוספתי את <@${userId}> לטיקט`);
  }

  if (interaction.isButton() && interaction.customId === "close_ticket") {
    const data = ticketData.get(interaction.channel.id);

    if (!data) {
      await interaction.reply("❌ לא מצאתי מידע על הטיקט הזה.");
      return;
    }

    data.closedBy = interaction.user.tag;

    await interaction.reply("🔒 סוגר טיקט ושולח סיכום בפרטי...");

    const messages = await interaction.channel.messages.fetch({ limit: 100 });

    const transcript = messages
      .reverse()
      .map(message => `${message.author.tag}: ${message.content}`)
      .join("\n");

    const file = new AttachmentBuilder(
      Buffer.from(transcript || "אין הודעות"),
      { name: "ticket-transcript.txt" }
    );

    try {
      const owner = await client.users.fetch(data.ownerId);

      await owner.send({
        content:
          `הטיקט שלך נסגר.\n` +
          `לקח את הטיקט: ${data.claimedBy}\n` +
          `סגר את הטיקט: ${data.closedBy}`,
        files: [file]
      });
    } catch (error) {
      console.log("לא הצלחתי לשלוח הודעה פרטית למשתמש.");
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

client.login("MTUwODQ0NzgzMzgzNjA5MzYxMQ.GCH4w8.gFXuf_77UpfFGOm08HlxGS0bJGs6AMb57V9pGk");
