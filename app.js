
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: false,
}));

app.use(express.static(path.join(__dirname, 'public')));

// ---------------- OAuth Config ----------------
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
    'https://www.googleapis.com/auth/adwords',
    'https://www.googleapis.com/auth/webmasters.readonly'
];

let userCredential = null;

// ---------------- Login ----------------
app.get('/login', (req, res) => {
    const state = crypto.randomBytes(32).toString('hex');
    req.session.state = state;
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state,
        prompt: 'consent'
    });
    res.redirect(authUrl);
});

// ---------------- OAuth2 Callback ----------------
app.get('/oauth2callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.send('Error: ' + error);
    if (state !== req.session.state) return res.send('State mismatch!');

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        userCredential = tokens;
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.send('Error fetching tokens.');
    }
});

// ---------------- Keyword Planner ----------------
app.post('/keywords', async (req, res) => {
    const { developer_token, mcc_id, customer_id, keyword } = req.body;
    if (!userCredential?.refresh_token) return res.status(401).json({ error: 'Login first!' });

    try {
        const client = new GoogleAdsApi({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            developer_token,
        });

        const customer = client.Customer({
            customer_account_id: customer_id,
            refresh_token: userCredential.refresh_token,
            login_customer_id: mcc_id,
        });

        const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
            customer_id,
            language: '1000',
            geo_target_constants: ['geoTargetConstants/2840'],
            keyword_plan_network: 'GOOGLE_SEARCH',
            keywords: [keyword],
        });

        res.json(response);
    } catch (err) {
        console.error(err);

        // Clean user-friendly error
        let message = 'Unknown error occurred';
        if (err?.errors?.[0]?.message) {
            message = err.errors[0].message;
        } else if (err?.message) {
            message = err.message;
        }

        res.status(err?.status || 500).json({
            status: err?.status || 500,
            message
        });
    }
});

// ---------------- Search Console ----------------
app.post('/searchconsole', async (req, res) => {
    const { siteUrl } = req.body;
    if (!userCredential) return res.status(401).json({ status: 401, message: "Login first!" });

    try {
        oauth2Client.setCredentials(userCredential);
        const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

        // Dates
        const today = new Date();
        const endDate = today.toISOString().split('T')[0];
        const lastYear = new Date(today);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        const startDate = lastYear.toISOString().split('T')[0];

        // 1️⃣ Search Analytics
        const analytics = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: 10 }
        });

      
        // 3️⃣ Sites List
        const sites = await searchconsole.sites.list();

        // 4️⃣ URL Inspection (Example for one URL)
        const urlInspection = await searchconsole.urlInspection.index.inspect({
            siteUrl,
            inspectionUrl: siteUrl
        });

    
      

        res.json({
            status: 200,
            success: true,
            data: {
                analytics: analytics.data,
                // sitemaps: sitemaps.data,
                sites: sites.data,
                urlInspection: urlInspection.data,
                
            }
        });
    } catch (err) {
        console.error(err);
        res.status(err?.response?.status || 500).json({
            status: err?.response?.status || 500,
            message: err?.cause?.message || 'Unknown error occurred'
        });
    }
});



// ---------------- Root UI ----------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(process.env.PORT || 8000, () => 
    console.log(`Server running at http://localhost:${process.env.PORT || 8000}`)
);
