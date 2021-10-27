const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('add')
	.setDescription('Adds a server to watchlist')
	.addStringOption(option =>
        option.setName('type')
			.setDescription('Type of the server')
			.setRequired(true)
			.addChoice('Garry\' mod', 'gmod')
			.addChoice('Minecraft', 'minecraft'))
    .addStringOption(option =>
        option.setName('ip')
            .setDescription("Ip of the server")
            .setRequired(true));

module.exports = {data};