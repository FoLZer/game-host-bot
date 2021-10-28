const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
	.setName('set')
	.setDescription('Sets values to alter "add" graphs by id')
    .addSubcommand(sub => 
        sub.setName('title')
            .setDescription('Sets the title for the embed')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID of the server in the database')
                    .setRequired(true))
            .addStringOption(option =>
                option.setDescription('Use %IP% to put the ip inside the title')
                .setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('graph_enabled')
            .setDescription('Show graph inside the embed?')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID of the server in the database')
                    .setRequired(true))
            .addBooleanOption(option =>
                option.setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('players_enabled')
            .setDescription('Show players inside the embed?')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID of the server in the database')
                    .setRequired(true))
            .addBooleanOption(option =>
                option.setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('graph_color')
            .setDescription('Sets the color of the graph')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID of the server in the database')
                    .setRequired(true))
            .addStringOption(option => 
                option.setDescription("Hex value of the color")
                    .setRequired(true)))

module.exports = {data};