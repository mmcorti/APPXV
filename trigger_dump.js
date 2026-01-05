async function trigger() {
    try {
        console.log("Fetching events...");
        const resEvents = await fetch('http://localhost:10000/api/events');
        const events = await resEvents.json();
        console.log("Full Events Response:", JSON.stringify(events, null, 2));

        if (Array.isArray(events) && events.length > 0) {
            console.log("Fetching guests for event:", events[0].id);
            const resGuests = await fetch(`http://localhost:10000/api/guests?eventId=${events[0].id}`);
            const guests = await resGuests.json();
            console.log("Guests fetched:", guests.length);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
trigger();
