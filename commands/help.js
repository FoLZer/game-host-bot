const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('help')
	.setDescription('Shows available commands for the bot')

module.exports = {data};