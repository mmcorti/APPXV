/// <reference types="vite/client" />
import { InvitationData, Guest, Table } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

export const notionService = {
    async uploadImage(base64Image: string): Promise<string> {
        const res = await fetch(`${API_URL}/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to upload image');
        }
        const data = await res.json();
        return data.url;
    },

    async generateAiImage(prompt: string): Promise<string> {
        const res = await fetch(`${API_URL}/ai/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to generate AI image');
        }
        const data = await res.json();
        return data.image;
    },

    async editAiImage(image: string, prompt: string): Promise<string> {
        const res = await fetch(`${API_URL}/ai/edit-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, prompt })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to edit AI image');
        }
        const data = await res.json();
        return data.image;
    },

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

    async getEvents(userEmail?: string, staffId?: string): Promise<InvitationData[]> {
        const params = new URLSearchParams();
        if (userEmail) params.append('email', userEmail);
        if (staffId) params.append('staffId', staffId);

        const url = `${API_URL}/events?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch events');
        return await res.json();
    },

    async saveEvent(event: Partial<InvitationData> & { userEmail?: string; userPlan?: string; userRole?: string }) {
        const method = event.id ? 'PUT' : 'POST';
        const url = event.id ? `${API_URL}/events/${event.id}` : `${API_URL}/events`;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const error = new Error(errorData.error || 'Failed to save event');
            (error as any).limitReached = errorData.limitReached;
            (error as any).current = errorData.current;
            (error as any).limit = errorData.limit;
            throw error;
        }
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

    async saveGuest(eventId: string, guest: Guest, options?: { userPlan?: string; userRole?: string }) {
        // Use PUT if guest.id is a string (Notion UUID), POST if it's numeric/new
        const isUpdate = typeof guest.id === 'string' && guest.id.length > 20;
        const url = isUpdate ? `${API_URL}/guests/${guest.id}` : `${API_URL}/guests`;
        const method = isUpdate ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId,
                guest,
                userPlan: options?.userPlan,
                userRole: options?.userRole
            })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const error = new Error(errorData.error || 'Failed to save guest');
            (error as any).limitReached = errorData.limitReached;
            (error as any).current = errorData.current;
            (error as any).limit = errorData.limit;
            throw error;
        }
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

    async updateTable(tableId: string, name: string, capacity: number) {
        const res = await fetch(`${API_URL}/tables/${tableId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, capacity })
        });
        if (!res.ok) throw new Error('Failed to update table');
        return await res.json();
    },

    async reorderTables(orders: { tableId: string, order: number }[]) {
        const res = await fetch(`${API_URL}/tables/reorder`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders })
        });
        if (!res.ok) throw new Error('Failed to reorder tables');
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
    },

    // === EXPENSE CONTROL MODULE ===

    // Expenses
    async getExpenses(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/expenses`);
        if (!res.ok) throw new Error('Failed to fetch expenses');
        return await res.json();
    },
    async createExpense(eventId: string, expense: { name: string; category: string; supplier: string; total: number; paid: number; status: string }) {
        const res = await fetch(`${API_URL}/events/${eventId}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense)
        });
        if (!res.ok) throw new Error('Failed to create expense');
        return await res.json();
    },
    async updateExpense(id: string, expense: Partial<{ name: string; category: string; supplier: string; total: number; paid: number; status: string }>) {
        const res = await fetch(`${API_URL}/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense)
        });
        if (!res.ok) throw new Error('Failed to update expense');
        return await res.json();
    },
    async deleteExpense(id: string) {
        const res = await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete expense');
        return await res.json();
    },

    // Suppliers
    async getSuppliers(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/suppliers`);
        if (!res.ok) throw new Error('Failed to fetch suppliers');
        return await res.json();
    },
    async createSupplier(eventId: string, supplier: { name: string; category: string; phone: string; email: string }) {
        const res = await fetch(`${API_URL}/events/${eventId}/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supplier)
        });
        if (!res.ok) throw new Error('Failed to create supplier');
        return await res.json();
    },
    async updateSupplier(id: string, supplier: Partial<{ name: string; category: string; phone: string; email: string }>) {
        const res = await fetch(`${API_URL}/suppliers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supplier)
        });
        if (!res.ok) throw new Error('Failed to update supplier');
        return await res.json();
    },
    async deleteSupplier(id: string) {
        const res = await fetch(`${API_URL}/suppliers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete supplier');
        return await res.json();
    },

    // Expense Categories
    async getExpenseCategories(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/expense-categories`);
        if (!res.ok) throw new Error('Failed to fetch expense categories');
        return await res.json();
    },
    async createExpenseCategory(eventId: string, category: { name: string; icon: string; subtitle: string }) {
        const res = await fetch(`${API_URL}/events/${eventId}/expense-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
        });
        if (!res.ok) throw new Error('Failed to create expense category');
        return await res.json();
    },
    async updateExpenseCategory(id: string, category: Partial<{ name: string; icon: string; subtitle: string }>) {
        const res = await fetch(`${API_URL}/expense-categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
        });
        if (!res.ok) throw new Error('Failed to update expense category');
        return await res.json();
    },
    async deleteExpenseCategory(id: string) {
        const res = await fetch(`${API_URL}/expense-categories/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete expense category');
        return await res.json();
    },

    // === PAYMENT PARTICIPANTS ===
    async getParticipants(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/participants`);
        if (!res.ok) throw new Error('Failed to fetch participants');
        return await res.json();
    },
    async createParticipant(eventId: string, participant: { name: string; weight?: number }) {
        const res = await fetch(`${API_URL}/events/${eventId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participant)
        });
        if (!res.ok) throw new Error('Failed to create participant');
        return await res.json();
    },
    async updateParticipant(id: string, participant: Partial<{ name: string; weight: number }>) {
        const res = await fetch(`${API_URL}/participants/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participant)
        });
        if (!res.ok) throw new Error('Failed to update participant');
        return await res.json();
    },
    async deleteParticipant(id: string) {
        const res = await fetch(`${API_URL}/participants/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete participant');
        return await res.json();
    },

    // === PAYMENTS ===
    async getPayments(expenseId: string) {
        const res = await fetch(`${API_URL}/expenses/${expenseId}/payments`);
        if (!res.ok) throw new Error('Failed to fetch payments');
        return await res.json();
    },
    async createPayment(expenseId: string, payment: { participantId: string; amount: number; date?: string; description?: string; receiptUrl?: string }) {
        const res = await fetch(`${API_URL}/expenses/${expenseId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
        });
        if (!res.ok) throw new Error('Failed to create payment');
        return await res.json();
    },
    async deletePayment(id: string) {
        const res = await fetch(`${API_URL}/payments/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete payment');
        return await res.json();
    },

    // === BALANCES ===
    async getBalances(eventId: string) {
        const res = await fetch(`${API_URL}/events/${eventId}/balances`);
        if (!res.ok) throw new Error('Failed to fetch balances');
        return await res.json();
    }
};
