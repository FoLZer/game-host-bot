const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('remove')
	.setDescription('Removes server from database by ID')
	.addNumberOption(option =>
        option.setName('id')
			.setDescription('ID of the server in the database')
			.setRequired(true));

module.exports = {data};