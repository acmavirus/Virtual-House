// Copyright by AcmaTvirus
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
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
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        if (process.env.GUILD_ID) {
            console.log('Registering commands to Guild ID:', process.env.GUILD_ID);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands (Guild).');
        } else {
            console.log('Registering Global commands...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID!),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands (Global).');
        }
    } catch (error) {
        console.error('Error while registering commands:', error);
    }
})();
