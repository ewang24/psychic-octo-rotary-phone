const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
import { Database, OPEN_CREATE, OPEN_READWRITE } from "sqlite3";
import { DbUtil } from "../../../core/db/dbUtil";


/*
 * This functionality uses the music-metadata library. Documentation is here: https://www.npmjs.com/package/music-metadata
   IAudioMetadata is the interface that defines the shape of the metadata returned. 
   Common tags: https://github.com/borewit/music-metadata/blob/HEAD/doc/common_metadata.md
 */

const SupportedFileTypesList = ['mp3', 'm4a', 'wav', 'flac']
export type SupportedFileTypes = typeof SupportedFileTypesList[number];
export const fileReadingTempTable = 'temp_read_table';

export class LibrarySetupService {

    librarySource: string;
    dbPath: string;
    albumCovers: Record<string, {data:Buffer, type: string}>;
    _verbose: boolean = false;

    /**
     * 
     * @param librarySource absolute path to directory representing the source library
     * @param dbPath absolute path to the sqlite databse file
     */
    constructor(librarySource: string, dbPath: string){
        this.librarySource = librarySource;
        this.dbPath = dbPath;
    }

    verbose(): LibrarySetupService{
        this._verbose = true;
        return this;
    }

    log(msg: string){
        if(this._verbose){
            console.log(msg);
        }
    }

    static isSupportedFileType(fileType: string): fileType is SupportedFileTypes {
        let val = fileType.replace(/\./g, '');
        return SupportedFileTypesList.indexOf(val as SupportedFileTypes) >= 0;
    }

    async scanFiles(): Promise<void> {
        //TODO clear out cover image files in APPDATA so they don't overflow

        this.albumCovers = {};
        //TODO: replace with the path from the config table (maybe)
        //'P:/Music/music/rotation/'
        this.log(`Creating library db with ${this.librarySource} as the source at ${this.dbPath}`);
        const db = new Database(`${this.dbPath}`, OPEN_CREATE | OPEN_READWRITE, (err: Error | null) => {
            if (err) {
                return console.error(err.message);
            }
        });

        const insertStatements: string[] = [];
        this.log('starting library processing');
        await this.processLibrary(this.librarySource, insertStatements);
        this.log('processed, preparing to insert');

        const transaction = `
            CREATE TABLE ${fileReadingTempTable} (
                id INTEGER PRIMARY KEY,
                albumName TEXT,
                albumYear INTEGER,
                artistName TEXT,
                genre TEXT,
                songName TEXT,
                songLength INTEGER,
                songPosition INTEGER,
                songFilePath TEXT
            );

            BEGIN TRANSACTION; ${insertStatements.join("\n")} COMMIT;
        `

        this.log(transaction);
        await DbUtil.execute(db, transaction);
        await this.insertDistinctIntoTable('genre', 'genre', 'name', db);
        await this.insertDistinctIntoTable('artist', 'artistName', 'name', db);
        await this.insertAlbums(db);
        await this.insertSongs(db);
        await DbUtil.execute(db, `DROP TABLE ${fileReadingTempTable}`);
        await DbUtil.close(db);
    }

    private async insertDistinctIntoTable(
        targetTableName: string,
        originColumnName: string,
        targetColumnName: string,
        db: Database): Promise<void> {

        //Insert into the given target table.
        //Uses the temp table and a left join to find insert any records where the origin column in the temp table does not match the target column in the target table
        const insertTransaction = `
            INSERT INTO ${targetTableName} (id, ${targetColumnName})
            SELECT NULL, temp.${originColumnName}
            FROM (
                SELECT DISTINCT ${originColumnName}
                from ${fileReadingTempTable}
            ) AS temp
            LEFT JOIN ${targetTableName} AS targetTable ON temp.${originColumnName} = targetTable.${targetColumnName}
            WHERE targetTable.id IS NULL and temp.${originColumnName} IS NOT NULL
        `
        this.log(insertTransaction);
        return DbUtil.execute(db, insertTransaction);
    }


    private async insertAlbums(db: Database): Promise<void> {
        const insertTransaction = `
            insert into album (id, name, artistId)
            select null, temp.albumName, temp.artistId
            from (
                select distinct t.albumName, art.id as artistId from ${fileReadingTempTable} as t inner join artist art on t.artistName = art.name
                where t.albumName IS NOT NULL
            ) as temp
            left join album as alb on temp.albumName = alb.name
            where alb.id is null;
        `;

        // console.log(insertTransaction);
        await DbUtil.execute(db, insertTransaction);

        const sql = `UPDATE album SET coverImage = ? WHERE name = ?`;
        for (let album of Object.keys(this.albumCovers)) {
            const albumCoverDetails = this.albumCovers[album];
            const fileName = await this.persistAlbumArt(albumCoverDetails.data, this.generateUUID(), albumCoverDetails.type)
            await DbUtil.run(db, sql, [fileName, album]);
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

    private async persistAlbumArt(albumArt: Buffer, coverImageUuid: string, imageFormat: string): Promise<string> {
        try {        
                const coversPath = path.join(process.env.APPDATA, 'Electron', 'covers');
                await fs.promises.mkdir(coversPath, { recursive: true });
                const coverImageFile =`${coverImageUuid}.${imageFormat}`;
                const outputFilePath = path.join(coversPath, coverImageFile);
    
                await fs.writeFile(outputFilePath, albumArt, (err) => {
                    if (err) {
                        console.error('Error writing cover image to file:', err);
                    } else {
                        console.log(`Cover image saved as ${outputFilePath}`);
                    }
                });

                return coverImageFile;
        } catch (error) {
            console.error('Error extracting album art:', error);
        }
    }

    private async insertSongs(db: Database): Promise<void> {
        const insertTransaction = `
        insert into song (id, name, albumId, songPosition, songLength, songFilePath)
        select null, temp.songName, temp.albumId, temp.songPosition, temp.songLength, temp.songFilePath
        from (
            select distinct t.songName, alb.id as albumId, t.songPosition, t.songLength, t.songFilePath
            from album alb inner join artist art on alb.artistId = art.id inner join ${fileReadingTempTable} t on (t.albumName = alb.name and t.artistName = art.name)
        ) as temp
        left join song as so on temp.songName = so.name
        where so.id is null;
        `;

        this.log(insertTransaction);
        return DbUtil.execute(db, insertTransaction);
    }

    private async processLibrary(directoryPath: string, insertStatements: string[]): Promise<void> {
        let files = await fs.promises.readdir(directoryPath);
        const directories = [];

        for (let file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                directories.push(filePath);
            }
            else {
                await this.proccessAudioFile(filePath, insertStatements)
            }
        }
        files = null;

        for (let dir of directories) {
            await this.processLibrary(dir, insertStatements);
        }
    }

    private async proccessAudioFile(filePath: string, insertStatements: string[]): Promise<void> {
        if (LibrarySetupService.isSupportedFileType(path.extname(filePath))) {
            let metadata = await mm.parseFile(filePath, { duration: true });

            const albumName = this.quoteString(metadata.common?.album || 'Unknown Album');
            const artistName = this.quoteString(metadata.common?.artist || 'Unknown Artist');
            const songName = this.quoteString(metadata.common?.title || `Unknown Song: ${filePath}`);
            const songPosition = metadata.common?.track?.no || 0;
            const _genre = metadata.common.genre;
            const genre = this.quoteString(_genre ? _genre[0] : 'Unknown Genre');
            const length = Math.floor(metadata.format?.duration || 0);
            const insertStatement = `
                INSERT INTO ${fileReadingTempTable} (albumName, artistName, songName, songPosition, genre, songFilePath, songLength) values (
                    ${albumName}, ${artistName}, ${songName}, ${songPosition}, ${genre}, ${this.quoteString(filePath)}, ${length}
                );
            `
            const coverImage = metadata.common?.picture?.[0]?.data;
            if (coverImage && metadata.common.album) {
                const unquotedAlbumName = this.quoteEscape(metadata.common.album);
                //TODO: [0] is the first album cover. If there are more embedded, we will not pick up on them. Perhaps need to suppor that in the future.

                let imageFormat = metadata.common.picture[0].format;
    
                // Map format to proper file extension
                let formatMap = {
                    'jpg': 'jpg',
                    'jpeg': 'jpg',
                    'png': 'png',
                    'gif': 'gif',
                    'bmp': 'bmp',
                    'tiff': 'tiff'
                };
    
                imageFormat = formatMap[imageFormat] || 'jpg';
                this.albumCovers[unquotedAlbumName] = this.albumCovers[unquotedAlbumName] || {data: coverImage, type: imageFormat};
            }

            metadata = null;
            insertStatements.push(insertStatement);
        }
    }

    private quoteEscape(str: string) {
        //Escape single quotes so we don't break the insert
        const quoteEscaped = str.replace(/['"]/g, match => {
            return match === "'" ? "''" : '\\"';
        })

        return quoteEscaped;
    }

    private quoteString(str: string) {
        if (!str) {
            return 'NULL';
        }

        return `'${this.quoteEscape(str)}'`;
    }

}