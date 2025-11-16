const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'reply',
    description: 'Envía un mensaje a un canal especificado.',
    aliases: ['r'],

    async execute(message, args) {
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');

        // 1. Verificación de permisos (solo administradores/mods deberían usar esto)
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Necesitas el permiso de **Gestionar Mensajes** para usar este comando.');
        }

        // 2. Extracción del canal
        const canalRegex = args[0] ? args[0].match(/^<#(\d+)>$/) : null;
        if (!canalRegex) {
            return message.reply('⚠️ Debes especificar el canal de destino. Uso correcto: `!r #canal-destino <contenido>`');
        }
        
        const canalId = canalRegex[1];
        const canalDestino = message.guild.channels.cache.get(canalId);

        if (!canalDestino || canalDestino.type !== 0) { // 0 es ChannelType.GuildText
            return message.reply('❌ El argumento debe ser una mención a un canal de texto válido.');
        }

        // 3. Extracción del contenido
        const contenido = args.slice(1).join(' ');

        if (!contenido) {
            return message.reply('⚠️ Debes especificar el contenido del mensaje.');
        }
        
        // 4. Envío del mensaje
        try {
            await canalDestino.send(contenido);
            
            // 5. Opcional: Eliminar el mensaje de comando original para limpiar el chat
            if (message.deletable) {
                await message.delete();
            } else {
                // Notificar al usuario que el envío fue exitoso, si no se pudo borrar el comando
                await message.reply(`✅ Mensaje enviado a ${canalDestino}.`)
                    .then(msg => {
                        // Borra el mensaje de confirmación después de 5 segundos
                        setTimeout(() => msg.delete(), 5000); 
                    });
            }
            
        } catch (error) {
            console.error(error);
            message.reply(`❌ Error al intentar enviar el mensaje a ${canalDestino}. Asegúrate de que el bot tenga permiso de **Enviar Mensajes** en ese canal.`);
        }
    },
};