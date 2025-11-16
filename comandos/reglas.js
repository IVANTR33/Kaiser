const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, 
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

module.exports = {
    name: 'reglas',
    description: 'Genera un mensaje de reglas interactivo para enviar a un canal con edición completa.',

    async execute(message, args) {
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');

        let member = message.member;
        
        if (!member) {
            try {
                member = await message.guild.members.fetch(message.author.id);
            } catch (error) {
                return message.reply('❌ No se pudo verificar tu membresía en este servidor.');
            }
        }

        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Necesitas el permiso de **Administrador** para usar este comando.');
        }

        const canalRegex = args[0] ? args[0].match(/^<#(\d+)>$/) : null;
        if (!canalRegex) {
            return message.reply('⚠️ Debes especificar el canal de destino como argumento. Ejemplo: `!reglas #canal-destino`');
        }
        const canalId = canalRegex[1];
        const canalDestino = message.guild.channels.cache.get(canalId);

        if (!canalDestino || canalDestino.type !== 0) {
            return message.reply('❌ El argumento debe ser una mención a un canal de texto válido.');
        }

        // --- DATOS INICIALES DEL EMBED ---
        let embedData = {
            title: '📜 PREVISUALIZACIÓN: REGLAS DEL SERVIDOR 📜',
            description: '**¡Bienvenido! Edita el contenido si es necesario y luego envía.**',
            fields: [
                { name: '1. Respeto', value: 'Trata a todos con cortesía.', inline: false },
                { name: '2. No Spam', value: 'Evita el contenido repetitivo.', inline: false },
                { name: '3. Seguridad', value: 'No compartas información personal.', inline: false }
            ]
        };

        let reglasEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(embedData.title)
            .setDescription(embedData.description)
            .addFields(embedData.fields)
            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
            .setFooter({ text: `Canal de destino: #${canalDestino.name}` });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('reglas_enviar')
                    .setLabel('Enviar Mensaje')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('reglas_editar') 
                    .setLabel('Editar Contenido')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('reglas_cancelar')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger),
            );

        const previsualizacion = await message.reply({
            content: `Previsualización del mensaje de reglas para el canal **#${canalDestino.name}**:`,
            embeds: [reglasEmbed],
            components: [row]
        });

        const collector = previsualizacion.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id, 
            time: 300000 
        });

        collector.on('collect', async i => {
            
            if (i.customId === 'reglas_editar') {
                
                // --- 1. CONSTRUCCIÓN DEL MODAL ---
                const modal = new ModalBuilder()
                    .setCustomId('reglas_modal')
                    .setTitle('Editar Contenido del Embed');
                
                // Input 1: TÍTULO
                const tituloInput = new TextInputBuilder()
                    .setCustomId('reglas_titulo')
                    .setLabel('Título del Embed')
                    .setStyle(TextInputStyle.Short)
                    .setValue(reglasEmbed.data.title || '')
                    .setRequired(true);

                // Input 2: DESCRIPCIÓN
                const descripcionInput = new TextInputBuilder()
                    .setCustomId('reglas_descripcion')
                    .setLabel('Descripción (Líneas principales)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(reglasEmbed.data.description || '')
                    .setRequired(true);

                // Input 3: CAMPOS (FIELDS)
                // Se serializan los campos actuales a un formato de texto: Nombre|Valor|Inline (separados por línea)
                const camposTexto = reglasEmbed.data.fields
                    ? reglasEmbed.data.fields.map(f => `${f.name}|${f.value}`).join('\n')
                    : '1. Campo|Valor del campo 1'; 

                const camposInput = new TextInputBuilder()
                    .setCustomId('reglas_campos')
                    .setLabel('Campos (Separar por línea: Titulo|Contenido)')
                    .setPlaceholder('Ejemplo: 1. Regla|Sé respetuoso.')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(camposTexto)
                    .setRequired(false);

                // Máximo de 5 componentes por modal, usamos 3 para el contenido principal
                modal.addComponents(
                    new ActionRowBuilder().addComponents(tituloInput),
                    new ActionRowBuilder().addComponents(descripcionInput),
                    new ActionRowBuilder().addComponents(camposInput)
                );
                
                await i.showModal(modal);

                // --- 2. ESPERA LA RESPUESTA DEL MODAL ---
                const modalFilter = (interaction) => interaction.customId === 'reglas_modal' && interaction.user.id === message.author.id;

                try {
                    const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 300000 });
                    await modalInteraction.deferUpdate(); 

                    const nuevoTitulo = modalInteraction.fields.getTextInputValue('reglas_titulo');
                    const nuevaDescripcion = modalInteraction.fields.getTextInputValue('reglas_descripcion');
                    const nuevosCamposTexto = modalInteraction.fields.getTextInputValue('reglas_campos');
                    
                    // Procesar los nuevos campos (Título|Valor)
                    const nuevosCampos = nuevosCamposTexto.split('\n')
                        .map(linea => {
                            const partes = linea.split('|');
                            if (partes.length >= 2) {
                                return { name: partes[0].trim(), value: partes[1].trim(), inline: false };
                            }
                            return null;
                        })
                        .filter(f => f !== null && f.name && f.value);
                    
                    // Actualizar el Embed
                    reglasEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(nuevoTitulo)
                        .setDescription(nuevaDescripcion)
                        .addFields(nuevosCampos)
                        .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
                        .setFooter({ text: `Canal de destino: #${canalDestino.name}` });

                    await previsualizacion.edit({
                        content: `Contenido editado. Previsualización para **#${canalDestino.name}**:`,
                        embeds: [reglasEmbed],
                        components: [row] 
                    });
                    
                } catch (err) {
                    await previsualizacion.edit({ components: [row] });
                }

            } else if (i.customId === 'reglas_enviar') {
                await i.deferUpdate(); 
                
                // Quitar la palabra "PREVISUALIZACIÓN" del título final
                const embedFinal = EmbedBuilder.from(reglasEmbed.toJSON())
                    .setTitle(reglasEmbed.data.title.replace('PREVISUALIZACIÓN: ', ''))
                    .setFooter(null);

                try {
                    await canalDestino.send({ embeds: [embedFinal] });
                    await previsualizacion.edit({
                        content: `✅ Mensaje de reglas enviado exitosamente a **#${canalDestino.name}**.`,
                        embeds: [],
                        components: []
                    });
                } catch (error) {
                    await previsualizacion.edit({
                        content: `❌ Error al enviar el mensaje al canal **#${canalDestino.name}**. Verifica los permisos del bot.`,
                        embeds: [],
                        components: []
                    });
                }
                collector.stop();

            } else if (i.customId === 'reglas_cancelar') {
                await i.deferUpdate();
                await previsualizacion.edit({
                    content: '🚫 Envío de mensaje de reglas cancelado.',
                    embeds: [],
                    components: []
                });
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) { 
                 previsualizacion.edit({
                    content: '⏳ Tiempo de respuesta agotado. Intenta de nuevo.',
                    components: []
                });
            }
        });
    },
};