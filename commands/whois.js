const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('whois')
	.setDescription('Allows to query whois info of a domain')
    .addStringOption(option =>
        option.setName('domain')
            .setDescription("Domain of the server")
            .setRequired(true));

module.exports = {data};