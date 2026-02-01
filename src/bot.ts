// Copyright by AcmaTvirus
import { Client, GatewayIntentBits, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';
import dotenv from 'dotenv';
import { GameService, LAND_TYPES } from './services/gameService';
import { NotificationService } from './utils/webhook';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    shards: getInfo().SHARD_LIST,
    shardCount: getInfo().TOTAL_SHARDS,
});

// @ts-ignore
client.cluster = new ClusterClient(client);

client.on('ready', () => {
    // @ts-ignore
    console.log(`[Bot] Cluster ${client.cluster.id} Ready! Logged in as: ${client.user?.tag}`);
});

client.on('guildCreate', async (guild) => {
    await NotificationService.notifyNewServer(guild);
});

client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Check for new player
    const userStatus = await GameService.ensureUser(userId);
    if (userStatus.isNew) {
        await NotificationService.notifyNewPlayer(interaction.user);
    }

    // --- Helpers ---

    const renderMainMenu = async (uid: string, uname: string) => {
        const user = await GameService.ensureUser(uid);
        const assets = await GameService.getAssets(uid);
        // Balance formula from exp.md: 100 * Math.pow(level, 1.5)
        const expNeeded = Math.floor(100 * Math.pow(user.level, 1.5));
        const progress = Math.floor((parseInt(user.exp) / expNeeded) * 100);

        const embed = new EmbedBuilder()
            .setAuthor({ name: uname, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('🏠 Virtual House - Management Office')
            .setColor('#3498db')
            .addFields(
                { name: '👤 Player Profile', value: `Level: **${user.level}** (${progress}%)\nEXP: **${user.exp}/${expNeeded}**`, inline: false },
                { name: '💰 Balance', value: `**$${user.balance.toLocaleString()}**`, inline: true },
                { name: '📊 Portfolio', value: `Properties: **${assets.length}**`, inline: true }
            )
            .setDescription('Maximize your passive income by managing your property portfolio efficiently.');

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_work').setLabel('Work').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('button_shop').setLabel('Shop').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('button_assets').setLabel('Assets').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_sell').setLabel('Sell Fast').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('button_collect').setLabel('Collect Rent').setStyle(ButtonStyle.Success)
        );

        return { embeds: [embed], components: [row1, row2] };
    };

    const renderShop = async (uid: string) => {
        const user = await GameService.ensureUser(uid);
        const assets = await GameService.getAssets(uid);
        const ownedTypes = new Set(assets.map((a: any) => a.land_type));

        const embed = new EmbedBuilder()
            .setTitle('🛒 Real Estate Marketplace')
            .setDescription(`Your Balance: **$${user.balance.toLocaleString()}**`)
            .setColor('#00FF7F');

        const row = new ActionRowBuilder<ButtonBuilder>();
        Object.entries(LAND_TYPES).forEach(([key, land]) => {
            const isOwned = ownedTypes.has(key);
            const canAfford = user.balance >= land.price;

            let label = `${land.emoji} $${land.price.toLocaleString()}`;
            let btnStyle = ButtonStyle.Primary;
            let disabled = false;

            if (isOwned) {
                label = `${land.emoji} Selected`;
                btnStyle = ButtonStyle.Success;
                disabled = true;
            } else if (!canAfford) {
                btnStyle = ButtonStyle.Secondary;
                disabled = true;
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`buy_${key}`)
                    .setLabel(label)
                    .setStyle(btnStyle)
                    .setDisabled(disabled)
            );
        });

        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_return').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row, controlRow] };
    };

    const renderAssetsList = async (uid: string) => {
        const assets = await GameService.getAssets(uid);
        const embed = new EmbedBuilder()
            .setTitle('🏘️ Property Portfolio')
            .setDescription('Select a property to view detailed info, upgrade, or repair.')
            .setColor('#4169E1');

        if (assets.length === 0) {
            embed.setDescription('🚫 No properties owned. Visit the Shop to start investing!');
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('button_return').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
            );
            return { embeds: [embed], components: [row] };
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        assets.slice(0, 10).forEach((h: any, idx: number) => {
            if (idx > 0 && idx % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`asset_detail_${h.id}`)
                    .setLabel(`#${h.id} ${LAND_TYPES[h.land_type]?.name || 'House'}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });
        rows.push(currentRow);

        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_return').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        );
        rows.push(controlRow);

        return { embeds: [embed], components: rows };
    };

    const renderAssetDetail = async (uid: string, houseId: number) => {
        const assets = await GameService.getAssets(uid);
        const house = assets.find((a: any) => a.id === houseId);

        if (!house) return renderAssetsList(uid);

        const land = LAND_TYPES[house.land_type];
        const now = new Date();
        const seconds = (now.getTime() - new Date(house.last_collect_time).getTime()) / 1000;

        const currentRate = GameService.getRentRate(house);
        const effectiveRate = currentRate * (house.condition / 100);
        const pendingRent = effectiveRate * seconds;

        const upgradeCost = Math.floor(land.price * 0.5 * house.level);
        const repairCost = (100 - house.condition) * 10;

        const embed = new EmbedBuilder()
            .setTitle(`🏠 Detail: ${land.name} #${house.id}`)
            .setColor(house.is_gold ? '#f1c40f' : '#95a5a6')
            .addFields(
                { name: 'Level', value: `Level ${house.level}`, inline: true },
                { name: 'Condition', value: `${house.condition}%`, inline: true },
                { name: 'Rarity', value: house.is_gold ? '🌟 GOLD' : 'Standard', inline: true },
                { name: 'Pending Rent', value: `**$${Math.max(0, Math.floor(pendingRent)).toLocaleString()}**`, inline: false },
                { name: 'Current Rate', value: `$${currentRate.toFixed(2)}/s`, inline: true }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`sell_confirm_${house.id}`).setLabel('Sell').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`upgrade_confirm_${house.id}`).setLabel(`Upgrade ($${upgradeCost.toLocaleString()})`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`repair_confirm_${house.id}`).setLabel(`Repair ($${repairCost.toLocaleString()})`).setStyle(ButtonStyle.Success).setDisabled(house.condition >= 100)
        );

        const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_assets').setLabel('Back to List').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('button_return').setLabel('Main Menu').setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row, navRow] };
    };

    const renderWorkResult = async (uid: string, uname: string, earned?: number, remaining?: number, expGain?: number) => {
        const user = await GameService.ensureUser(uid);
        const embed = new EmbedBuilder().setColor('#2ecc71');

        if (earned !== undefined) {
            embed.setAuthor({ name: uname, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`✅ You earned **$${earned.toLocaleString()}**.\n✨ EXP Gained: **+${expGain}**\n💰 Balance: **$${user.balance.toLocaleString()}**`);
        } else {
            embed.setAuthor({ name: uname, iconURL: interaction.user.displayAvatarURL() }).setColor('#e74c3c')
                .setDescription(`⏳ Cooldown: **${remaining}s** remaining.`);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('button_work').setLabel('Work').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('button_collect').setLabel('Collect').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('button_return').setLabel('Return').setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row] };
    };

    const renderSellMenu = async (uid: string) => {
        const assets = await GameService.getAssets(uid);
        const embed = new EmbedBuilder()
            .setTitle('🏘️ Quick Sell')
            .setDescription('Get 75% of the purchase price back immediately.')
            .setColor('#e67e22');

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        if (assets.length === 0) {
            embed.setDescription('🚫 No properties to sell.');
        } else {
            assets.slice(0, 4).forEach((h: any) => {
                const land = LAND_TYPES[h.land_type];
                currentRow.addComponents(
                    new ButtonBuilder().setCustomId(`sell_confirm_${h.id}`).setLabel(`Sell #${h.id} (+$${Math.floor(land.price * 0.75).toLocaleString()})`).setStyle(ButtonStyle.Danger)
                );
            });
            rows.push(currentRow);
        }
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('button_return').setLabel('Back').setStyle(ButtonStyle.Secondary)));
        return { embeds: [embed], components: rows };
    };

    // --- Interaction Dispatcher ---

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'work') {
            const result = await GameService.work(userId);
            const response = await renderWorkResult(userId, username, result.success ? (result as any).earned : undefined, !result.success ? (result as any).remaining : undefined, result.success ? (result as any).expGain : undefined);
            await interaction.reply(response);
            if (result.success && (result as any).leveledUp) {
                await interaction.followUp({ content: `🎊 **CONGRATULATIONS!** You leveled up to **Level ${(result as any).currentLevel}**!`, ephemeral: true });
            }
            return;
        }
        if (commandName === 'profile' || commandName === 'menu') return interaction.reply(await renderMainMenu(userId, username));
        if (commandName === 'shop') return interaction.reply(await renderShop(userId));
        if (commandName === 'assets') return interaction.reply(await renderAssetsList(userId));
        if (commandName === 'sell') return interaction.reply(await renderSellMenu(userId));
        if (commandName === 'collect') {
            const result = await GameService.collectRent(userId);
            return interaction.reply({ content: result.count === 0 ? '🏚️ Nothing to collect!' : `💰 Collected **$${result.total.toLocaleString()}**!`, ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === 'button_work') {
            const result = await GameService.work(userId);
            const response = await renderWorkResult(userId, username, result.success ? (result as any).earned : undefined, !result.success ? (result as any).remaining : undefined, result.success ? (result as any).expGain : undefined);
            await interaction.update(response);
            if (result.success && (result as any).leveledUp) {
                await interaction.followUp({ content: `🎊 **CONGRATULATIONS!** You leveled up to **Level ${(result as any).currentLevel}**!`, ephemeral: true });
            }
            return;
        }
        if (customId === 'button_shop') return interaction.update(await renderShop(userId));
        if (customId === 'button_assets') return interaction.update(await renderAssetsList(userId));
        if (customId === 'button_sell') return interaction.update(await renderSellMenu(userId));
        if (customId === 'button_return') return interaction.update(await renderMainMenu(userId, username));
        if (customId === 'button_collect') {
            const result = await GameService.collectRent(userId);
            return interaction.reply({ content: result.count === 0 ? '🏚️ Nothing to collect!' : `💰 Collected **$${result.total.toLocaleString()}**!`, ephemeral: true });
        }
        if (customId.startsWith('asset_detail_')) {
            const id = parseInt(customId.split('_').pop()!);
            return interaction.update(await renderAssetDetail(userId, id));
        }
        if (customId.startsWith('buy_')) {
            const landKey = customId.replace('buy_', '');
            const result = await GameService.buyLand(userId, landKey);
            if (!result.success) return interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            return interaction.update(await renderShop(userId));
        }
        if (customId.startsWith('sell_confirm_')) {
            const id = parseInt(customId.split('_').pop()!);
            const result = await GameService.sellLand(userId, id);
            if (!result.success) return interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            return interaction.update(await renderMainMenu(userId, username));
        }
        if (customId.startsWith('upgrade_confirm_')) {
            const id = parseInt(customId.split('_').pop()!);
            const result = await GameService.upgradeProperty(userId, id);
            if (!result.success) return interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });

            await interaction.update(await renderAssetDetail(userId, id));
            return interaction.followUp({ content: `✅ Upgraded to Level ${(result as any).newLevel}! Collected **$${result.earned?.toLocaleString()}** in pending rent.`, ephemeral: true });
        }
        if (customId.startsWith('repair_confirm_')) {
            const id = parseInt(customId.split('_').pop()!);
            const result = await GameService.repairProperty(userId, id);
            if (!result.success) return interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
            return interaction.update(await renderAssetDetail(userId, id));
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
