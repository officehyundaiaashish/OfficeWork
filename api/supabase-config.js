const crypto = require('crypto');

// Vercel serverless function to securely retrieve Supabase config using password gate
module.exports = (req, res) => {
  // Support both GET and POST requests
  const password = req.query.password || (req.body && req.body.password);
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Hash the incoming password using SHA-256 to compare with the stored hash
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const targetHash = '658a39f88a25d0fb5b4b79454e789e07c4e82e197ab3027433cc07240578f7a0'; // SHA-256 of 7894

  if (hash === targetHash) {
    res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_ANON_KEY || ''
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid password' });
  }
};
