const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3000

const DATA_FILE = path.join(__dirname, 'data', 'tickets.json')

app.use(express.json())
app.use(express.static(__dirname))

app.get('/api/tickets', (req, res) => {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)

    if (Array.isArray(data)) {
      return res.json(data)
    }

    res.json(data.tickets || [])
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Cannot read tickets.json' })
  }
})

app.post('/api/tickets', (req, res) => {
  try {
    const newTicket = req.body

    let currentData = []

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8')

      const parsed = JSON.parse(raw)

      currentData = Array.isArray(parsed)
        ? parsed
        : parsed.tickets || []
    }

    currentData.push(newTicket)

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tickets: currentData }, null, 2),
      'utf8'
    )

    res.json({
      success: true,
      total: currentData.length
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: 'Cannot save ticket'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})