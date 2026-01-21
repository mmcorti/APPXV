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
        TEST: process.env.NOTION_DS_TEST || "2ecff613-0900-81f5-8d52-f8bcd4bc0940",
        USERS: process.env.NOTION_DS_USERS || process.env.NOTION_USERS_DB_ID || "",
        SUBSCRIBERS: process.env.NOTION_DB_SUBSCRIBERS || "2ecff613-0900-81f5-8d52-f8bcd4bc0940",
        STAFF_ROSTER: process.env.NOTION_DB_STAFF_ROSTER || "2edff613-0900-815b-bf07-ca361d92c10a",
        STAFF_ASSIGNMENTS: process.env.NOTION_DB_STAFF_ASSIGNMENTS || "2edff613-0900-81db-8777-f40892c9ec9e",
        EXPENSES: process.env.NOTION_DS_EXPENSES || "57ee8337f02b4ffb9dc8d3a57d61a3bd",
        SUPPLIERS: process.env.NOTION_DS_SUPPLIERS || "384c7326d2b44e498935e6e63b60c3e0",
        EXPENSE_CATEGORIES: process.env.NOTION_DS_EXPENSE_CATEGORIES || "edfcf67bffea4556838550590bc16c83",
        PAYMENT_PARTICIPANTS: process.env.NOTION_DS_PAYMENT_PARTICIPANTS || "24b56421c62b4e6eaac480216407e909",
        PAYMENTS: process.env.NOTION_DS_PAYMENTS || "e9c2d7d9d030480481d9a10b797514a2"
    },

    // Database IDs (used for creation)
    DATABASE: {
        EVENTS: process.env.NOTION_DB_EVENTS || "8a693908-f427-4002-9902-4ac86b2e21d4",
        GUESTS: process.env.NOTION_DB_GUESTS || "cc6019a6-dfa0-4582-84d2-814e741019ab",
        TABLES: process.env.NOTION_DB_TABLES || "3956fff4-80f7-4bf5-81bb-41df10156a48",
        COMPANIONS: process.env.NOTION_DB_COMPANIONS || "155c66a4-239b-402d-a310-04c533f322b3",
        USERS: process.env.NOTION_DB_USERS || "",
        SUBSCRIBERS: process.env.NOTION_DB_SUBSCRIBERS || "2ecff613-0900-81f5-8d52-f8bcd4bc0940",
        STAFF_ROSTER: process.env.NOTION_DB_STAFF_ROSTER || "2edff613-0900-815b-bf07-ca361d92c10a",
        STAFF_ASSIGNMENTS: process.env.NOTION_DB_STAFF_ASSIGNMENTS || "2edff613-0900-81db-8777-f40892c9ec9e",
        EXPENSES: process.env.NOTION_DB_EXPENSES || "57ee8337f02b4ffb9dc8d3a57d61a3bd",
        SUPPLIERS: process.env.NOTION_DB_SUPPLIERS || "384c7326d2b44e498935e6e63b60c3e0",
        EXPENSE_CATEGORIES: process.env.NOTION_DB_EXPENSE_CATEGORIES || "edfcf67bffea4556838550590bc16c83",
        PAYMENT_PARTICIPANTS: process.env.NOTION_DB_PAYMENT_PARTICIPANTS || "24b56421c62b4e6eaac480216407e909",
        PAYMENTS: process.env.NOTION_DB_PAYMENTS || "e9c2d7d9d030480481d9a10b797514a2"
    }
};
