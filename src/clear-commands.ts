// Copyright by AcmaTvirus
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('--- CLEANING COMMANDS ---');

        // Delete Global Commands
        console.log('Clearing Global commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] });
        console.log('Successfully cleared Global commands.');

        // Delete Guild Commands if GUILD_ID is provided
        if (process.env.GUILD_ID) {
            console.log(`Clearing Guild commands for ID: ${process.env.GUILD_ID}...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
                { body: [] }
            );
            console.log('Successfully cleared Guild commands.');
        }

        console.log('Cleaning complete. You can now run "npm run deploy" to register fresh commands.');
    } catch (error) {
        console.error('Error during cleaning:', error);
    }
})();
