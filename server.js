const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

// System prompts for different interview types
const systemPrompts = {
    general: 'You are a friendly and professional interviewer. Conduct a conversational interview, asking one question at a time. Be welcoming and encouraging.',
    technical: 'You are a technical interviewer. Ask challenging but fair technical questions. Be professional and thorough.',
    hr: 'You are an HR professional. Conduct a structured interview focusing on soft skills, experience, and cultural fit.',
    sales: 'You are a sales manager conducting an interview. Focus on sales experience, communication skills, and ability to handle rejection.',
};

// API endpoint for Claude
app.post('/api/interview-claude', async (req, res) => {
    try {
          const { messages, interviewType = 'general', customPrompt } = req.body;

      const systemPrompt = customPrompt || systemPrompts[interviewType] || systemPrompts.general;

      const response = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1024,
              system: systemPrompt,
              messages: messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
              })),
      });

      res.json({
              role: 'assistant',
              content: response.content[0].text,
      });
    } catch (error) {
          console.error('Claude API Error:', error);
          res.status(500).json({ error: error.message });
    }
});

// API endpoint for OpenAI
app.post('/api/interview-openai', async (req, res) => {
    try {
          const { messages, interviewType = 'general', customPrompt } = req.body;

      const systemPrompt = customPrompt || systemPrompts[interviewType] || systemPrompts.general;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: systemPrompt },
                        ...messages.map(msg => ({
                                    role: msg.role,
                                    content: msg.content,
                        })),
                      ],
              max_tokens: 1024,
              temperature: 0.7,
      }, {
              headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
              },
      });

      res.json({
              role: 'assistant',
              content: response.data.choices[0].message.content,
      });
    } catch (error) {
          console.error('OpenAI API Error:', error);
          res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Interview Platform is running' });
});

// Start server
app.listen(PORT, () => {

    // Initialize SQLite database
    const db = new sqlite3.Database(':memory:', (err) => {
          if (err) {
                  console.error('Database error:', err);
          } else {
                  console.log('Connected to in-memory SQLite database');
          }
    });

    // Create interviews table
    db.run(`
      CREATE TABLE IF NOT EXISTS interviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL,
                  customPrompt TEXT,
                      messages TEXT NOT NULL,
                          provider TEXT NOT NULL,
                              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                                )
                                `);

    // Save interview endpoint
    app.post('/api/save-interview', (req, res) => {
          const { type, customPrompt, messages, provider } = req.body;
          const messagesJSON = JSON.stringify(messages);

          db.run(
                  'INSERT INTO interviews (type, customPrompt, messages, provider) VALUES (?, ?, ?, ?)',
                  [type, customPrompt, messagesJSON, provider],
                  function(err) {
                            if (err) {
                                        res.status(500).json({ error: err.message });
                            } else {
                                        res.json({ id: this.lastID, message: 'Interview saved successfully' });
                            }
                  }
                );
    });

    // Get all interviews endpoint
    app.get('/api/interviews', (req, res) => {
          db.all('SELECT * FROM interviews ORDER BY createdAt DESC', (err, rows) => {
                  if (err) {
                            res.status(500).json({ error: err.message });
                  } else {
                            const interviews = rows.map(row => ({
                                        ...row,
                                        messages: JSON.parse(row.messages)
                            }));
                            res.json(interviews);
                  }
          });
    });

    // Get single interview endpoint
    app.get('/api/interviews/:id', (req, res) => {
          const { id } = req.params;
          db.get('SELECT * FROM interviews WHERE id = ?', [id], (err, row) => {
                  if (err) {
                            res.status(500).json({ error: err.message });
                  } else if (!row) {
                            res.status(404).json({ error: 'Interview not found' });
                  } else {
                            res.json({
                                        ...row,
                                        messages: JSON.parse(row.messages)
                            });
                  }
          });
    });

    // Delete interview endpoint
    app.delete('/api/interviews/:id', (req, res) => {
          const { id } = req.params;
          db.run('DELETE FROM interviews WHERE id = ?', [id], function(err) {
                  if (err) {
                            res.status(500).json({ error: err.message });
                  } else {
                            res.json({ message: 'Interview deleted successfully', changes: this.changes });
                  }
          });
    });

    // Export interviews as JSON endpoint
    app.get('/api/interviews/export/json', (req, res) => {
          db.all('SELECT * FROM interviews', (err, rows) => {
                  if (err) {
                            res.status(500).json({ error: err.message });
                  } else {
                            const interviews = rows.map(row => ({
                                        ...row,
                                        messages: JSON.parse(row.messages)
                            }));
                            res.setHeader('Content-Disposition', 'attachment; filename=interviews.json');
                            res.setHeader('Content-Type', 'application/json');
                            res.json(interviews);
                  }
          });
    });
    
    console.log(`Server running on http://localhost:${PORT}`);
});
