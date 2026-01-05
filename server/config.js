import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

export const NOTION_CONFIG = {
    API_KEY: process.env.NOTION_API_KEY || "",

    // Data Source IDs (used for query)
    DATA_SOURCE: {
        EVENTS: process.env.NOTION_DS_EVENTS || "8a693908-f427-4002-9902-4ac86b2e21d4",
        GUESTS: process.env.NOTION_DS_GUESTS || "cc6019a6-dfa0-4582-84d2-814e741019ab",
        TABLES: process.env.NOTION_DS_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48",
        COMPANIONS: process.env.NOTION_DS_COMPANIONS || "155c66a4-239b-402d-a310-04c533f322b3",
        USERS: process.env.NOTION_DS_USERS || process.env.NOTION_USERS_DB_ID || ""
    },

    // Database IDs (used for creation)
    DATABASE: {
        EVENTS: process.env.NOTION_DB_EVENTS || "8a693908-f427-4002-9902-4ac86b2e21d4",
        GUESTS: process.env.NOTION_DB_GUESTS || "cc6019a6-dfa0-4582-84d2-814e741019ab",
        TABLES: process.env.NOTION_DB_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48",
        COMPANIONS: process.env.NOTION_DB_COMPANIONS || "155c66a4-239b-402d-a310-04c533f322b3"
    }
};
