
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_URL = 'http://localhost:3001/api';

async function testTableCreation() {
    try {
        // Get event ID first
        console.log("Fetching events...");
        const eventsRes = await fetch(`${API_URL}/events`);
        const events = await eventsRes.json();

        if (!events || events.length === 0) {
            console.error("No events found");
            return;
        }

        const eventId = events[0].id;
        console.log("Using event ID:", eventId);

        // Try to create a table
        console.log("\nCreating test table...");
        const createRes = await fetch(`${API_URL}/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: eventId,
                name: "Test Mesa",
                capacity: 10
            })
        });

        const createText = await createRes.text();
        console.log("Response status:", createRes.status);
        console.log("Response body:", createText);

        if (!createRes.ok) {
            console.error("Failed to create table");
            return;
        }

        const result = JSON.parse(createText);
        console.log("Table created successfully:", result);

    } catch (e) {
        console.error("Error:", e.message);
        console.error(e);
    }
}

testTableCreation();
