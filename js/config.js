/**
 * Configuration globale de la plateforme Print-on-Demand Objex3D
 */
window.OBJEX_CONFIG = {
    // Point d'entrée Webhook n8n pour les commandes
    N8N_WEBHOOK_URL: "https://yelp-bakeshop-repaying.ngrok-free.dev/webhook/commande-print-on-demand",
    
    // Point d'entrée Webhook n8n pour les tickets de bug / support
    N8N_BUG_TICKET_WEBHOOK_URL: "https://yelp-bakeshop-repaying.ngrok-free.dev/webhook/ticket-bug",

    // Adresse email de contact pour le repli (fallback mailto)
    CONTACT_EMAIL: "objex3d@gmail.com",
    
    // Formule de calcul du prix : (Poids en grammes * Prix du filament au gramme) * COEFFICIENT_MARGE
    COEFFICIENT_MARGE: 1.5,
    
    // Prix minimum plancher par commande (€)
    PRIX_MINIMUM: 2.0,
    
    // Majoration pour impression bicolore (+25% sur la pièce pour purges et changements AMS)
    BICOLOR_SURCHARGE_RATE: 0.25,

    // Timeout de requête Webhook (en ms) avant bascule automatique sur mailto
    WEBHOOK_TIMEOUT_MS: 5000
};
