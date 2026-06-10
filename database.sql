
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);


CREATE TABLE genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);


CREATE TABLE movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    release_year INTEGER NOT NULL,
    genre_id INTEGER,
    poster_path TEXT NOT NULL,
    trailer_path TEXT NOT NULL,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE RESTRICT
);

INSERT INTO genres (name, description) VALUES ('Боевик', 'Шытырман оқиғалы фильмдер');
INSERT INTO genres (name, description) VALUES ('Комедия', 'Күлкілі фильмдер');
INSERT INTO genres (name, description) VALUES ('Фантастика', 'Ғарыш пен болашақ туралы');


INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path)
VALUES ('Аватар: Су жолы', 'Пандора тұрғындарының өз үйін қорғаудағы шайқасы.', 2022, 3, '/uploads/posters/avatar.jpg', '/uploads/trailers/avatar.mp4');

INSERT INTO movies (title, description, release_year, genre_id, poster_path, trailer_path)
VALUES ('Темір адам', 'Миллиардер Тони Старктың темір костюм жасап шығаруы.', 2008, 1, '/uploads/posters/ironman.jpg', '/uploads/trailers/ironman.mp4');