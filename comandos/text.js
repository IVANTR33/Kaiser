const { PermissionsBitField } = require('discord.js');
// Importamos el módulo create.js aquí para acceder a las sesiones y funciones
const createCommand = require('./create.js'); 

module.exports = {
    name: 'text',
    description: 'Añade una línea de contenido al Embed de la sesión activa.',
    aliases: ['t'],

    async execute(message, args) {
        
        const userId = message.author.id;
        
        if (!message.guild) return; 
        
        // Acceder a la caché de sesiones
        if (!createCommand.creationSessions || !createCommand.creationSessions.has(userId)) {
            return message.reply('❌ No tienes una sesión de creación de Embeds activa. Usa `!create` para iniciar una.');
        }

        const session = createCommand.creationSessions.get(userId);
        const page = session.pages[session.currentPageIndex];

        if (session.status !== 'EDITANDO') {
            return message.reply('⚠️ El Embed está **GUARDADO**. Presiona el botón **✏️ Editar** para poder añadir más contenido.');
        }
        
        const fullContent = args.join(' ');
        
        if (!fullContent) {
            return message.reply('⚠️ Formato: `!text <título> | <contenido>`.');
        }

        const parts = fullContent.split('|');
        const fieldName = parts[0].trim().substring(0, 256);
        // Usamos .slice(1).join('|') para que el contenido pueda tener barras verticales
        const fieldValue = parts.slice(1).join('|').trim().substring(0, 1024) || 'Sin contenido.';
        
        if (!fieldValue) {
             return message.reply('⚠️ El contenido no puede estar vacío después del separador `|`.');
        }

        // Añadir el nuevo campo (línea)
        page.fields.push({ name: fieldName, value: fieldValue, inline: false });
        
        // Eliminar el mensaje de comando para limpiar el chat
        if (message.deletable) await message.delete();
        
        // Actualizar el Embed de previsualización
        await session.message.edit({
            embeds: [createCommand.buildPreviewEmbed(userId, message.guild.name)],
            components: [createCommand.buildActionRow(session)]
        }).catch(() => {
            // Manejar error si el mensaje de sesión es borrado
        });
    },
};