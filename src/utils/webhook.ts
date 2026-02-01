// Copyright by AcmaTvirus
import { WebhookClient, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const webhookUrl = process.env.WEBHOOK_URL;

if (!webhookUrl) {
    console.warn('[Warning] WEBHOOK_URL is not defined in .env. Notifications will be disabled.');
}

const webhookClient = webhookUrl ? new WebhookClient({ url: webhookUrl }) : null;

export class NotificationService {
    static async notifyNewServer(guild: any) {
        const embed = new EmbedBuilder()
            .setTitle('🏰 New Server Joined!')
            .setColor('#2ecc71')
            .addFields(
                { name: 'Server Name', value: guild.name, inline: true },
                { name: 'Server ID', value: guild.id, inline: true },
                { name: 'Member Count', value: `${guild.memberCount}`, inline: true }
            )
            .setThumbnail(guild.iconURL() || null)
            .setTimestamp();

        try {
            if (webhookClient) {
                await webhookClient.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error sending webhook (New Server):', error);
        }
    }

    static async notifyNewPlayer(user: any) {
        const embed = new EmbedBuilder()
            .setTitle('🆕 New Player Registered!')
            .setColor('#3498db')
            .addFields(
                { name: 'Username', value: user.username, inline: true },
                { name: 'User ID', value: user.id, inline: true }
            )
            .setThumbnail(user.displayAvatarURL() || null)
            .setTimestamp();

        try {
            if (webhookClient) {
                await webhookClient.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error sending webhook (New Player):', error);
        }
    }
}
