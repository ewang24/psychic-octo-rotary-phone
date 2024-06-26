--Create genre table
CREATE TABLE IF NOT EXISTS genre (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NULL
);

--Create artist table
CREATE TABLE IF NOT EXISTS artist (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    biography TEXT NULL
);

--Create album table
 CREATE TABLE IF NOT EXISTS album (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    artistId INTEGER NOT NULL,
    FOREIGN KEY (artistId) REFERENCES artist(id)
);

--Create song table
CREATE TABLE IF NOT EXISTS song (
    id INTEGER PRIMARY KEY,
    name TEXT NULL,
    songPosition INTEGER NULL,
    songLength INTEGER NULL,
    songFilePath TEXT NOT NULL,
    albumId INTEGER NULL,
    FOREIGN KEY (albumId) REFERENCES album(id)
);