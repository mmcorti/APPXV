import { notion, DS, DB } from './notion.js';

const KNOWN_PROPERTIES = {
    EVENTS: {
        Name: ["Name", "Nombre", "Título", "Titulo", "Event Name", "EventName", "Nombre del Evento"],
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
        FW_Filters: ["FotoWall Filters", "FW_Filters"],
        Capacity: ["Capacity", "Capacidad"],
        DressCode: ["Dress Code", "DressCode", "Dresscode", "Vestimenta"]
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
    SUBSCRIBERS: {
        Name: ["Name", "Nombre"],
        Email: ["Email", "Correo"],
        Password: ["Password", "Contraseña"],
        Event: ["Event", "Evento"],
        Plan: ["Plan", "plan", "Suscripción", "suscripcion", "Subscription", "subscription", "Tipo", "tipo", "Type"],
        AccessInvitados: ["access_invitados"],
        AccessMesas: ["access_mesas"],
        AccessLink: ["access_link"],
        AccessFotowall: ["access_fotowall"]
    },
    STAFF_ROSTER: {
        Name: ["Name", "Nombre"],
        Email: ["Email", "Correo"],
        // Password: ["Password", "Contraseña"], // Not using password for roster yet
        Description: ["Description", "Descripción", "Rol"],
        OwnerId: ["OwnerId", "Dueño ID"]
    },
    STAFF_ASSIGNMENTS: {
        Name: ["Name", "Nombre"],
        StaffId: ["StaffId", "Staff ID"],
        EventId: ["EventId", "Event ID"],
        AccessInvitados: ["access_invitados", "Access Invitados"],
        AccessMesas: ["access_mesas", "Access Mesas"],
        AccessLink: ["access_link", "Access Link"],
        AccessFotowall: ["access_fotowall", "Access Fotowall"]
    },
    EXPENSES: {
        Name: ["Name", "Nombre", "Descripción"],
        Category: ["Category", "Categoría", "Rubro"],
        Supplier: ["Supplier", "Proveedor"],
        Total: ["Total", "Monto Total"],
        Paid: ["Paid", "Pagado", "Monto Pagado"],
        Status: ["Status", "Estado"],
        Event: ["Event", "Evento"]
    },
    SUPPLIERS: {
        Name: ["Name", "Nombre"],
        Category: ["Category", "Categoría", "Rubro"],
        Phone: ["Phone", "Teléfono", "Telefono"],
        Email: ["Email", "Correo"],
        Event: ["Event", "Evento"]
    },
    EXPENSE_CATEGORIES: {
        Name: ["Name", "Nombre"],
        Icon: ["Icon", "Icono"],
        Subtitle: ["Subtitle", "Subtítulo", "Descripción"],
        Event: ["Event", "Evento"]
    },
    PAYMENT_PARTICIPANTS: {
        Name: ["Name", "Nombre"],
        EventId: ["EventId", "Event ID", "Evento"],
        Weight: ["Weight", "Peso"]
    },
    PAYMENTS: {
        ExpenseId: ["ExpenseId", "Expense ID", "Gasto"],
        ParticipantId: ["ParticipantId", "Participant ID", "Participante"],
        Amount: ["Amount", "Monto"],
        Date: ["Date", "Fecha"]
    },
};

class SchemaManager {
    constructor() {
        this.mappings = {
            EVENTS: {},
            GUESTS: {},
            TABLES: {},
            SUBSCRIBERS: {},
            STAFF_ROSTER: {},
            STAFF_ASSIGNMENTS: {},
            STAFF: {},
            EXPENSES: {},
            SUPPLIERS: {},
            EXPENSE_CATEGORIES: {},
            PAYMENT_PARTICIPANTS: {},
            PAYMENTS: {}
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
            if (DS.SUBSCRIBERS) await this.mapDatabase(DS.SUBSCRIBERS, 'SUBSCRIBERS', KNOWN_PROPERTIES.SUBSCRIBERS);
            if (DS.STAFF_ROSTER) await this.mapDatabase(DS.STAFF_ROSTER, 'STAFF_ROSTER', KNOWN_PROPERTIES.STAFF_ROSTER);
            if (DS.STAFF_ASSIGNMENTS) await this.mapDatabase(DS.STAFF_ASSIGNMENTS, 'STAFF_ASSIGNMENTS', KNOWN_PROPERTIES.STAFF_ASSIGNMENTS);
            if (DS.STAFF) await this.mapDatabase(DS.STAFF, 'STAFF', KNOWN_PROPERTIES.STAFF);
            if (DS.EXPENSES) await this.mapDatabase(DS.EXPENSES, 'EXPENSES', KNOWN_PROPERTIES.EXPENSES);
            if (DS.SUPPLIERS) await this.mapDatabase(DS.SUPPLIERS, 'SUPPLIERS', KNOWN_PROPERTIES.SUPPLIERS);
            if (DS.EXPENSE_CATEGORIES) await this.mapDatabase(DS.EXPENSE_CATEGORIES, 'EXPENSE_CATEGORIES', KNOWN_PROPERTIES.EXPENSE_CATEGORIES);
            if (DS.PAYMENT_PARTICIPANTS) await this.mapDatabase(DS.PAYMENT_PARTICIPANTS, 'PAYMENT_PARTICIPANTS', KNOWN_PROPERTIES.PAYMENT_PARTICIPANTS);
            if (DS.PAYMENTS) await this.mapDatabase(DS.PAYMENTS, 'PAYMENTS', KNOWN_PROPERTIES.PAYMENTS);

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
