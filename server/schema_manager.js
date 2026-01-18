import { notion, DS, DB } from './notion.js';

const KNOWN_PROPERTIES = {
    EVENTS: {
        Name: ["Name", "Nombre", "Título", "Titulo"],
        CreatorEmail: ["Creator Email", "Email Creador", "Correo Creador"],
        Date: ["Date", "Fecha"],
        Location: ["Location", "Ubicación", "Ubicacion"],
        Message: ["Message", "Mensaje", "Frase", "Dedicatoria"],
        Image: ["Image URL", "Imagen", "Image", "Foto"],
        Time: ["Time", "Hora", "Horario"],
        Host: ["Host Name", "Anfitrión", "Anfitrion", "Hosts"],
        GiftType: ["Gift Type", "Tipo de Regalo"],
        GiftDetail: ["Gift Detail", "Alias", "CBU", "URL Regalo"],
        FW_AlbumUrl: ["FotoWall Album URL", "FW_AlbumUrl"],
        FW_Interval: ["FotoWall Interval", "FW_Interval"],
        FW_Shuffle: ["FotoWall Shuffle", "FW_Shuffle"],
        FW_OverlayTitle: ["FotoWall Overlay Title", "FW_OverlayTitle"],
        FW_ModerationMode: ["FotoWall Moderation Mode", "FW_ModerationMode"],
        FW_Filters: ["FotoWall Filters", "FW_Filters"]
    },
    GUESTS: {
        Name: ["Name", "Nombre"],
        Email: ["Email", "Correo"],
        Status: ["Status", "Estado", "Asistencia"],
        AllottedAdults: ["Adults Allotted", "Allotted Adults", "Cupos Adultos"],
        AllottedTeens: ["Teens Allotted", "Allotted Teens", "Cupos Jóvenes", "Cupos Jovenes"],
        AllottedKids: ["Kids Allotted", "Allotted Kids", "Cupos Niños", "Cupos Ninos"],
        AllottedInfants: ["Infants Allotted", "Allotted Infants", "Cupos Bebés", "Cupos Bebes"],
        ConfirmedAdults: ["Adults Confirmed", "Confirmed Adults", "Confirmados Adultos"],
        ConfirmedTeens: ["Teens Confirmed", "Confirmed Teens", "Confirmados Jóvenes", "Confirmados Jovenes"],
        ConfirmedKids: ["Kids Confirmed", "Confirmed Kids", "Confirmados Niños", "Confirmados Ninos"],
        ConfirmedInfants: ["Infants Confirmed", "Confirmed Infants", "Confirmados Bebés", "Confirmados Bebes"],
        CompanionNames: ["Companion Names", "Acompañantes", "Nombres Acompañantes"],
        Event: ["Event", "Evento"],
        Sent: ["Invitation Sent", "Sent", "Enviado"]
    },
    TABLES: {
        Name: ["Name", "Nombre", "Mesa"],
        Capacity: ["Capacity", "Capacidad"],
        Order: ["Order", "Orden", "Posición", "Position"],
        Guests: ["Guests", "Invitados"],
        Assignments: ["Assignments", "Asignaciones", "Detalle", "Json"],
        Event: ["Event", "Evento"]
    },
    STAFF: {
        Name: ["Name", "Nombre"],
        Email: ["Email", "Correo"],
        Password: ["Password", "Contraseña"],
        Event: ["Event", "Evento"],
        AccessInvitados: ["access_invitados"],
        AccessMesas: ["access_mesas"],
        AccessLink: ["access_link"],
        AccessFotowall: ["access_fotowall"]
    }
};

class SchemaManager {
    constructor() {
        this.mappings = {
            EVENTS: {},
            GUESTS: {},
            TABLES: {},
            STAFF: {}
        };
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        console.log("🔄 Initializing Schema Manager...");

        try {
            await this.mapDatabase(DS.EVENTS, 'EVENTS', KNOWN_PROPERTIES.EVENTS);
            await this.mapDatabase(DS.GUESTS, 'GUESTS', KNOWN_PROPERTIES.GUESTS);
            await this.mapDatabase(DS.TABLES, 'TABLES', KNOWN_PROPERTIES.TABLES);
            if (DS.STAFF) await this.mapDatabase(DS.STAFF, 'STAFF', KNOWN_PROPERTIES.STAFF);

            this.initialized = true;
            console.log("✅ Schema Manager Initialized.");
            // console.log("Mappings:", JSON.stringify(this.mappings, null, 2));
        } catch (error) {
            console.error("❌ Failed to initialize schema manager:", error);
        }
    }

    async mapDatabase(dbId, dbKey, knownProps) {
        try {
            const db = await notion.databases.retrieve({ database_id: dbId });
            const properties = db.properties;
            const propertyKeys = Object.keys(properties);

            for (const [internalKey, aliases] of Object.entries(knownProps)) {
                let foundName = null;
                // Try to find exact or alias match
                for (const alias of aliases) {
                    const match = propertyKeys.find(k => k.toLowerCase() === alias.toLowerCase());
                    if (match) {
                        foundName = match;
                        break;
                    }
                }

                // If found, map internal key to ACTUAL Notion name
                if (foundName) {
                    this.mappings[dbKey][internalKey] = foundName;
                } else {
                    console.warn(`⚠️ Property '${internalKey}' not found in ${dbKey} DB. using default '${aliases[0]}'.`);
                    this.mappings[dbKey][internalKey] = aliases[0]; // Fallback to first alias
                }
            }
        } catch (error) {
            console.error(`❌ Error mapping database ${dbKey}:`, error.message);
        }
    }

    get(dbKey, internalKey) {
        return this.mappings[dbKey]?.[internalKey] || KNOWN_PROPERTIES[dbKey]?.[internalKey]?.[0] || internalKey;
    }

    getAliases(dbKey, internalKey) {
        return KNOWN_PROPERTIES[dbKey]?.[internalKey] || [internalKey];
    }
}

export const schema = new SchemaManager();
export { KNOWN_PROPERTIES };
