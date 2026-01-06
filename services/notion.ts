/// <reference types="vite/client" />
import { InvitationData, Guest, Table } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const notionService = {
    async login(email: string, passwordHash: string) {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: passwordHash })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Login failed');
        return data.user;
    },

    async getEvents(userEmail?: string): Promise<InvitationData[]> {
        const url = userEmail ? `${API_URL}/events?email=${encodeURIComponent(userEmail)}` : `${API_URL}/events`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch events');
        return await res.json();
    },

    async saveEvent(event: Partial<InvitationData> & { userEmail?: string }) {
        const method = event.id ? 'PUT' : 'POST';
        const url = event.id ? `${API_URL}/events/${event.id}` : `${API_URL}/events`;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        if (!res.ok) throw new Error('Failed to save event');
        return await res.json();
    },

    async deleteEvent(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete event');
        return await res.json();
    },

    async getGuests(eventId: string): Promise<Guest[]> {
        const res = await fetch(`${API_URL}/guests?eventId=${eventId}`);
        if (!res.ok) throw new Error('Failed to fetch guests');
        return await res.json();
    },

    async saveGuest(eventId: string, guest: Guest) {
        // Use PUT if guest.id is a string (Notion UUID), POST if it's numeric/new
        const isUpdate = typeof guest.id === 'string' && guest.id.length > 20;
        const url = isUpdate ? `${API_URL}/guests/${guest.id}` : `${API_URL}/guests`;
        const method = isUpdate ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, guest })
        });
        if (!res.ok) throw new Error('Failed to save guest');
        return await res.json();
    },

    async deleteGuest(guestId: string) {
        const res = await fetch(`${API_URL}/guests/${guestId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete guest');
        return await res.json();
    },

    async updateRSVP(guestId: string, status: string, confirmed: any, companionNames: any) {
        const res = await fetch(`${API_URL}/guests/${guestId}/rsvp`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, confirmed, companionNames })
        });
        if (!res.ok) throw new Error('Failed to update RSVP');
        return await res.json();
    },

    async getTables(eventId: string): Promise<Table[]> {
        const res = await fetch(`${API_URL}/tables?eventId=${eventId}`);
        if (!res.ok) throw new Error('Failed to fetch tables');
        return await res.json();
    },

    async saveTable(eventId: string, table: Partial<Table>) {
        const res = await fetch(`${API_URL}/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, table })
        });
        if (!res.ok) throw new Error('Failed to save table');
        return await res.json();
    },

    async updateTableGuests(tableId: string, assignments: { guestId: string | number, companionId?: string, companionIndex: number, companionName: string }[]) {
        const res = await fetch(`${API_URL}/tables/${tableId}/guests`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignments })
        });
        if (!res.ok) throw new Error('Failed to update table seating');
        return await res.json();
    },

    async deleteTable(tableId: string) {
        const res = await fetch(`${API_URL}/tables/${tableId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete table');
        return await res.json();
    }
};
