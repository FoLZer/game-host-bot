const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const fs = require("fs");
const rest = new REST({ version: '9' }).setToken(process.env.token);

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

module.exports = async (guildId, doDeletePrev) => {
	try {
		console.log('Started refreshing application (/) commands.');
		if(doDeletePrev) {
			const data = await rest.get(Routes.applicationGuildCommands(process.env.client_id, guildId));
			const promises = [];
			for (const command of data) {
				const deleteUrl = `${Routes.applicationGuildCommands(process.env.client_id, guildId)}/${command.id}`;
				promises.push(rest.delete(deleteUrl));
			}
			await Promise.all(promises);
		}

		await rest.put(
            Routes.applicationGuildCommands(process.env.client_id, guildId),
            { body: commands },
        );

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}