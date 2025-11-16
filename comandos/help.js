const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Muestra ayuda detallada para todos los comandos disponibles.',
    aliases: ['ayuda', 'h'],

    async execute(message, args) {
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');

        // Acceder a los comandos cargados en el cliente (asume que tu index.js carga los comandos en client.commands)
        const comandos = Array.from(message.client.commands.values());
        
        // 1. Filtramos y preparamos la información
        const comandosFiltrados = comandos.filter(cmd => cmd.name !== 'help'); // Ocultar el comando help de la lista de comandos a detallar

        if (comandosFiltrados.length === 0) {
            return message.reply('❌ No se encontraron comandos para mostrar ayuda. ¡Añade algunos comandos a la carpeta `/comandos`!');
        }

        // --- DEFINICIÓN DE PÁGINAS ---
        
        // Página 0: Índice o Introducción
        const indicePage = {
            id: 'index',
            embed: new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle('📚 Guía de Comandos del Bot')
                .setDescription('¡Selecciona un botón a continuación para ver la descripción, alias y uso de ese comando específico!')
                .addFields(
                    { 
                        name: 'Comandos Disponibles', 
                        value: comandosFiltrados.map(cmd => `\`!${cmd.name}\``).join(', '),
                        inline: false
                    },
                    {
                        name: 'Tiempo de Interacción',
                        value: 'Los botones caducan en 5 minutos.',
                        inline: false
                    }
                )
        };
        
        // Páginas de Detalle (1, 2, 3...)
        const detallePages = comandosFiltrados.map(cmd => ({
            id: cmd.name,
            embed: new EmbedBuilder()
                .setColor(0x00FF7F)
                .setTitle(`Comando: !${cmd.name}`)
                .setDescription(`**${cmd.description || 'Sin descripción.'}**`)
                .addFields(
                    { name: 'Alias', value: cmd.aliases && cmd.aliases.length > 0 ? cmd.aliases.map(a => `\`!${a}\``).join(', ') : 'Ninguno', inline: true },
                    { name: 'Uso Básico', value: `\`!${cmd.name} <argumentos>\``, inline: true },
                    // Añadir un campo de ayuda específica para los comandos clave
                    // Nota: Aquí se deben expandir los usos según la lógica de cada comando
                    { 
                        name: 'Ejemplos de Uso', 
                        value: (
                            cmd.name === 'reglas' ? '`!reglas #canal-destino`\n(Inicia flujo de edición admin)' :
                            cmd.name === 'reply' ? '`!r #general hola`\n(Envía un mensaje con alias)' :
                            cmd.name === 'precios' ? '`!precios`\n(Muestra el embed paginado público)' :
                            cmd.name === 'create' ? '`!create`\n(Inicia el creador de embeds multi-página)' :
                            cmd.name === 'text' ? '`!text Título | Contenido`\n(Añade línea en sesión `!create`)' :
                            'Usa `!' + cmd.name + '` seguido de los argumentos necesarios.'
                        ),
                        inline: false
                    }
                )
        }));

        const ALL_PAGES = [indicePage, ...detallePages];
        let currentPage = 0; // Índice inicial apunta a la página de índice (0)

        // 2. Construir Fila de Botones (uno por comando + Índice + Cerrar)
        const buildButtons = (currentPageIndex) => {
            const row1 = new ActionRowBuilder();
            const row2 = new ActionRowBuilder();
            
            // Botón de Índice (si no estamos en él)
            if (currentPageIndex !== 0) {
                 row1.addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_index')
                        .setLabel('📚 Índice')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            // Botones de Comandos
            comandosFiltrados.forEach((cmd, index) => {
                const button = new ButtonBuilder()
                    .setCustomId(`help_cmd_${cmd.name}`)
                    .setLabel(`!${cmd.name}`)
                    .setStyle(currentPageIndex === index + 1 ? ButtonStyle.Success : ButtonStyle.Primary);
                
                // Dividir en dos filas si hay muchos comandos (hasta 5 por fila)
                if (row1.components.length < 5) {
                    row1.addComponents(button);
                } else {
                    row2.addComponents(button);
                }
            });

            // Botón de Cerrar (en la fila 2 si existe, si no, en la 1)
            const closeButton = new ButtonBuilder()
                .setCustomId('help_close')
                .setLabel('❌ Cerrar')
                .setStyle(ButtonStyle.Danger);

            if (row2.components.length > 0) {
                row2.addComponents(closeButton);
            } else {
                row1.addComponents(closeButton);
            }
            
            const components = row2.components.length > 0 ? [row1, row2] : [row1];
            return components;
        };

        // 3. Enviar el mensaje inicial
        const initialComponents = buildButtons(currentPage);
        const msg = await message.reply({ 
            embeds: [ALL_PAGES[currentPage].embed], 
            components: initialComponents, 
            fetchReply: true 
        });

        // 4. Configurar el Collector (5 minutos)
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id, // Solo quien invocó el comando puede usar los botones
            time: 300000 // 5 minutos
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'help_close') {
                await msg.edit({
                    content: '🚫 Menú de ayuda cerrado.',
                    embeds: [],
                    components: []
                });
                collector.stop();
                return;
            }
            
            if (i.customId === 'help_index') {
                currentPage = 0;
            } else if (i.customId.startsWith('help_cmd_')) {
                const cmdName = i.customId.replace('help_cmd_', '');
                const index = detallePages.findIndex(p => p.id === cmdName);
                if (index !== -1) {
                    currentPage = index + 1; // +1 porque el índice real empieza después del índicePage (0)
                }
            }

            // Actualizar mensaje con la nueva página
            await msg.edit({
                embeds: [ALL_PAGES[currentPage].embed],
                components: buildButtons(currentPage)
            });
        });

        collector.on('end', async () => {
            // Deshabilitar botones al finalizar el tiempo
            try {
                const finalComponents = buildButtons(currentPage);
                finalComponents.forEach(row => 
                    row.components.forEach(button => button.setDisabled(true))
                );
                await msg.edit({ components: finalComponents });
            } catch (e) {
                // El mensaje ya fue borrado o editado (por el botón close)
            }
        });
    },
};