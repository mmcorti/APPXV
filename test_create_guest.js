
import fetch from 'node-fetch';

async function testCreateGuest() {
    const url = 'http://localhost:3001/api/guests';
    const guestData = {
        eventId: '8a693908-f427-4002-9902-4ac86b2e21d4', // Assuming this is a valid event ID from previous logs
        guest: {
            name: "Test User " + Date.now(),
            email: "test@example.com",
            status: "pending",
            allotted: { adults: 2, teens: 0, kids: 0, infants: 0 },
            companionNames: { adults: [], teens: [], kids: [], infants: [] }
        }
    };

    console.log("Sending POST request to:", url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestData)
        });

        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text);
    } catch (error) {
        console.error("Error:", error);
    }
}

testCreateGuest();
