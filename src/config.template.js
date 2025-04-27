// Template configuration file
// Copy this file to config.js and replace the values with your actual API keys
const config = {
    // API keys and other sensitive configuration
    api: {
        gemini: {
            key: 'YOUR_GEMINI_API_KEY_HERE',
            endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent'
        },
        desmos: {
            key: 'YOUR_DESMOS_API_KEY_HERE'
        }
    }
};

// Freeze the config object to prevent modifications
Object.freeze(config);

export default config; 