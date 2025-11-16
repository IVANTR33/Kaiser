const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'precios_data.json'); 

// --- TEXTOS DE AYUDA (Se usan para comparar y limpiar el JSON guardado) ---
const PLACEHOLDER_TITLE = 'Título de la Nueva Página'; 
const PLACEHOLDER_DESCRIPTION = 'Descripción inicial. Usa !text para añadir contenido. Usa el botón ✏️ para editar el título y la descripción.';

// --- DATOS POR DEFECTO (FALLBACK) ---
// Contenido por si el administrador no ha guardado nada todavía.
const DEFAULT_PAGES = [
    // Página 1: FPS Optimization
    {
        title: '💻 OPTIMIZACIÓN DE FPS Y RENDIMIENTO',
        description: '**¡Te damos la bienvenida a la sección de optimización!**',
        fields: [
            {
                name: '🟢 Optimización Normal – 7€',
                value: 'Ideal para mejorar el rendimiento sin cambios profundos. Incluye:\n• Limpieza básica del sistema\n• Ajustes de Windows para mayor fluidez\n• Optimización de drivers y servicios',
                inline: false
            },
            {
                name: '🟡 Optimización Media – 15€',
                value: 'Un punto medio entre potencia y estabilidad. Incluye:\n• Todo lo de la optimización normal\n• Ajustes avanzados de drivers y energía\n• Limpieza profunda de archivos innecesarios\n• Reducción de red y prioridad de procesos',
                inline: false
            },
            {
                name: '🔴 Optimización Extrema – 23€',
                value: 'Para exprimir tu PC al máximo. La mejora más completa. Incluye:\n• Todo lo de la optimización media\n• Ajustes avanzados del sistema y registro\n• Configuraciones personalizadas según tu hardware\n• Reducción máxima de input lag',
                inline: false
            }
        ]
    },
    // Página 2: Input Delay
    {
        title: '🖱️ REDUCCIÓN DE INPUT DELAY',
        description: '**¡Minimiza el retardo entre tu acción y la respuesta en pantalla!**',
        fields: [
            {
                name: '🟢 Input Delay Normal – 10€',
                value: 'Reducción básica del retardo al jugar. Incluye:\n• Ajustes simples de Windows para menor latencia\n• Optimización ligera de controladores\n• Limpieza rápida de procesos innecesarios',
                inline: false
            },
            {
                name: '🟡 Input Delay Medio – 17€',
                value: 'Balance entre fluidez y control avanzado. Incluye:\n• Todo lo del paquete normal\n• Optimización de drivers y servicios críticos\n• Correciones precisas de drivers y latencia',
                inline: false
            },
            {
                name: '🔴 Input Delay Extremo – 28€',
                value: 'La experiencia más rápida y reactiva posible. Incluye:\n• Todo lo del paquete medio\n• Ajustes avanzados del sistema y controladores\n• Configuraciones específicas para tu hardware\n• Reducción máxima del input delay para juegos competitivos',
                inline: false
            },
            {
                name: '🌟 OFERTA ESPECIAL',
                value: 'Si compras **Optimización Extrema (23€) + Input Delay Extremo (28€)**:\n• Total original: 51€\n• Coste oferta: **44€**\n• *7€ de descuento automático por combinar ambos servicios.*',
                inline: false
            }
        ]
    }
];

// --- FUNCIÓN PARA CARGAR DATOS PERSISTENTES Y LIMPIAR EL CONTENIDO DE AYUDA ---
function loadPages() {
    let pages = [];
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            pages = JSON.parse(data);
        }
    } catch (error) {
        // En caso de error de lectura o parseo, volvemos a los valores por defecto.
    }
    
    // Si no se cargó nada válido, usamos los valores por defecto
    if (!Array.isArray(pages) || pages.length === 0) {
        return DEFAULT_PAGES;
    }
    
    // Aplicar la Lógica de Limpieza
    return pages.map((page, index) => {
        // Reemplazar la descripción de ayuda con un mensaje neutral si no fue editada.
        if (page.description === PLACEHOLDER_DESCRIPTION) {
            page.description = 'Contenido principal aún no definido.';
        }
        // Reemplazar el título de ayuda con un mensaje neutral si no fue editado.
        if (page.title === PLACEHOLDER_TITLE) {
            page.title = `Página ${index + 1} - Sin Título`; 
        }
        return page;
    });
}


// --- Función para construir un Embed de página ---
function buildEmbed(pageIndex, message, PAGES) {
    const page = PAGES[pageIndex];
    
    const embed = new EmbedBuilder()
        .setColor(0x00AFFF) 
        .setTitle(page.title)
        .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
        .setDescription(page.description)
        .addFields(page.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline !== undefined ? f.inline : false })))
        .setFooter({ text: `Página ${pageIndex + 1} de ${PAGES.length}` });

    return embed;
}

// --- Definición y Lógica del Comando ---

module.exports = {
    name: 'precios',
    description: 'Muestra la lista de precios paginada (cargada dinámicamente).',
    aliases: ['servicios', 'p'],

    async execute(message, args) {
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');

        const PAGES = loadPages(); 
        
        if (PAGES.length === 0) {
            return message.reply('❌ Error: La configuración de precios está vacía. Un administrador debe usar `!create` y guardar la información.');
        }

        let currentPage = 0; 
        
        // 2. Función para construir los botones
        const row = () => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('page_back')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0), 

                    new ButtonBuilder()
                        .setCustomId('page_indicator')
                        .setLabel(`Página ${currentPage + 1}/${PAGES.length}`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), 

                    new ButtonBuilder()
                        .setCustomId('page_next')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === PAGES.length - 1),

                    new ButtonBuilder()
                        .setCustomId('page_close')
                        .setLabel('Cerrar')
                        .setStyle(ButtonStyle.Danger)
                );
        };

        // 3. Enviar la primera página
        const embed = buildEmbed(currentPage, message, PAGES);
        
        const msg = await message.reply({ 
            embeds: [embed], 
            components: [row()], 
            fetchReply: true 
        });

        // 4. Configurar el Collector (5 minutos de duración)
        const collector = msg.createMessageComponentCollector({
            time: 300000 // 5 minutos
        });

        collector.on('collect', async i => {
            
            if (!i.isButton()) return;
            
            await i.deferUpdate();

            if (i.customId === 'page_next') {
                if (currentPage < PAGES.length - 1) {
                    currentPage++;
                }
            } else if (i.customId === 'page_back') {
                if (currentPage > 0) {
                    currentPage--;
                }
            } else if (i.customId === 'page_close') {
                await msg.edit({ 
                    content: '🚫 La lista de precios ha sido cerrada. ¡Gracias por tu visita!',
                    embeds: [],
                    components: []
                });
                collector.stop();
                return;
            }

            // Si la página cambió, actualizamos el mensaje y los botones
            const newEmbed = buildEmbed(currentPage, message, PAGES);
            await msg.edit({ 
                embeds: [newEmbed], 
                components: [row()] 
            });
        });

        collector.on('end', async () => {
            // Cuando el tiempo termine, deshabilitamos todos los botones
            try {
                const finalRow = row();
                finalRow.components.forEach(c => c.setDisabled(true));
                await msg.edit({ components: [finalRow] }); 
            } catch (e) {
                // El mensaje pudo haber sido borrado
            }
        });
    },
};