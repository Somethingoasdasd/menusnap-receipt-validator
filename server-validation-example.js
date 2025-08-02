// Simple Node.js server for App Store receipt validation
// Deploy this to Vercel, Netlify, or any Node.js hosting service

const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Your App Store Connect shared secret
const APP_STORE_SHARED_SECRET = '12ab825df4b14e9199ea8e58113e044c';
// Production App Store validation URL
const APP_STORE_VALIDATION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

// Sandbox App Store validation URL (for testing)
const SANDBOX_VALIDATION_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

app.post('/validate-receipt', async (req, res) => {
    try {
        const { 'receipt-data': receiptData } = req.body;
        
        if (!receiptData) {
            return res.status(400).json({ error: 'Receipt data is required' });
        }

        // First try production
        let validationResult = await validateWithAppStore(receiptData, APP_STORE_VALIDATION_URL);
        
        // If production fails with status 21007, try sandbox
        if (validationResult.status === 21007) {
            validationResult = await validateWithAppStore(receiptData, SANDBOX_VALIDATION_URL);
        }

        // Check if subscription is valid
        const isValid = checkSubscriptionValidity(validationResult);
        
        res.json({
            isValid,
            status: validationResult.status,
            environment: validationResult.environment,
            latest_receipt_info: validationResult.latest_receipt_info
        });

    } catch (error) {
        console.error('Receipt validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
    }
});

async function validateWithAppStore(receiptData, validationUrl) {
    const requestBody = {
        'receipt-data': receiptData,
        'password': APP_STORE_SHARED_SECRET,
        'exclude-old-transactions': true
    };

    const response = await axios.post(validationUrl, requestBody);
    return response.data;
}

function checkSubscriptionValidity(validationResult) {
    // Status 0 means valid
    if (validationResult.status !== 0) {
        return false;
    }

    // Check for active subscriptions
    const latestReceiptInfo = validationResult.latest_receipt_info;
    if (!latestReceiptInfo || !Array.isArray(latestReceiptInfo)) {
        return false;
    }

    // Look for active subscriptions
    const now = Math.floor(Date.now() / 1000);
    const activeSubscription = latestReceiptInfo.find(receipt => {
        const expiresDate = parseInt(receipt.expires_date_ms) / 1000;
        return expiresDate > now;
    });

    return !!activeSubscription;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Receipt validation server running on port ${PORT}`);
});

// For Vercel deployment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
} 
