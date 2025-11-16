const { 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, 
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

const fs = require('fs');
const path = require('path');

// Definición de la ruta del archivo de guardado (una carpeta arriba, en /data)
const DATA_FILE = path.join(__dirname, '..', 'data', 'precios_data.json'); 

// --- DATOS GLOBALES Y ESTADO ---
// Almacena las sesiones de creación activas (en memoria) por ID de usuario
const creationSessions = new Map();

// --- FUNCIONES DE AYUDA (Exportadas para uso en text.js) ---

function getInitialPage() {
    return { 
        title: 'Título de la Nueva Página', 
        description: 'Descripción inicial. Usa !text para añadir contenido. Usa el botón ✏️ para editar el título y la descripción.', 
        fields: [] 
    };
}

function buildPreviewEmbed(userId, guildName) {
    const session = creationSessions.get(userId);
    const currentPageIndex = session.currentPageIndex;
    const page = session.pages[currentPageIndex];

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`[PÁGINA ${currentPageIndex + 1}/${session.pages.length}] ${page.title}`)
        .setDescription(page.description)
        .setAuthor({ name: guildName })
        .addFields(page.fields)
        .setFooter({ text: `Estado: ${session.status} | Usa !text <Título> | <Contenido> para añadir una línea.` });
    
    return embed;
}

function buildActionRow(session) {
    const isEditing = session.status === 'EDITANDO';
    const hasNextPage = session.pages.length > session.currentPageIndex + 1;
    const isFirstPage = session.currentPageIndex === 0;

    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('embed_save')
                .setLabel('💾 Guardar Cambios')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!isEditing),

            new ButtonBuilder()
                .setCustomId('embed_edit')
                .setLabel('✏️ Editar Título/Desc.')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!isEditing),

            new ButtonBuilder()
                .setCustomId('embed_delete')
                .setLabel('🗑️ Borrar Última Línea')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!isEditing || session.pages[session.currentPageIndex].fields.length === 0),

            new ButtonBuilder()
                .setCustomId('embed_prev_page')
                .setLabel('◀️ Anterior Pág.')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(isFirstPage),

            new ButtonBuilder()
                .setCustomId('embed_next_page')
                .setLabel(hasNextPage ? '▶️ Siguiente Pág.' : '➕ Nueva Pág.')
                .setStyle(ButtonStyle.Secondary)
        );
}

// LÓGICA DEL MODAL: No tiene deferUpdate antes de showModal()
async function showEditModal(i) {
    const userId = i.user.id;
    const session = creationSessions.get(userId);
    const page = session.pages[session.currentPageIndex];

    const modal = new ModalBuilder()
        .setCustomId('create_embed_modal')
        .setTitle('✏️ Editar Contenido Base');

    const tituloInput = new TextInputBuilder()
        .setCustomId('modal_titulo')
        .setLabel('Título de la Página')
        .setStyle(TextInputStyle.Short)
        .setValue(page.title)
        .setRequired(true);

    const descripcionInput = new TextInputBuilder()
        .setCustomId('modal_descripcion')
        .setLabel('Descripción de la Página')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(page.description)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(tituloInput),
        new ActionRowBuilder().addComponents(descripcionInput)
    );

    // Mandamos el modal: Esta es la primera respuesta del botón
    await i.showModal(modal); 

    const modalFilter = (interaction) => interaction.customId === 'create_embed_modal' && interaction.user.id === userId;

    try {
        const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });
        
        // Aplazamos la respuesta de la SUBMISSION del modal, no del botón inicial
        await modalInteraction.deferUpdate(); 

        page.title = modalInteraction.fields.getTextInputValue('modal_titulo');
        page.description = modalInteraction.fields.getTextInputValue('modal_descripcion');

        session.status = 'EDITANDO'; 
        
        await session.message.edit({
            embeds: [buildPreviewEmbed(userId, i.guild.name)],
            components: [buildActionRow(session)]
        });

    } catch (err) {
        // Timeout del modal
    }
}


// --- DEFINICIÓN DEL COMANDO !CREATE O !C ---
module.exports = {
    name: 'create',
    description: 'Inicia el creador dinámico de Embeds (solo Admin).',
    aliases: ['c'],

    async execute(message, args) {
        
        const userId = message.author.id;
        
        if (!message.guild) return message.reply('❌ Este comando solo puede usarse dentro de un servidor.');
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Necesitas el permiso de **Administrador** para usar este comando.');
        }

        if (creationSessions.has(userId)) {
            const currentSession = creationSessions.get(userId);
            return message.reply(`⚠️ Ya tienes una sesión de creación activa en este canal. Usa los botones en ese mensaje [aquí](${currentSession.message.url}) o el botón **❌ Cerrar Creador** para terminarla.`);
        }

        // --- INICIO DE NUEVA SESIÓN ---
        
        const newSession = {
            pages: [getInitialPage()],
            currentPageIndex: 0,
            status: 'EDITANDO',
            message: null, 
            collector: null
        };
        
        creationSessions.set(userId, newSession);

        const embed = buildPreviewEmbed(userId, message.guild.name);
        
        const msg = await message.reply({ 
            content: `**Panel de Creación de Embeds Dinámicos**\nComienza editando el título/descripción (✏️) o añade contenido usando **\`!text <título> | <contenido>\`**`,
            embeds: [embed], 
            components: [buildActionRow(newSession)], 
            fetchReply: true 
        });

        newSession.message = msg;

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId, 
            time: 600000 // 10 minutos
        });
        
        newSession.collector = collector;

        collector.on('collect', async i => {
            
            // NO DEFERRIR AQUÍ. La deferral debe ir DENTRO de cada case que lo necesite (excepto embed_edit).

            const session = creationSessions.get(userId);
            if (!session) return i.reply({ content: 'Sesión expirada.', ephemeral: true });

            const page = session.pages[session.currentPageIndex];

            switch (i.customId) {
                
                case 'embed_edit':
                    // showModal es la respuesta directa, no aplazamos.
                    await showEditModal(i);
                    break;
                
                case 'embed_delete':
                    await i.deferUpdate(); // Aplazamos para poder editar el mensaje
                    page.fields.pop();
                    session.status = 'EDITANDO';
                    await session.message.edit({
                        embeds: [buildPreviewEmbed(userId, i.guild.name)],
                        components: [buildActionRow(session)]
                    });
                    break;
                
                case 'embed_prev_page':
                    await i.deferUpdate(); // Aplazamos
                    session.currentPageIndex--;
                    session.status = 'EDITANDO';
                    await session.message.edit({
                        embeds: [buildPreviewEmbed(userId, i.guild.name)],
                        components: [buildActionRow(session)]
                    });
                    break;

                case 'embed_next_page':
                    await i.deferUpdate(); // Aplazamos
                    if (session.currentPageIndex < session.pages.length - 1) {
                        session.currentPageIndex++; 
                    } else {
                        session.pages.push(getInitialPage()); 
                        session.currentPageIndex = session.pages.length - 1;
                    }
                    session.status = 'EDITANDO';
                    await session.message.edit({
                        embeds: [buildPreviewEmbed(userId, i.guild.name)],
                        components: [buildActionRow(session)]
                    });
                    break;

                case 'embed_save':
                    await i.deferUpdate(); // Aplazamos
                    
                    // --- LÓGICA DE GUARDADO DE ARCHIVO JSON ---
                    try {
                        const dataToSave = JSON.stringify(session.pages, null, 2);
                        fs.writeFileSync(DATA_FILE, dataToSave);
                        session.status = 'GUARDADO';
                        
                        await session.message.edit({
                            content: `**✅ ¡Embeds guardados y persistentes!** Usa \`!precios\` para ver el resultado.`,
                            embeds: [buildPreviewEmbed(userId, i.guild.name)],
                            components: [buildActionRow(session)]
                        });

                    } catch (error) {
                        console.error('Error al guardar los datos:', error);
                        session.status = 'EDITANDO';
                        await session.message.edit({
                            content: `❌ **Error al guardar los datos.** Verifica los permisos de escritura en la carpeta \`data/\`.`,
                            embeds: [buildPreviewEmbed(userId, i.guild.name)],
                            components: [buildActionRow(session)]
                        });
                    }
                    break;

                case 'embed_close':
                    await i.deferUpdate(); // Aplazamos
                    await i.message.edit({
                        content: '🚫 Creador cerrado. Usa `!create` para iniciar una nueva sesión.',
                        embeds: [],
                        components: []
                    });
                    creationSessions.delete(userId);
                    collector.stop();
                    break;
            }
        });

        collector.on('end', () => {
            if (creationSessions.has(userId)) {
                const finalSession = creationSessions.get(userId);
                finalSession.message.edit({
                    content: '⏳ Sesión expirada por inactividad. Los cambios se han perdido.',
                    components: []
                }).catch(() => {});
                creationSessions.delete(userId);
            }
        });
    },
    
    // Exportar la caché y las funciones para que 'text.js' las use
    creationSessions,
    buildPreviewEmbed,
    buildActionRow
};