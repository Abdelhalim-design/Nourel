const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration de l'envoi d'emails (utilise Gmail par exemple)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Ton email Gmail
        pass: process.env.EMAIL_PASSWORD // Mot de passe d'application Gmail
    }
});

// Stockage temporaire des commandes (en production, utilise une vraie base de données)
let orders = [];

// Route pour créer une commande
app.post('/api/create-order', async (req, res) => {
    try {
        const { cart, total, shippingInfo } = req.body;
        
        // Créer un ID de commande unique
        const orderId = 'NOUREL-' + Date.now();
        
        // Stocker la commande
        const order = {
            orderId,
            cart,
            total,
            shippingInfo,
            status: 'pending',
            createdAt: new Date()
        };
        
        orders.push(order);
        
        res.json({ success: true, orderId });
    } catch (error) {
        console.error('Erreur création commande:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route pour confirmer le paiement et envoyer les emails
app.post('/api/payment-success', async (req, res) => {
    try {
        const { orderId, paypalOrderId, payerInfo } = req.body;
        
        // Trouver la commande
        const order = orders.find(o => o.orderId === orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Commande non trouvée' });
        }
        
        // Mettre à jour le statut
        order.status = 'paid';
        order.paypalOrderId = paypalOrderId;
        order.payerInfo = payerInfo;
        order.paidAt = new Date();
        
        // EMAIL 1 : Email pour TOI (le vendeur)
        const sellerEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #c9a961;">🎉 Nouvelle Commande NOUREL !</h2>
                
                <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3>Détails de la commande</h3>
                    <p><strong>N° de commande:</strong> ${order.orderId}</p>
                    <p><strong>PayPal ID:</strong> ${paypalOrderId}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
                    <p><strong>Montant total:</strong> ${order.total} €</p>
                </div>
                
                <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; margin: 20px 0;">
                    <h3>Articles commandés</h3>
                    ${order.cart.map(item => `
                        <p>• ${item.name} - ${item.price} €</p>
                    `).join('')}
                </div>
                
                <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; margin: 20px 0;">
                    <h3>📦 Adresse de livraison</h3>
                    <p><strong>${order.shippingInfo.fullName}</strong></p>
                    <p>${order.shippingInfo.address}</p>
                    <p>${order.shippingInfo.postalCode} ${order.shippingInfo.city}</p>
                    <p>${order.shippingInfo.country}</p>
                    <p>📧 ${order.shippingInfo.email}</p>
                    <p>📱 ${order.shippingInfo.phone}</p>
                </div>
                
                <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; margin: 20px 0;">
                    <h3>Informations client PayPal</h3>
                    <p><strong>Nom:</strong> ${payerInfo.name}</p>
                    <p><strong>Email:</strong> ${payerInfo.email}</p>
                </div>
            </div>
        `;
        
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.SELLER_EMAIL, // TON email où tu veux recevoir les commandes
            subject: `🛍️ Nouvelle commande NOUREL - ${order.orderId}`,
            html: sellerEmailHtml
        });
        
        // EMAIL 2 : Email de confirmation pour le CLIENT
        const customerEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #f9f7f4 0%, #fffbf7 100%);">
                    <h1 style="color: #1a1a1a; letter-spacing: 4px;">NOUREL</h1>
                    <p style="color: #c9a961; font-size: 12px; letter-spacing: 2px;">LUXE & ÉLÉGANCE</p>
                </div>
                
                <div style="padding: 30px;">
                    <h2 style="color: #1a1a1a;">✅ Merci pour votre commande !</h2>
                    <p>Bonjour ${order.shippingInfo.fullName},</p>
                    <p>Nous avons bien reçu votre paiement et votre commande est confirmée.</p>
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>N° de commande:</strong> ${order.orderId}</p>
                        <p><strong>Montant payé:</strong> ${order.total} €</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
                    </div>
                    
                    <h3>Vos articles</h3>
                    ${order.cart.map(item => `
                        <p style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                            <strong>${item.name}</strong><br>
                            <span style="color: #c9a961;">${item.price} €</span>
                        </p>
                    `).join('')}
                    
                    <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 5px; margin: 30px 0;">
                        <h3 style="color: #c9a961;">📦 Adresse de livraison</h3>
                        <p>${order.shippingInfo.fullName}</p>
                        <p>${order.shippingInfo.address}</p>
                        <p>${order.shippingInfo.postalCode} ${order.shippingInfo.city}</p>
                        <p>${order.shippingInfo.country}</p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        Votre commande sera préparée avec soin et expédiée dans les plus brefs délais. 
                        Vous recevrez un email de suivi dès l'expédition de votre colis.
                    </p>
                    
                    <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
                        <p style="color: #999; font-size: 12px;">
                            NOUREL - Collection Exclusive<br>
                            Email: hello@nourel.com | Tél: +33 (0)1 23 45 67 89
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: order.shippingInfo.email,
            subject: `Confirmation de commande NOUREL - ${order.orderId}`,
            html: customerEmailHtml
        });
        
        console.log('✅ Emails envoyés avec succès pour la commande:', order.orderId);
        
        res.json({ success: true, message: 'Paiement confirmé et emails envoyés' });
        
    } catch (error) {
        console.error('Erreur traitement paiement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route pour récupérer toutes les commandes (pour ton dashboard admin)
app.get('/api/orders', (req, res) => {
    res.json({ success: true, orders });
});

// Route de test
app.get('/', (req, res) => {
    res.json({ message: 'API NOUREL fonctionne !' });
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur NOUREL démarré sur le port ${PORT}`);
    console.log(`📧 Email configuré: ${process.env.EMAIL_USER}`);
});