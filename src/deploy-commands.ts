// Copyright by AcmaTvirus
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
    // Economics commands
    new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn coins and materials'),

    // Assets management
    new SlashCommandBuilder()
        .setName('assets')
        .setDescription('View your property portfolio'),

    // Revenue collection
    new SlashCommandBuilder()
        .setName('collect')
        .setDescription('Collect accumulated rent from all your properties'),

    // Market commands
    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy new land to expand your empire'),

    // Management commands
    new SlashCommandBuilder()
        .setName('upgrade')
        .setDescription('Upgrade a property to increase its rent')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the property to upgrade')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('repair')
        .setDescription('Repair a decaying property')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('The ID of the property to repair')
                .setRequired(true)),

    // User commands
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your account balance and stats'),

    new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Show the main interaction menu'),
].map(command => command.toJSON());

export async function deployCommands(clientId: string, token: string, guildId?: string) {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        if (guildId) {
            console.log(`[Deploy] Registering commands for Guild: ${guildId}`);
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: slashCommands },
            );
        } else {
            console.log(`[Deploy] Registering Global commands...`);
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: slashCommands },
            );
        }
        return { success: true };
    } catch (error) {
        console.error('[Deploy] Error:', error);
        return { success: false, error };
    }
}

// Cho phép chạy độc lập từ lệnh 'npm run deploy'
if (require.main === module) {
    const dotenv = require('dotenv');
    dotenv.config();

    const clientId = process.env.CLIENT_ID;
    const token = process.env.DISCORD_TOKEN;
    const guildId = process.env.GUILD_ID;

    if (clientId && token) {
        deployCommands(clientId, token, guildId).then(result => {
            if (result.success) console.log('✅ Deployment complete!');
        });
    } else {
        console.error('❌ Missing CLIENT_ID or DISCORD_TOKEN in .env');
    }
}
