const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();


const directories = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/posters'),
    path.join(__dirname, 'uploads/trailers')
];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});


const db = new sqlite3.Database(path.join(__dirname, 'movies.db'), (err) => {
    if (err) console.error('МБ қосылу қатесі:', err.message);
    else {
        console.log('SQLite мәліметтер базасына сәтті қосылды.');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        db.run("PRAGMA foreign_keys = ON;");

        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS genres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            release_year INTEGER NOT NULL,
            genre_id INTEGER,
            poster_path TEXT NOT NULL,
            trailer_path TEXT NOT NULL,
            FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE RESTRICT
        )`);


        db.get("SELECT * FROM users WHERE username = 'admin'", [], async (err, row) => {
            if (!row) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", ['admin', hashedPassword], (err) => {
                    if (err) console.error('Админді қосу қатесі:', err.message);
                    else console.log('Тесттік қолданушы құрылды -> Логин: admin, Құпия сөз: admin123');
                });
            }
        });


        db.get("SELECT COUNT(*) as count FROM genres", [], (err, row) => {
            if (row && row.count === 0) {
                db.run("INSERT INTO genres (id, name, description) VALUES (1, 'Боевик', 'Шытырман оқиғалы және экшн фильмдер')");
                db.run("INSERT INTO genres (id, name, description) VALUES (2, 'Комедия', 'Күлкілі әрі көңілді кинолар')");
                db.run("INSERT INTO genres (id, name, description) VALUES (3, 'Фантастика', 'Ғарыш, болашақ және қиял-ғажайып әлем')");
                console.log('Жанрлар кестесі мәліметтермен толтырылды.');


                insertDefaultMovies();
            } else {
                insertDefaultMovies();
            }
        });
    });
}


function insertDefaultMovies() {
    db.get("SELECT COUNT(*) as count FROM movies", [], (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['Аватар: Су жолы', 'Пандора тұрғындарының өз үйін қорғаудағы жаңа шайқасы мен оқиғалары.', 2022, 3, '/uploads/posters/avatar.jpg', '/uploads/trailers/avatar.mp4']);

            db.run(`INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['Темір адам2 ', 'Миллиардер Тони Старктың жаңа костюмі және зұлымдармен арпалысы.', 2010, 1, '/uploads/posters/ironman.jpg', '/uploads/trailers/ironman.mp4']);

            db.run(`INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['Денеміздін жылуы', 'Құпия вирус пен аман қалу үшін күрескен жандар туралы хикая.', 2013, 2, '/uploads/posters/zombie.jpg', '/uploads/trailers/zombie.mp4']);

            console.log('Фильмдер кестесі мәліметтермен толтырылды.');
        }
    });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'movies-admin-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = file.fieldname === 'poster' ? 'uploads/posters/' : 'uploads/trailers/';
        cb(null, path.join(__dirname, folder));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

const checkAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Авторизациядан өтпегенсіз' });
    next();
};


app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.userId = user.id;
            return res.json({ success: true });
        }
        res.status(400).json({ error: 'Қате логин немесе құпия сөз' });
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) return res.json({ authorized: true });
    res.json({ authorized: false });
});


app.get('/api/genres', checkAuth, (req, res) => {
    db.all('SELECT * FROM genres ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/genres', checkAuth, (req, res) => {
    const { name, description } = req.body;
    db.run('INSERT INTO genres (name, description) VALUES (?, ?)', [name, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/genres/:id', checkAuth, (req, res) => {
    db.run('DELETE FROM genres WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(400).json({ error: 'Бұл жанрға фильмдер бекітілген, жоюға болмайды!' });
        }
        res.json({ success: true });
    });
});


app.get('/api/movies', checkAuth, (req, res) => {
    const query = `
        SELECT m.*, g.name as genre_name
        FROM movies m
        JOIN genres g ON m.genre_id = g.id
        ORDER BY m.id DESC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/movies', checkAuth, upload.fields([{ name: 'poster' }, { name: 'trailer' }]), (req, res) => {
    const { title, description, release_year, genre_id } = req.body;

    if (!req.files['poster'] || !req.files['trailer']) {
        return res.status(400).json({ error: 'Постер мен treiler файлдарын жүктеу міндетті!' });
    }

    const poster_path = '/uploads/posters/' + req.files['poster'][0].filename;
    const trailer_path = '/uploads/trailers/' + req.files['trailer'][0].filename;

    db.run(
        'INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, release_year, genre_id, poster_path, trailer_path],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/movies/:id', checkAuth, (req, res) => {
    db.get('SELECT poster_path, trailer_path FROM movies WHERE id = ?', [req.params.id], (err, movie) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!movie) return res.status(404).json({ error: 'Фильм табылмады' });

        const fullPosterPath = path.join(__dirname, movie.poster_path);
        const fullTrailerPath = path.join(__dirname, movie.trailer_path);

        if (fs.existsSync(fullPosterPath)) fs.unlinkSync(fullPosterPath);
        if (fs.existsSync(fullTrailerPath)) fs.unlinkSync(fullTrailerPath);

        db.run('DELETE FROM movies WHERE id = ?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

app.listen(3000, () => console.log('Сервер http://localhost:3000 портында жұмыс істеп тұр'));