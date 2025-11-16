const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Muestra ayuda detallada para todos los comandos disponibles.',
    aliases: ['ayuda', 'h'],

    async execute(message, args) {
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');

        const comandos = Array.from(message.client.commands.values());
        const comandosFiltrados = comandos.filter(cmd => cmd.name !== 'help'); 

        if (comandosFiltrados.length === 0) {
            return message.reply('❌ No se encontraron comandos para mostrar ayuda. ¡Añade comandos a la carpeta `/comandos`!');
        }

        // --- DEFINICIÓN DE PÁGINAS ---
        
        // Página 0: Índice o Introducción
        const indicePage = {
            id: 'index',
            embed: new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle('📚 Guía de Comandos del Bot')
                .setDescription('¡Selecciona un botón a continuación para ver la descripción y uso de ese comando específico!')
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
        const detallePages = comandosFiltrados.map(cmd => {
            
            // Función para determinar el uso y ejemplo específico de cada comando
            const getUsageExample = (cmdName) => {
                switch(cmdName) {
                    case 'create':
                        return {
                            usage: '`!create` o `!c`',
                            example: 'Inicia el panel de creación de Embeds dinámicos. Debes usar los botones para navegar y `!text` para añadir contenido.'
                        };
                    case 'text':
                        return {
                            usage: '`!text <Título de línea> | <Contenido de línea>`',
                            example: 'Añade una nueva línea de contenido (field) al Embed de la sesión activa. Ejemplo: `!text Plan Básico | Incluye optimización y drivers.`'
                        };
                    case 'editline':
                        return {
                            usage: '`!editline <Nº Línea> <Nuevo Título> | <Nuevo Contenido>`',
                            example: 'Edita una línea específica de la página actual. Ejemplo: `!editline 3 Oferta Navideña | Solo disponible este mes.`'
                        };
                    case 'precios':
                        return {
                            usage: '`!precios` o `!p`',
                            example: 'Muestra la lista de precios paginada guardada por el administrador.'
                        };
                    case 'reglas':
                        return {
                            usage: '`!reglas #canal-destino`',
                            example: 'Genera el mensaje interactivo de reglas y pide confirmación para enviarlo a un canal.'
                        };
                    case 'ping': // <-- AGREGAMOS EL CASO ESPECÍFICO PARA !PING
                        return {
                            usage: '`!ping`',
                            example: 'Mide la latencia de respuesta del bot. No requiere argumentos.'
                        };
                    default:
                        // Uso genérico para comandos que SÍ requieren argumentos
                        // Si quieres que el comportamiento por defecto sea SIN argumentos (como para 'ping')
                        // puedes cambiar esta lógica o añadir más casos específicos.
                        return {
                            usage: `\`!${cmdName} <argumentos>\``,
                            example: `Usa \`!${cmdName}\` seguido de los argumentos necesarios.`
                        };
                }
            };
            
            const usageInfo = getUsageExample(cmd.name);
            
            return {
                id: cmd.name,
                embed: new EmbedBuilder()
                    .setColor(0x00FF7F)
                    .setTitle(`Comando: !${cmd.name}`)
                    .setDescription(`**${cmd.description || 'Sin descripción.'}**`)
                    .addFields(
                        { name: 'Sintaxis', value: usageInfo.usage, inline: false },
                        { name: 'Ejemplo de Uso', value: usageInfo.example, inline: false },
                        { name: 'Alias', value: cmd.aliases && cmd.aliases.length > 0 ? cmd.aliases.map(a => `\`!${a}\``).join(', ') : 'Ninguno', inline: true }
                    )
            };
        });

        const ALL_PAGES = [indicePage, ...detallePages];
        let currentPage = 0; 

        // 2. Construir Fila de Botones (uno por comando + Índice + Cerrar)
        const buildButtons = (currentPageIndex) => {
            const rows = [];
            let currentRow = new ActionRowBuilder();
            
            // Botón de Índice (si no estamos en él)
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('help_index')
                    .setLabel('📚 Índice')
                    .setStyle(currentPageIndex === 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
            );

            // Botones de Comandos
            comandosFiltrados.forEach((cmd) => {
                const index = detallePages.findIndex(p => p.id === cmd.name) + 1;
                const isCurrent = currentPageIndex === index;
                
                const button = new ButtonBuilder()
                    .setCustomId(`help_cmd_${cmd.name}`)
                    .setLabel(`!${cmd.name}`)
                    .setStyle(isCurrent ? ButtonStyle.Success : ButtonStyle.Primary);
                
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(button);
            });
            
            if (currentRow.components.length > 0) {
                 rows.push(currentRow);
            }
            
            // Añadir el botón de Cerrar
            const closeButton = new ButtonBuilder()
                .setCustomId('help_close')
                .setLabel('❌ Cerrar Menú')
                .setStyle(ButtonStyle.Danger);

            if (rows.length === 0 || rows[rows.length - 1].components.length === 5) {
                const closeRow = new ActionRowBuilder().addComponents(closeButton);
                rows.push(closeRow);
            } else {
                rows[rows.length - 1].addComponents(closeButton);
            }
            
            return rows;
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
            filter: i => i.user.id === message.author.id, 
            time: 300000 
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
                    currentPage = index + 1; 
                }
            }

            await msg.edit({
                embeds: [ALL_PAGES[currentPage].embed],
                components: buildButtons(currentPage)
            });
        });

        collector.on('end', async () => {
            try {
                const finalComponents = buildButtons(currentPage);
                finalComponents.forEach(row => 
                    row.components.forEach(button => button.setDisabled(true))
                );
                await msg.edit({ components: finalComponents });
            } catch (e) {
                // El mensaje ya fue borrado o editado
            }
        });
    },
};
