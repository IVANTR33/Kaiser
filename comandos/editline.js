const { PermissionsBitField } = require('discord.js');
// Importamos el módulo create.js para acceder a la caché de sesiones y las funciones de construcción
const createCommand = require('./create.js'); 

module.exports = {
    name: 'editline',
    description: 'Edita una línea de contenido específica del Embed indicando su número (ej: !editline 3 Título | Contenido).',
    aliases: ['el'],

    async execute(message, args) {
        
        const userId = message.author.id;
        
        if (!message.guild) return; 
        
        // 1. Verificar sesión activa
        if (!createCommand.creationSessions || !createCommand.creationSessions.has(userId)) {
            return message.reply('❌ No tienes una sesión de creación de Embeds activa. Usa `!create` para iniciar una.');
        }

        const session = createCommand.creationSessions.get(userId);
        const page = session.pages[session.currentPageIndex];
        const fields = page.fields;

        if (session.status !== 'EDITANDO') {
            return message.reply('⚠️ El Embed está **GUARDADO**. Presiona el botón **✏️ Editar** para poder modificar el contenido.');
        }
        
        // 2. Parsear el índice y el contenido
        if (args.length < 2) {
            return message.reply('⚠️ Formato: `!editline <número de línea> <título> | <contenido>`.');
        }

        // El primer argumento debe ser el índice de la línea
        const lineIndex = parseInt(args[0], 10); 
        
        if (isNaN(lineIndex) || lineIndex <= 0 || lineIndex > fields.length) {
            return message.reply(`❌ Número de línea inválido. Debe ser un número entre 1 y ${fields.length}.`);
        }

        // El resto de los argumentos contienen el Título y el Contenido
        const contentArgs = args.slice(1).join(' '); // Unir el resto de argumentos
        
        const parts = contentArgs.split('|');
        const fieldName = parts[0].trim().substring(0, 256);
        const fieldValue = parts.slice(1).join('|').trim().substring(0, 1024);
        
        if (!fieldValue) {
             return message.reply('⚠️ El contenido no puede estar vacío después del separador `|`.');
        }

        // 3. Aplicar la edición
        const fieldToEditIndex = lineIndex - 1; // Convertir a índice de array (0-basado)
        
        fields[fieldToEditIndex].name = fieldName;
        fields[fieldToEditIndex].value = fieldValue;
        
        // 4. Feedback y Actualización del Mensaje
        
        // Eliminar el mensaje de comando para limpiar el chat
        if (message.deletable) await message.delete();
        
        // Actualizar el Embed de previsualización
        await session.message.edit({
            embeds: [createCommand.buildPreviewEmbed(userId, message.guild.name)],
            components: [createCommand.buildActionRow(session)]
        }).catch(() => {});
        
        // Enviar un feedback sutil al usuario sobre la línea editada
        const feedbackMsg = await message.channel.send(`✅ Línea **${lineIndex}** editada: **${fieldName}**`);
        // Borrar el feedback después de 5 segundos para no saturar el chat
        setTimeout(() => {
            if (feedbackMsg.deletable) feedbackMsg.delete().catch(() => {});
        }, 5000);
    },
};