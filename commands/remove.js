const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('info')
	.setDescription('Querries server info and outputs it')
	.addNumberOption(option =>
        option.setName('id')
			.setDescription('ID of the server in the database')
			.setRequired(true)

module.exports = {data};