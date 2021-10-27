const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('invite')
	.setDescription('Shows a button to invite the bot')

module.exports = {data};