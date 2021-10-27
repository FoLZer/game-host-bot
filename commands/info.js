const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('info')
	.setDescription('Querries server info and outputs it')
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