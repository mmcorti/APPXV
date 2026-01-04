import dotenv from 'dotenv';
dotenv.config(); // Carga .env si existe
dotenv.config({ path: '.env.local', override: true }); // Carga .env.local si existe y sobreescribe
import express from 'express';
import cors from 'cors';
import notion, { DS, DB } from './notion.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const getText = (prop) => {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select.name;
    if (prop.email) return prop.email;
    if (prop.date) return prop.date.start;
    if (prop.number) return prop.number;
    if (prop.url) return prop.url;
    if (prop.checkbox) return prop.checkbox;
    if (prop.relation) return prop.relation.map(r => r.id);
    return '';
};


// EVENTS
app.get('/api/events', async (req, res) => {
    try {
        const { email } = req.query;
        const filter = email ? {
            property: "Creator Email",
            email: {
                equals: email
            }
        } : undefined;

        const response = await notion.dataSources.query({
            data_source_id: DS.EVENTS,
            filter: filter
        });
        const events = response.results.map(page => ({
            id: page.id,
            eventName: getText(page.properties.Name),
            hostName: getText(page.properties["Host Name"]),
            date: getText(page.properties.Date),
            time: getText(page.properties.Time),
            location: getText(page.properties.Location),
            image: getText(page.properties["Image URL"]),
            message: getText(page.properties.Message),
            giftType: getText(page.properties["Gift Type"]),
            giftDetail: getText(page.properties["Gift Detail"])
        }));
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events', async (req, res) => {
    try {
        const response = await notion.pages.create({
            parent: {
                type: 'data_source_id',
                data_source_id: DS.EVENTS
            },
            properties: {
                "Name": { title: [{ text: { content: req.body.eventName } }] },
                "Host Name": { rich_text: [{ text: { content: req.body.hostName || '' } }] },
                "Creator Email": { email: req.body.userEmail || null },
                "Date": { date: { start: req.body.date } },
                "Time": { rich_text: [{ text: { content: req.body.time || '' } }] },
                "Location": { rich_text: [{ text: { content: req.body.location || '' } }] },
                "Image URL": { url: req.body.image || '' },
                "Message": { rich_text: [{ text: { content: req.body.message || '' } }] },
                "Gift Type": { select: { name: req.body.giftType || 'alias' } },
                "Gift Detail": { rich_text: [{ text: { content: req.body.giftDetail || '' } }] }
            }
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/events/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            properties: {
                "Name": { title: [{ text: { content: req.body.eventName } }] },
                "Host Name": { rich_text: [{ text: { content: req.body.hostName || '' } }] },
                "Date": { date: { start: req.body.date } },
                "Time": { rich_text: [{ text: { content: req.body.time || '' } }] },
                "Location": { rich_text: [{ text: { content: req.body.location || '' } }] },
                "Image URL": { url: req.body.image || '' },
                "Message": { rich_text: [{ text: { content: req.body.message || '' } }] },
                "Gift Type": { select: { name: req.body.giftType || 'alias' } },
                "Gift Detail": { rich_text: [{ text: { content: req.body.giftDetail || '' } }] }
            }
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GUESTS
app.get('/api/guests/:eventId', async (req, res) => {
    try {
        const response = await notion.dataSources.query({
            data_source_id: DS.GUESTS,
            filter: { property: "Event", relation: { contains: req.params.eventId } }
        });

        // Filter out archived results
        const nonArchivedGuests = response.results.filter(p => !p.archived);

        // Also fetch ALL companions for these guests to populate companionNames
        const companionsResponse = await notion.dataSources.query({
            data_source_id: DS.COMPANIONS
        });
        const nonArchivedCompanions = companionsResponse.results.filter(p => !p.archived);

        const allCompanions = nonArchivedCompanions.map(c => ({
            id: c.id,
            name: getText(c.properties.Name),
            guestId: getText(c.properties.Guest)[0],
            type: getText(c.properties.Type),
            index: c.properties.Index?.number || 0
        }));

        const guests = nonArchivedGuests.map(page => {
            const guestId = page.id;
            const guestCompanions = allCompanions.filter(c => c.guestId === guestId);

            const companionNames = {
                adults: guestCompanions.filter(c => c.type === 'adult').sort((a, b) => a.index - b.index).map(c => c.name),
                teens: guestCompanions.filter(c => c.type === 'teen').sort((a, b) => a.index - b.index).map(c => c.name),
                kids: guestCompanions.filter(c => c.type === 'kid').sort((a, b) => a.index - b.index).map(c => c.name),
                infants: guestCompanions.filter(c => c.type === 'infant').sort((a, b) => a.index - b.index).map(c => c.name)
            };

            const companions = guestCompanions.map(c => ({
                id: c.id,
                name: c.name,
                index: c.index,
                type: c.type
            }));

            return {
                id: guestId,
                name: getText(page.properties.Name),
                email: getText(page.properties.Email),
                status: getText(page.properties.Status) || 'pending',
                allotted: {
                    adults: page.properties["Adults Allotted"]?.number || 0,
                    teens: page.properties["Teens Allotted"]?.number || 0,
                    kids: page.properties["Kids Allotted"]?.number || 0,
                    infants: page.properties["Infants Allotted"]?.number || 0
                },
                confirmed: {
                    adults: page.properties["Adults Confirmed"]?.number || 0,
                    teens: page.properties["Teens Confirmed"]?.number || 0,
                    kids: page.properties["Kids Confirmed"]?.number || 0,
                    infants: page.properties["Infants Confirmed"]?.number || 0
                },
                companionNames: (guestCompanions.length > 0 || getText(page.properties.Status) === 'confirmed') ? companionNames : undefined,
                companions: companions,
                sent: page.properties["Invitation Sent"]?.checkbox || false
            };
        });
        res.json(guests);
    } catch (error) {
        console.error("Fetch Guests Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/guests', async (req, res) => {
    const { eventId, guest } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                type: 'data_source_id',
                data_source_id: DS.GUESTS
            },
            properties: {
                "Name": { title: [{ text: { content: guest.name } }] },
                "Email": { email: guest.email || null },
                "Event": { relation: [{ id: eventId }] },
                "Status": { select: { name: guest.status || 'pending' } },
                "Adults Allotted": { number: guest.allotted.adults || 0 },
                "Teens Allotted": { number: guest.allotted.teens || 0 },
                "Kids Allotted": { number: guest.allotted.kids || 0 },
                "Infants Allotted": { number: guest.allotted.infants || 0 },
                "Adults Confirmed": { number: guest.confirmed?.adults || 0 },
                "Teens Confirmed": { number: guest.confirmed?.teens || 0 },
                "Kids Confirmed": { number: guest.confirmed?.kids || 0 },
                "Infants Confirmed": { number: guest.confirmed?.infants || 0 }
            }
        });

        // Sync companions
        if (guest.companionNames) {
            await syncCompanions(response.id, guest.name, guest.companionNames, guest.allotted);
        }

        res.json(response);
    } catch (error) {
        console.error("Create Guest Error:", error);
        res.status(500).json({ error: error.message });
    }
});

async function syncCompanions(guestId, mainGuestName, companionNames, allotted) {
    // Delete existing companions first to avoid duplicates
    const existingCompanions = await notion.dataSources.query({
        data_source_id: DS.COMPANIONS,
        filter: { property: "Guest", relation: { contains: guestId } }
    });
    for (const comp of existingCompanions.results) {
        await notion.pages.update({ page_id: comp.id, archived: true });
    }

    if (companionNames && allotted) {
        const categories = ['adults', 'teens', 'kids', 'infants'];
        const labels = { adults: 'Adulto', teens: 'Adolescente', kids: 'Niño', infants: 'Bebé' };

        for (const cat of categories) {
            const names = companionNames[cat] || [];
            const count = allotted[cat] || 0;
            const targetCount = cat === 'adults' ? Math.max(0, count - 1) : count;

            for (let i = 0; i < targetCount; i++) {
                const nameSourceIndex = cat === 'adults' ? i + 1 : i;
                const name = names[nameSourceIndex]?.trim() || `${labels[cat]} ${i + 1} - ${mainGuestName}`;
                await notion.pages.create({
                    parent: {
                        type: 'data_source_id',
                        data_source_id: DS.COMPANIONS
                    },
                    properties: {
                        "Name": { title: [{ text: { content: name } }] },
                        "Guest": { relation: [{ id: guestId }] },
                        "Type": { select: { name: cat.slice(0, -1) } },
                        "Index": { number: i }
                    }
                });
            }
        }
    }
}

app.put('/api/guests/:id', async (req, res) => {
    const { id } = req.params;
    const { guest } = req.body;
    try {
        const response = await notion.pages.update({
            page_id: id,
            properties: {
                "Name": { title: [{ text: { content: guest.name } }] },
                "Email": { email: guest.email || null },
                "Status": { select: { name: guest.status || 'pending' } },
                "Adults Allotted": { number: guest.allotted.adults || 0 },
                "Teens Allotted": { number: guest.allotted.teens || 0 },
                "Kids Allotted": { number: guest.allotted.kids || 0 },
                "Infants Allotted": { number: guest.allotted.infants || 0 },
                // Reset or sync confirmed counts when admin manual-edits
                "Adults Confirmed": { number: guest.status === 'confirmed' ? (guest.allotted.adults || 0) : 0 },
                "Teens Confirmed": { number: guest.status === 'confirmed' ? (guest.allotted.teens || 0) : 0 },
                "Kids Confirmed": { number: guest.status === 'confirmed' ? (guest.allotted.kids || 0) : 0 },
                "Infants Confirmed": { number: guest.status === 'confirmed' ? (guest.allotted.infants || 0) : 0 }
            }
        });

        // Sync companions
        if (guest.companionNames) {
            await syncCompanions(id, guest.name, guest.companionNames, guest.allotted);
        }

        res.json(response);
    } catch (error) {
        console.error("Update Guest Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/guests/:id', async (req, res) => {
    try {
        const guestId = req.params.id;

        // 1. Clear table assignments for the main guest
        await notion.pages.update({
            page_id: guestId,
            properties: { "Assigned Table": { relation: [] } }
        });

        // 2. Clear assignments and archive all companions
        const companions = await notion.dataSources.query({
            data_source_id: DS.COMPANIONS,
            filter: { property: "Guest", relation: { contains: guestId } }
        });
        for (const c of companions.results) {
            await notion.pages.update({
                page_id: c.id,
                properties: { "Assigned Table": { relation: [] } },
                archived: true
            });
        }

        // 3. Archive the guest record
        await notion.pages.update({
            page_id: guestId,
            archived: true
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Delete Guest Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/guests/:guestId/rsvp', async (req, res) => {
    const { guestId } = req.params;
    const { status, confirmed, companionNames } = req.body;
    try {
        const guestPage = await notion.pages.retrieve({ page_id: guestId });
        const mainGuestName = getText(guestPage.properties.Name);

        await notion.pages.update({
            page_id: guestId,
            properties: {
                "Status": { select: { name: status } },
                "Adults Confirmed": { number: confirmed.adults || 0 },
                "Teens Confirmed": { number: confirmed.teens || 0 },
                "Kids Confirmed": { number: confirmed.kids || 0 },
                "Infants Confirmed": { number: confirmed.infants || 0 }
            }
        });

        // Delete existing companions first to avoid duplicates on update
        const existingCompanions = await notion.dataSources.query({
            data_source_id: DS.COMPANIONS,
            filter: { property: "Guest", relation: { contains: guestId } }
        });
        for (const comp of existingCompanions.results) {
            await notion.pages.update({ page_id: comp.id, archived: true });
        }

        if (companionNames) {
            const labels = { adults: 'Adulto', teens: 'Adolescente', kids: 'Niño', infants: 'Bebé' };
            for (const [groupKey, names] of Object.entries(companionNames)) {
                const companionList = Array.isArray(names) ? names : [];
                for (let i = 0; i < companionList.length; i++) {
                    const name = companionList[i]?.trim() || `${labels[groupKey] || 'Invitado'} ${i + 1} - ${mainGuestName}`;
                    await notion.pages.create({
                        parent: {
                            type: 'data_source_id',
                            data_source_id: DS.COMPANIONS
                        },
                        properties: {
                            "Name": { title: [{ text: { content: name } }] },
                            "Guest": { relation: [{ id: guestId }] },
                            "Type": { select: { name: groupKey.slice(0, -1) } },
                            "Index": { number: i }
                        }
                    });
                }
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("RSVP Update Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// TABLES
app.get('/api/tables/:eventId', async (req, res) => {
    try {
        const response = await notion.dataSources.query({
            data_source_id: DS.TABLES,
            filter: { property: "Event", relation: { contains: req.params.eventId } }
        });
        const nonArchivedTables = response.results.filter(p => !p.archived);

        // Fetch all guests for this event
        const guestsResponse = await notion.dataSources.query({
            data_source_id: DS.GUESTS,
            filter: { property: "Event", relation: { contains: req.params.eventId } }
        });
        const nonArchivedGuests = guestsResponse.results.filter(p => !p.archived);

        const allGuests = nonArchivedGuests;
        const guestIds = allGuests.map(g => g.id);

        // Fetch companions for THESE guests only
        let allCompanions = [];
        if (guestIds.length > 0) {
            const companionsResponse = await notion.dataSources.query({
                data_source_id: DS.COMPANIONS,
                filter: {
                    or: guestIds.map(id => ({ property: "Guest", relation: { contains: id } }))
                }
            });
            allCompanions = companionsResponse.results.filter(p => !p.archived);
        }

        const tables = nonArchivedTables.map(page => {
            const tableId = page.id;

            // Guests directly assigned
            const seatedGuests = allGuests
                .filter(g => {
                    const assignedTableRelation = g.properties["Assigned Table"]?.relation || [];
                    return assignedTableRelation.some(r => r.id === tableId);
                })
                .map(g => ({
                    guestId: g.id,
                    name: getText(g.properties.Name),
                    status: getText(g.properties.Status),
                    companionIndex: -1
                }));

            // Companions directly assigned
            const seatedCompanions = allCompanions
                .filter(c => {
                    const assignedTableRelation = c.properties["Assigned Table"]?.relation || [];
                    return assignedTableRelation.some(r => r.id === tableId);
                })
                .map(c => {
                    const guestId = getText(c.properties.Guest)[0];
                    const parentGuest = allGuests.find(g => g.id === guestId);
                    return {
                        guestId: guestId,
                        name: getText(c.properties.Name),
                        status: parentGuest ? (getText(parentGuest.properties.Status) || 'pending') : 'pending',
                        companionIndex: c.properties.Index?.number || 0,
                        companionId: c.id
                    };
                });

            return {
                id: tableId,
                name: getText(page.properties.Name),
                capacity: page.properties.Capacity?.number || 10,
                guests: [...seatedGuests, ...seatedCompanions]
            };
        });
        res.json(tables);
    } catch (error) {
        console.error("Fetch Tables Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tables', async (req, res) => {
    const { eventId, table } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                type: 'data_source_id',
                data_source_id: DS.TABLES
            },
            properties: {
                "Name": { title: [{ text: { content: table.name } }] },
                "Capacity": { number: table.capacity || 10 },
                "Event": { relation: [{ id: eventId }] }
            }
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tables/:tableId/guests', async (req, res) => {
    const { tableId } = req.params;
    const { assignments } = req.body; // Array of { guestId, companionId, companionIndex, companionName }
    try {
        // 1. Get all guests and companions currently assigned to this table
        const currentGuests = await notion.dataSources.query({
            data_source_id: DS.GUESTS,
            filter: { property: "Assigned Table", relation: { contains: tableId } }
        });
        const currentCompanions = await notion.dataSources.query({
            data_source_id: DS.COMPANIONS,
            filter: { property: "Assigned Table", relation: { contains: tableId } }
        });

        // 2. Clear current assignments
        for (const g of currentGuests.results) {
            await notion.pages.update({ page_id: g.id, properties: { "Assigned Table": { relation: [] } } });
        }
        for (const c of currentCompanions.results) {
            await notion.pages.update({ page_id: c.id, properties: { "Assigned Table": { relation: [] } } });
        }

        // 3. Set new assignments
        for (const assign of assignments) {
            if (assign.companionIndex === -1) {
                // Main Guest
                await notion.pages.update({
                    page_id: assign.guestId,
                    properties: { "Assigned Table": { relation: [{ id: tableId }] } }
                });
            } else {
                // Companion
                let compId = assign.companionId;

                if (!compId) {
                    // Fallback search if ID not provided
                    const companionRes = await notion.dataSources.query({
                        data_source_id: DS.COMPANIONS,
                        filter: {
                            and: [
                                { property: "Guest", relation: { contains: assign.guestId } },
                                { property: "Index", number: { equals: assign.companionIndex } },
                                { property: "Name", title: { equals: assign.companionName } }
                            ]
                        }
                    });
                    if (companionRes.results.length > 0) {
                        compId = companionRes.results[0].id;
                    }
                }

                if (compId) {
                    await notion.pages.update({
                        page_id: compId,
                        properties: { "Assigned Table": { relation: [{ id: tableId }] } }
                    });
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Update Table Guests Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tables/:id', async (req, res) => {
    try {
        // 1. Clear assignments for guests and companions at this table
        const currentGuests = await notion.dataSources.query({
            data_source_id: DS.GUESTS,
            filter: { property: "Assigned Table", relation: { contains: req.params.id } }
        });
        const currentCompanions = await notion.dataSources.query({
            data_source_id: DS.COMPANIONS,
            filter: { property: "Assigned Table", relation: { contains: req.params.id } }
        });

        for (const g of currentGuests.results) {
            await notion.pages.update({ page_id: g.id, properties: { "Assigned Table": { relation: [] } } });
        }
        for (const c of currentCompanions.results) {
            await notion.pages.update({ page_id: c.id, properties: { "Assigned Table": { relation: [] } } });
        }

        // 2. Archive the table
        await notion.pages.update({
            page_id: req.params.id,
            archived: true
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 API Server running on port: ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Notion API Key: ${process.env.NOTION_API_KEY ? 'Present ✅' : 'NOT FOUND ❌'}`);
    console.log(`-----------------------------------------`);
});
