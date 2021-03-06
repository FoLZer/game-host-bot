const discord = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const isIp = require('is-ip');
const isValidDomain = require('is-valid-domain');
const query = require("source-server-query");
const dns = require('dns');
require("dotenv").config();
const reqSlash = require("./regSlash");
const cron = require("cron");
const Query = require("mcquery");
const JSDOM = require("jsdom");
const whois = require("whois");
const isHexcolor = require('is-hexcolor')
const moment = require("moment");
const utf8 = require("utf8");
const regSlash = require("./regSlash");
const { svg2png } = require('svg-png-converter')

const dom = new JSDOM.JSDOM(`
<body>
    <div id="gd"></div>
    <script src="https://cdn.plot.ly/plotly-2.5.1.js"></script>
    <script>
        function drawPlot(json) {
            const graphDiv = document.getElementById('gd')
            Plotly.newPlot(graphDiv, JSON.parse(json));
            return graphDiv.children[0].children[0].children[0].outerHTML;
        }
    </script>
</body>
`.trim(), { runScripts: "outside-only", resources: "usable" });
dom.window.URL.createObjectURL = () => {};
dom.window.URL.revokeObjectURL = () => {};

const EMBED_COLORS = {
    OK: "#3a974c",
    ERROR: "#ce4141",
    OTHER: "#e24563"
}

const types = {
    0: "gmod",
    1: "minecraft"
}

const db = new sqlite3.Database("servers.db", sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if(err) {
        console.log("Failed to create servers db");
        process.exit(1);
    }
    db.run("CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY, type INTEGER, ip TEXT, port INTEGER, ip_input TEXT, message_id TEXT, channel_id TEXT, guild_id TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS server_statuses (id INTEGER, players INTEGER, date INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS servers_settings (id INTEGER PRIMARY KEY, title TEXT, graph_enabled BOOLEAN, players_enabled BOOLEAN, graph_color TEXT)");
})

const client = new discord.Client({ intents: [discord.Intents.FLAGS.GUILDS] });

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    switch(interaction.commandName) {
        case "add": {
            const member = await interaction.member.fetch();
            if(!member.permissions.has('ADMINISTRATOR')) {
                const embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("No access!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            const type = interaction.options.getString("type");
            const ip_unsplit = interaction.options.getString("ip");
            let embed;
            const ip = await parseIPorDomain(ip_unsplit.split(":")[0], ip_unsplit);
            if(Number.isInteger(ip)) {
                if(ip) {
                    embed = new discord.MessageEmbed()
                        .setTitle("Error!")
                        .setDescription("DNS could not be resolved!")
                        .setColor(EMBED_COLORS.ERROR);
                    interaction.reply({embeds: [embed], ephemeral: true});
                } else {
                    embed = new discord.MessageEmbed()
                        .setTitle("Error!")
                        .setDescription("Ip is not valid!")
                        .setColor(EMBED_COLORS.ERROR);
                    interaction.reply({embeds: [embed], ephemeral: true});
                }
            }
            const type_int = Object.values(types).indexOf(type);
            const [err, r, port] = await queryServer(type_int, ip, ip_unsplit.includes(":"), ip_unsplit.split(":")[1]);
            if(err) {
                embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("Query wasn't answered by server!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            let channel;
            [[embed],channel] = await Promise.all([
                generateEmbed(r, {ip_input: ip_unsplit, type: type_int, title: "???????????????????? ?? ?????????????? %IP%"}, false),
                interaction.channel.fetch()
            ]);
            embed.setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
            const msg = await channel.send({embeds: [embed]});
            db.serialize(() => {
                db.run(`INSERT INTO servers(type,ip,port,ip_input,message_id,channel_id,guild_id) VALUES(?,?,?,?,?,?,?)`, [type_int,ip.toLowerCase(),port,ip_unsplit,msg.id,msg.channel.id,msg.guild.id], (err) => {
                    if(err) {
                        console.log(err);
                        interaction.reply({content: "Failed to add the listener!", ephemeral: true});
                        return;
                    }
                });
                db.get(`SELECT id FROM servers WHERE message_id="${msg.id}"`, (err, row) => {
                    if(err) {
                        console.log(err);
                        interaction.reply({content: "Failed to add the listener!", ephemeral: true});
                        return;
                    }
                    db.run(`INSERT INTO servers_settings(id, title, graph_enabled, players_enabled, graph_color) VALUES(?,?,?,?,?)`, [row.id,"???????????????????? ?? ?????????????? %IP%",true,false,"#1f77b4"], (err) => {
                        if(err) {
                            console.log(err);
                            interaction.reply({content: "Failed to add the listener!", ephemeral: true});
                            return;
                        }
                        interaction.reply({content: `Added successfully! (id: ${row.id})`, ephemeral: true});
                    });
                });
            })
            break;
        }
        case "info": {
            const type = interaction.options.getString("type");
            const ip_unsplit = interaction.options.getString("ip");
            const ip = await parseIPorDomain(ip_unsplit.split(":")[0], ip_unsplit);
            let embed;
            if(Number.isInteger(ip)) {
                if(ip) {
                    embed = new discord.MessageEmbed()
                        .setTitle("Error!")
                        .setDescription("DNS could not be resolved!")
                        .setColor(EMBED_COLORS.ERROR);
                    interaction.reply({embeds: [embed], ephemeral: true});
                } else {
                    embed = new discord.MessageEmbed()
                        .setTitle("Error!")
                        .setDescription("Ip is not valid!")
                        .setColor(EMBED_COLORS.ERROR);
                    interaction.reply({embeds: [embed], ephemeral: true});
                }
            }
            const type_int = Object.values(types).indexOf(type);
            const [err, r] = await queryServer(type_int, ip, ip_unsplit.includes(":"), ip_unsplit.split(":")[1]);
            if(err) {
                embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("Query wasn't answered by server!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            [embed] = await generateEmbed(r, {ip_input: ip_unsplit, type: type_int, title: "???????????????????? ?? ?????????????? %IP%"}, false);
            embed.setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
            interaction.reply({embeds: [embed]})
            break;
        }
        case "help": {
            const embed = new discord.MessageEmbed()
                .setTitle("????????????????????")
                .setDescription(`\`/help - ???????????? ????????\`
                \`/info - ???????????????????? ???????????????????? ?? ??????????????\`
                \`/add - ?????????????????? ???????????? ?? ???????????? ?????????????????????????????? ????????????????\`
                \`/whois - ???????????????????? ???????????????????? whois ?? ??????????????\`
                \`/invite - ???????????????? ???????? ???? ?????? ????????????\`
                \`/set - ?????????????????? ?????????????????????? ???? ???????????????????? ?? ??????????????\``)
                .setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png")
                .setColor(EMBED_COLORS.OTHER);
            interaction.reply({embeds: [embed], ephemeral: true});
            break;
        }
        case "whois": {
            const domain = interaction.options.getString("domain");
            if(!isValidDomain(domain)) {
                const embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("Entered domain is not valid!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            let ip = "";
            try {
                for(const i of (await dns.promises.resolve(domain))) {
                    ip += i+"\n";
                }
                ip.substr(0,ip.length-1);
            } catch(e) {
                const embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("DNS could not be resolved!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            whois.lookup(domain, (err, data) => {
                if(err) {
                    const embed = new discord.MessageEmbed()
                        .setTitle("Error!")
                        .setDescription("Whois lookup failed!")
                        .setColor(EMBED_COLORS.ERROR);
                    interaction.reply({embeds: [embed], ephemeral: true});
                    console.log(err);
                    return;
                }
                data = data.split("\n");
                let [ dp, c, city, n ] = ["Not Provided", "Not Provided", "Not Provided", "Not Provided"];
                for(const d of data) {
                    if(d.includes("Registrar:")) {
                        dp = d.split(": ")[1];
                    } else if(d.includes("Registrant Country:")) {
                        c = d.split(": ")[1];
                    } else if(d.includes("Registrant City:")) {
                        city = d.split(": ")[1];
                    } else if(d.includes("Registrant Name:")) {
                        n = d.split(": ")[1];
                    }
                }
                const embed = new discord.MessageEmbed()
                    //.setDescription(data)
                    .setTitle(`Whois ${domain}`)
                    .addField("IPs", ip, true)
                    .addField("Domain Provider", dp, true)
                    .addField("Country", c, true)
                    .addField("City", city, true)
                    .addField("Registrant Name", n, true)
                    .setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png")
                    .setColor(EMBED_COLORS.OK);
                interaction.reply({embeds: [embed], ephemeral: true});
            });
            break;
        }
        case "invite": {
            const row = new discord.MessageActionRow()
			.addComponents(
				new discord.MessageButton()
					.setLabel('???????????????? ???? ????????????')
					.setStyle('LINK')
                    .setURL("https://discord.com/oauth2/authorize?client_id=901997061648564315&permissions=10240&scope=bot%20applications.commands")
			);
            interaction.reply({ content: '?????????????? ?????????? ???????????????? ???? ????????????', components: [row], ephemeral: true });
            break;
        }
        case "remove": {
            /**@type {discord.GuildMember} */
            const member = await interaction.member.fetch();
            if(!member.permissions.has('ADMINISTRATOR')) {
                const embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("No access!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            const t = await new Promise(resolve => {
                db.get("SELECT guild_id FROM servers WHERE id = ?", interaction.options.getNumber("id"), (err, row) => {
                    if(err) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("Failed to remove server!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    if(!row) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("The server is not found!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    if(row.guild_id !== member.guild.id) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("You can't remove the server that is not in your guild!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    resolve(false);
                })
            })
            if(t) {
                return;
            }
            db.serialize(() => {
                db.run("DELETE FROM servers WHERE id = ?", interaction.options.getNumber("id"), (err) => {
                    if(err) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("Failed to remove server!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        return;
                    }
                })
                db.run("DELETE FROM servers_settings WHERE id = ?", interaction.options.getNumber("id"), (err) => {
                    if(err) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("Failed to remove server!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        return;
                    }
                    const embed = new discord.MessageEmbed()
                        .setTitle("Success!")
                        .setDescription("Successfully removed server from database!")
                        .setColor(EMBED_COLORS.OK);
                    interaction.reply({embeds: [embed], ephemeral: true});
                    return;
                })
            });
        }
        case "set": {
            /**@type {discord.GuildMember} */
            const member = await interaction.member.fetch();
            if(!member.permissions.has('ADMINISTRATOR')) {
                const embed = new discord.MessageEmbed()
                    .setTitle("Error!")
                    .setDescription("No access!")
                    .setColor(EMBED_COLORS.ERROR);
                interaction.reply({embeds: [embed], ephemeral: true});
                return;
            }
            const t = await new Promise(resolve => {
                db.get("SELECT guild_id FROM servers WHERE id = ?", interaction.options.getNumber("id"), (err, row) => {
                    if(err) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("Failed to remove server!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    if(!row) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("The server is not found!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    if(row.guild_id !== member.guild.id) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("You can't set the server that is not in your guild!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        resolve(true);
                        return;
                    }
                    resolve(false);
                })
            })
            if(t) {
                return;
            }
            switch(interaction.options.getSubcommand()) {
                case "title": {
                    db.run("UPDATE servers_settings SET title = ? WHERE id = ?", [interaction.options.getString("title"),interaction.options.getNumber("id")], (err) => {
                        if(err) {
                            console.log(err)
                            const embed = new discord.MessageEmbed()
                                .setTitle("Error!")
                                .setDescription("Failed to update the settings!")
                                .setColor(EMBED_COLORS.ERROR);
                            interaction.reply({embeds: [embed], ephemeral: true});
                            return;
                        }
                        const embed = new discord.MessageEmbed()
                            .setTitle("Success!")
                            .setDescription(`Set title to ${interaction.options.getString("title")}!`)
                            .setColor(EMBED_COLORS.OK);
                        interaction.reply({embeds: [embed], ephemeral: true});
                    });
                    break;
                }
                case "graph_enabled": {
                    db.run("UPDATE servers_settings SET graph_enabled = ? WHERE id = ?", [interaction.options.getBoolean("graph_enabled"),interaction.options.getNumber("id")], (err) => {
                        if(err) {
                            console.log(err)
                            const embed = new discord.MessageEmbed()
                                .setTitle("Error!")
                                .setDescription("Failed to update the settings!")
                                .setColor(EMBED_COLORS.ERROR);
                            interaction.reply({embeds: [embed], ephemeral: true});
                            return;
                        }
                        const embed = new discord.MessageEmbed()
                            .setTitle("Success!")
                            .setDescription(`Set graph_enabled to ${interaction.options.getBoolean("graph_enabled")}!`)
                            .setColor(EMBED_COLORS.OK);
                        interaction.reply({embeds: [embed], ephemeral: true});
                    });
                    break;
                }
                case "players_enabled": {
                    db.run("UPDATE servers_settings SET players_enabled = ? WHERE id = ?", [interaction.options.getBoolean("players_enabled"),interaction.options.getNumber("id")], (err) => {
                        if(err) {
                            console.log(err)
                            const embed = new discord.MessageEmbed()
                                .setTitle("Error!")
                                .setDescription("Failed to update the settings!")
                                .setColor(EMBED_COLORS.ERROR);
                            interaction.reply({embeds: [embed], ephemeral: true});
                            return;
                        }
                        const embed = new discord.MessageEmbed()
                            .setTitle("Success!")
                            .setDescription(`Set players_enabled to ${interaction.options.getBoolean("players_enabled")}!`)
                            .setColor(EMBED_COLORS.OK);
                        interaction.reply({embeds: [embed], ephemeral: true});
                    });
                    break;
                }
                case "graph_color": {
                    if(!isHexcolor(interaction.options.getString("graph_color"))) {
                        const embed = new discord.MessageEmbed()
                            .setTitle("Error!")
                            .setDescription("Graph_color is not a hex value!")
                            .setColor(EMBED_COLORS.ERROR);
                        interaction.reply({embeds: [embed], ephemeral: true});
                        return;
                    }
                    db.run("UPDATE servers_settings SET graph_color = ? WHERE id = ?", [interaction.options.getString("graph_color"),interaction.options.getNumber("id")], (err) => {
                        if(err) {
                            console.log(err)
                            const embed = new discord.MessageEmbed()
                                .setTitle("Error!")
                                .setDescription("Failed to update the settings!")
                                .setColor(EMBED_COLORS.ERROR);
                            interaction.reply({embeds: [embed], ephemeral: true});
                            return;
                        }
                        const embed = new discord.MessageEmbed()
                            .setTitle("Success!")
                            .setDescription(`Set graph_color to ${interaction.options.getString("graph_color")}!`)
                            .setColor(EMBED_COLORS.OK);
                        interaction.reply({embeds: [embed], ephemeral: true});
                    });
                    break;
                }
            }
            break;
        }
    }
})

client.once('ready', async () => {
	console.log('Ready!');
    const guilds = await client.guilds.fetch();
    for(guild of guilds.values()) {
        reqSlash(guild.id, true);
    }
    new cron.CronJob("*/30 * * * * *", () => {
        db.run(`DELETE FROM server_statuses WHERE date < ${(Date.now() / 1000) - 86400}`)
        db.each("SELECT * FROM servers", async (err, row) => {
            if(err) {
                console.log("U err", err);
                return;
            }
            try {
                switch(row.type) {
                    case 0: {
                        const r = await query.info(row.ip.toLowerCase(), row.port, 2000);
                        db.run(`INSERT INTO server_statuses (id,players,date) VALUES(?,?,?)`,row.id,r.playersnum,(Date.now() / 1000));
                        break;
                    }
                    case 1: {
                        const q = new Query({host: row.ip, port: row.port, timeout: 2000})
                        const r = await q.fullStat()
                        db.run(`INSERT INTO server_statuses (id,players,date) VALUES(?,?,?)`,row.id,r.online_players,(Date.now() / 1000));
                        break;
                    }
                }
            } catch(e) {
                return;
            }
        })
    }, null, true);
    new cron.CronJob("*/10 * * * * *", () => {
        db.serialize(() => {
            db.run(`DELETE FROM server_statuses WHERE date < ${(Date.now() / 1000) - 86400}`);
            db.each("SELECT * FROM servers INNER JOIN servers_settings ON servers_settings.id = servers.id", async (err, row) => {
                if(err) {
                    console.log("U err", err);
                    return;
                }
                let embed, chart, r;
                switch(row.type) {
                    case 0: {
                        try {
                            r = await query.info(row.ip.toLowerCase(), row.port, 2000);
                            r.players = await query.players(row.ip.toLowerCase(), row.port, 2000);
                            db.run(`INSERT INTO server_statuses (id,players,date) VALUES(?,?,?)`,row.id,r.playersnum,(Date.now() / 1000));
                        } catch(e) {
                            r = {err: e};
                        }
                        
                        break;
                    }
                    case 1: {
                        try {
                            const q = new Query(row.ip, row.port, {timeout: 2000});
                            await q.connect();
                            r = await new Promise(resolve => {
                                q.full_stat((err, a) => {
                                    if(err) throw err;
                                    resolve(a)
                                })
                            });
                            db.run(`INSERT INTO server_statuses (id,players,date) VALUES(?,?,?)`,row.id,r.numplayers,(Date.now() / 1000));
                        } catch(e) {
                            r = {err: e};
                        }
                        break;
                    }
                }
                const players_ar = await fetchPlayers(row.id);
                if(players_ar instanceof Error) {
                    console.log("S err", err);
                    return;
                }
                [embed,chart] = await generateEmbed(r, row, true, players_ar);
                /**
                 * @type {discord.TextChannel}
                 */
                const ch = await client.channels.fetch(row.channel_id);
                const mes = await ch.messages.fetch(row.message_id)
                await mes.removeAttachments();
                mes.edit({
                    embeds: [embed],
                    files: [{
                        attachment: chart,
                        name: "chart.png"
                    }]
                });
            });
        });
    }, null, true);
});

client.on("guildCreate", (guild) => {
    regSlash(guild.id, false);
})

client.login(process.env.token);

async function generateChart(data,max_players,graph_color) {
    const buf = await svg2png({
        input: dom.window.drawPlot(`${JSON.stringify({data: [data],layout:{bargap:0,plot_bgcolor:"#2f3136",paper_bgcolor:"#2f3136",margin:{b:20,l:20,r:30,t:30},font:{color:"#ffffff"},yaxis:(max_players ? {range:[0,max_players]} : null),xaxis:{type:"date"},colorway:[graph_color]}})}`),
        "format": "png",
        "encoding": "buffer",
        "quality": 1,
        "height": 800,
        "width": 1000
    })
    return buf;
}

async function fetchPlayers(server_id) {
    return new Promise(resolve => {
        const x = [];
        const y = [];
        db.each(`SELECT players,date FROM server_statuses WHERE id=${server_id}`, (err, row) => {
            if(err) {
                resolve(err);
                return;
            }
            //x.push(moment(row.date).fromNow());
            x.push(row.date * 1000);
            y.push(row.players);
        }, () => {
            resolve({x,y,type:"bar",width:20000});
        });
    });
}

async function generateEmbed(query_result, sql_row, chart, players_ar) {
    const embed = new discord.MessageEmbed();
    switch(sql_row.type) {
        case 0: {
            if(query_result instanceof Error) {
                embed
                    .addField("???????????????? ??????????????:", "ERROR")
                    .addField("??????????", "ERROR", true)
                    .addField("????????", "ERROR", true)
                    .addField("????????????", "ERROR"+"/"+"ERROR", true)
                    .setColor(EMBED_COLORS.ERROR)
                    .setFooter(" // yufu.us    Server offline", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
                embed.setTitle(sql_row.title.replace(/%IP%/g, sql_row.ip_input));
                if(chart && sql_row.graph_enabled) {
                    chart = await generateChart(players_ar, null,sql_row.graph_color);
                    embed.setImage('attachment://chart.png');
                }
            } else {
                embed
                    .addField("???????????????? ??????????????:", utf8.decode(query_result.name))
                    .addField("??????????", query_result.map, true)
                    .addField("????????", query_result.game, true)
                    .addField("????????????", query_result.playersnum+"/"+query_result.maxplayers, true)
                    .setColor(EMBED_COLORS.OK)
                    .setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
                embed.setTitle(sql_row.title.replace(/%IP%/g, sql_row.ip_input));
                if(chart && sql_row.graph_enabled) {
                    chart = await generateChart(players_ar,query_result.maxplayers,sql_row.graph_color);
                    embed.setImage('attachment://chart.png');
                }
                if(query_result.players !== null && sql_row.players_enabled) {
                    let s = "";
                    let s1 = "";
                    for(const player of query_result.players) {
                        s += utf8.decode(player.name) + "\n";
                        s1 += moment.duration(Math.floor(player.duration), 'seconds').humanize() + "\n";
                    }
                    s = s.substr(0, s.length-1);
                    s1 = s1.substr(0, s1.length-1);
                    embed.addField("Players:", "\u200b")
                    embed.addField("Name:", s.length > 0 ? `\`\`\`${s}\`\`\`` : `\`\`\`-\`\`\``, true);
                    embed.addField("Time:", s1.length > 0 ? `\`\`\`${s1}\`\`\`` : `\`\`\`-\`\`\``, true);
                }
            }
            break;
        }
        case 1: {
            if(query_result instanceof Error) {
                embed
                    .addField("MOTD ??????????????:", "ERROR")
                    .addField("????????:", "ERROR", true)
                    .addField("????????????:", "ERROR", true)
                    .addField("????????????:", "ERROR"+"/"+"ERROR", true)
                    .setColor(EMBED_COLORS.ERROR)
                    .setFooter(" // yufu.us    Server offline", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
                embed.setTitle(sql_row.title.replace(/%IP%/g, sql_row.ip_input));
                if(chart && sql_row.graph_enabled) {
                    chart = await generateChart(players_ar,null,sql_row.graph_color);
                    embed.setImage('attachment://chart.png');
                }
            } else {
                embed
                    .addField("MOTD ??????????????:", query_result.hostname)
                    .addField("????????:", query_result.game_id, true)
                    .addField("????????????:", query_result.version, true)
                    .addField("????????????:", query_result.numplayers+"/"+query_result.maxplayers, true)
                    .setColor(EMBED_COLORS.OK)
                    .setFooter(" // yufu.us", "https://cdn.discordapp.com/attachments/897890262506942554/901997467476852776/logo_cat.png");
                embed.setTitle(sql_row.title.replace(/%IP%/g, sql_row.ip_input));
                if(chart && sql_row.graph_enabled) {
                    chart = await generateChart(players_ar,query_result.maxplayers,sql_row.graph_color);
                    embed.setImage('attachment://chart.png');
                }
            }
            break;
        }
    }
    return [embed,chart];
}

async function parseIPorDomain(ip, ip_unsplit) {
    if(!(isIp(ip) || isValidDomain(ip) && (!ip_unsplit.includes(":") || !isNaN(Number(ip_unsplit.split(":")[1]))))) {
        return 0;
    }
    if(isValidDomain(ip)) {
        try {
            ip = (await dns.promises.resolve(ip))[0];
        } catch(e) {
            return 1;
        }
    }
    return ip;
}

async function queryServer(type_int, ip, includes_port, port) {
    switch(type_int) {
        case 0: {
            port = includes_port ? Number(port) : 27015
            try {
                r = await query.info(ip.toLowerCase(), port, 2000);
                if(r instanceof Error) {
                    throw r;
                }
            } catch(e) {
                return [true, null, null];
            }
            break;
        }
        case 1: {
            port = includes_port ? Number(port) : 25565
            try {
                const q = new Query({host: ip, port: port, timeout: 2000});
                await q.connect();
                r = await new Promise(resolve => {
                    q.full_stat((err, a) => {
                        if(err) throw err;
                        resolve(a)
                    })
                });
            } catch(e) {
                return [true, null, null];
            }
            break;
        }
    }
    return [null, r, port];
}