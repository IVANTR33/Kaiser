const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const PREFIX = '!';
const TOKEN = 'TU_TOKEN_AQUI';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers 
    ] 
});

client.commands = new Collection();
const comandosPath = path.join(__dirname, 'comandos');
const comandosArchivos = fs.readdirSync(comandosPath).filter(file => file.endsWith('.js'));

for (const archivo of comandosArchivos) {
    const filePath = path.join(comandosPath, archivo);
    const comando = require(filePath);
    if ('name' in comando && 'execute' in comando) {
        client.commands.set(comando.name, comando);
    }
}

client.once('clientReady', () => {
    console.log(`¡Bot listo! Logueado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const comando = client.commands.get(commandName) 
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName)); 

    if (!comando) return;

    try {
        await comando.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply({ content: 'Hubo un error al ejecutar ese comando.', ephemeral: true });
    }
});

client.login(TOKEN);