import express from 'express';

const app = express()
app.use(express.json())

const port = 5000;

app.get('/', (req, res) => res.send('Test Server is running...'));

app.get('/testing/:number', (req, res) => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();
    res.status(500).json({ message: `Number: ${req.params.number}, Time: ${time}, Seconds: ${seconds}, Milliseconds: ${milliseconds}` });
});

app.listen(port, () => {
    console.log('Ok, Port is: ' + port);
})